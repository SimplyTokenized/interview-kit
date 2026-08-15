/**
 * Filling merge fields in an assembled document.
 *
 * Three rules, and each exists because breaking it produces a document that
 * looks finished and is wrong:
 *
 *   1. SIGNING-TIME TOKENS ARE LEFT STANDING. `{{account.*}}` and `{{order.*}}`
 *      are per signature — one assembled document is signed by many investors.
 *      Substituting them at generation would bake the first signer into a
 *      contract meant for all of them. An unresolved `{{account.name}}` in a
 *      generated draft is the correct state.
 *
 *   2. AN UNKNOWN TOKEN IS LEFT ALONE. If a document contains `{{whatever}}`
 *      this package does not recognise, it stays as written. Replacing it with
 *      a placeholder value would destroy an author's text; leaving it visible
 *      makes the mistake findable.
 *
 *   3. A KNOWN TOKEN WITH NO VALUE BECOMES A VISIBLE MARKER, not an empty
 *      string. A contract with a blank where the register number belongs reads
 *      as complete and is not; `(N/A)` is a defect anyone can see.
 *
 * Values are supplied by the caller. This package does not know how to read a
 * tenant row or an order — only which tokens exist, when each is knowable, and
 * what to do when one is missing.
 */

import { findPlaceholder, wizardFactKey } from './placeholders.js'

/** What a known token renders as when nobody supplied a value. */
export const MISSING_VALUE = '(N/A)'

const ANY_TOKEN = /\{\{([^}]+)\}\}/g

const display = (value) => {
  if (value === null || value === undefined) return MISSING_VALUE
  const text = String(value).trim()
  return text.length > 0 ? text : MISSING_VALUE
}

/**
 * @param {string} html
 * @param {object} options
 * @param {Record<string, unknown>} [options.values] keyed by full code, e.g.
 *   `{'{{tenant.name}}': 'Acme GmbH'}`
 * @param {Record<string, unknown>} [options.facts] the interview's answers, for
 *   `{{wizard.<factKey>}}`
 * @param {boolean} [options.includeSigning] substitute signing-time tokens too.
 *   Only true at the signature step, where the signer IS known.
 */
export function substitutePlaceholders(html, { values = {}, facts = {}, includeSigning = false } = {}) {
  if (!html) return html ?? ''

  return String(html).replace(ANY_TOKEN, (match, rawName) => {
    const inner = String(rawName || '').trim()
    const code = `{{${inner}}}`

    // The interview's own answers. Checked first because `wizard.*` is not in
    // the fixed catalog — its codes exist only once an author writes them.
    const factKey = wizardFactKey(code)
    if (factKey) {
      const fact = facts?.[factKey]
      // An array answer is a multi-select; joined rather than rendered as
      // "a,b,c" by accident of String(). A document says "hosting, payment".
      if (Array.isArray(fact)) return fact.length ? fact.join(', ') : MISSING_VALUE
      if (typeof fact === 'boolean') return fact ? 'Ja' : 'Nein'
      return display(fact)
    }

    const def = findPlaceholder(code)
    if (!def) return match // rule 2 — not ours, do not touch

    if (def.resolvedAt === 'signing' && !includeSigning) return match // rule 1

    if (Object.prototype.hasOwnProperty.call(values, code)) return display(values[code])
    return MISSING_VALUE // rule 3
  })
}

/**
 * Known tokens the document still contains after substitution — what a "this
 * draft is missing things" check reports.
 *
 * Signing-time tokens are excluded: they are supposed to still be there.
 */
export function unresolvedPlaceholders(html) {
  if (!html) return []
  const found = new Set()
  let match
  const scanner = new RegExp(ANY_TOKEN.source, 'g')
  while ((match = scanner.exec(html)) !== null) {
    const code = `{{${String(match[1] || '').trim()}}}`
    const def = findPlaceholder(code)
    if (def && def.resolvedAt !== 'signing') found.add(code)
  }
  return Array.from(found)
}
