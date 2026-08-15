/**
 * Checking what an AI did to a legal document.
 *
 * A model asked to "tighten the wording" will happily rewrite HTML, and the
 * things it destroys are invisible in the result: the prose reads better, and
 * the document has quietly stopped working. Every check here is something that
 * produces a plausible-looking contract which fails only later — at signature,
 * at generation, or in front of a regulator.
 *
 * This is a VERIFIER, not a prompt. Telling a model the rules is necessary and
 * insufficient; the rules have to be enforced on what comes back. It runs on
 * the proposed revision BEFORE it is applied, so a violation is a rejected
 * suggestion rather than a document to repair.
 *
 * Deliberately not a diff of the prose. Whether the AI improved a sentence is a
 * judgement for the lawyer reading the tracked change. What is checked here is
 * only the machinery a human reviewer cannot see: tokens and markup.
 */

import { findPlaceholder } from './placeholders.js'

/** Mirrors the backend's anchor regex — role `[a-z0-9_-]+`, type `[a-z_]+`. */
const SIGN_ANCHOR = /\{\{\s*sign:[a-z0-9_-]+\.[a-z_]+\s*\}\}/gi
const WIZARD_TOKEN = /\{\{\s*wizard\.[a-z0-9_]+\s*\}\}/gi
const ANY_TOKEN = /\{\{[^}]+\}\}/g

const CONDITION_ATTR = 'data-interview-condition'
const REPEAT_ATTR = 'data-interview-repeat'

const canonical = (token) => token.replace(/\s+/g, '').toLowerCase()

const collect = (html, pattern) => {
  const found = []
  const scanner = new RegExp(pattern.source, pattern.flags)
  let match
  while ((match = scanner.exec(String(html || ''))) !== null) found.push(canonical(match[0]))
  return found
}

const countOccurrences = (html, needle) =>
  String(html || '').split(needle).length - 1

/**
 * @param {string} before the document as it stands
 * @param {string} after the AI's proposed revision
 * @returns {{ok: boolean, violations: Array<{rule: string, detail: string}>}}
 */
export function checkAiRevision(before, after) {
  const violations = []
  const add = (rule, detail) => violations.push({ rule, detail })

  // 1. SIGNATURE ANCHORS ARE UNTOUCHABLE.
  //
  // A dropped anchor is a contract nobody can sign; an ADDED one is a signature
  // box bound to no recipient, which the backend writes with a null recipient
  // and which fails silently at send time. Neither is the AI's decision — who
  // signs is a legal question answered by the flow that creates the envelope.
  const anchorsBefore = collect(before, SIGN_ANCHOR)
  const anchorsAfter = collect(after, SIGN_ANCHOR)

  for (const anchor of new Set(anchorsBefore)) {
    const lost = countOccurrences(canonical(before), anchor) - countOccurrences(canonical(after), anchor)
    if (lost > 0) add('signature_anchor_removed', `${anchor} (${lost}×)`)
  }
  for (const anchor of new Set(anchorsAfter)) {
    if (!anchorsBefore.includes(anchor)) add('signature_anchor_added', anchor)
  }

  // 2. SIGNING-TIME PLACEHOLDERS MUST SURVIVE.
  //
  // The worst case in this file: the AI "helpfully" replaces `{{account.name}}`
  // with a name it found in the conversation. One assembled document is signed
  // by many investors, so that bakes one signer into a contract meant for all
  // of them — and it reads perfectly.
  for (const token of new Set(collect(before, ANY_TOKEN))) {
    const def = findPlaceholder(token)
    if (def?.resolvedAt !== 'signing') continue
    if (!collect(after, ANY_TOKEN).includes(token)) {
      add('signing_token_resolved', token)
    }
  }

  // 3. WIZARD ANSWERS MUST NOT BE DROPPED OR INVENTED.
  //
  // A dropped `{{wizard.x}}` silently removes a value the tenant supplied; an
  // invented one renders as a visible marker in a finished document, because
  // no such question exists to answer it.
  const wizardBefore = new Set(collect(before, WIZARD_TOKEN))
  const wizardAfter = new Set(collect(after, WIZARD_TOKEN))
  for (const token of wizardBefore) {
    if (!wizardAfter.has(token)) add('wizard_token_removed', token)
  }
  for (const token of wizardAfter) {
    if (!wizardBefore.has(token)) add('wizard_token_added', token)
  }

  // 4. AUTHORING MARKUP MUST SURVIVE.
  //
  // Not in the original brief, and the likeliest of all of these: a model
  // rewriting HTML strips attributes it does not understand. Losing a
  // `data-interview-condition` span turns a passage that applied to some
  // clients into one that applies to everybody — the document still reads
  // correctly, and is now wrong for most of its readers.
  const conditionsBefore = countOccurrences(before, CONDITION_ATTR)
  const conditionsAfter = countOccurrences(after, CONDITION_ATTR)
  if (conditionsAfter < conditionsBefore) {
    add('conditional_passage_lost', `${conditionsBefore} → ${conditionsAfter}`)
  }

  const repeatsBefore = countOccurrences(before, REPEAT_ATTR)
  const repeatsAfter = countOccurrences(after, REPEAT_ATTR)
  if (repeatsAfter < repeatsBefore) {
    add('repeat_block_lost', `${repeatsBefore} → ${repeatsAfter}`)
  }

  // 5. A TOKEN SPLIT BY MARKUP IS A DEAD TOKEN.
  //
  // `{{buyer<strong>.name}}` stops matching the backend's regex entirely. It
  // happens when a model bolds part of a sentence containing one.
  const split = String(after || '').match(/\{\{[^}]*<[^}]*\}\}/g)
  if (split?.length) add('token_split_by_markup', split.slice(0, 3).join(', '))

  return { ok: violations.length === 0, violations }
}

/**
 * The rules, as text to put in a system prompt.
 *
 * Kept beside the verifier ON PURPOSE. Prompt and check drifting apart is how
 * you end up enforcing a rule the model was never told, or telling it a rule
 * nothing enforces — and the second is worse, because it reads as safe.
 */
export const AI_DOCUMENT_RULES = [
  'Never add, remove or alter a {{sign:role.type}} anchor. Who signs is decided elsewhere.',
  'Never replace {{account.*}} or {{order.*}} with a literal value. One document is signed by many investors.',
  'Never remove or invent a {{wizard.<factKey>}} token. They are answers a tenant gave.',
  'Never remove a <span data-interview-condition> or <div data-interview-repeat>, and never change their attributes.',
  'Never let markup interrupt a {{…}} token.',
]
