/**
 * Resolving `<span data-interview-condition>` — conditional passages.
 *
 * A plain string scanner with NO DOM, so the browser and the backend run the
 * same code. A DOM implementation on one side and a regex implementation on the
 * other eventually disagree about nesting, and the disagreement shows up as a
 * clause the lawyer saw and the tenant did not.
 *
 * Two rules carry the most weight, both preserved exactly:
 *
 *   • FAIL OPEN. A malformed condition keeps its text. Dropping it deletes
 *     authored legal wording with no trace anywhere; keeping it surfaces as a
 *     visible sentence a reviewing lawyer can strike. Data corruption must not
 *     silently shorten a contract.
 *   • An UNCLOSED span takes the rest of the document as its content rather
 *     than throwing the tail away.
 *
 * `stripConditionalSpans` is the no-answers path: every variant kept, wrapper
 * gone. That is what a delivered PDF gets when there is no run behind it, and
 * what .docx/PDF export must always use — the scaffolding is authoring markup
 * and has no business in a file anyone receives.
 */

import { evaluateCondition } from "./conditions.js";

export const CONDITION_ATTR = "data-interview-condition";

const SPAN_OPEN = /<span\b[^>]*>/gi;
const SPAN_ANY = /<\/?span\b[^>]*>/gi;

const decodeAttribute = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Ampersand last: doing it first would double-decode "&amp;quot;".
    .replace(/&amp;/g, "&");

/**
 * @returns the parsed condition, `null` for a malformed one, `undefined` when
 * the tag is an ordinary span.
 */
function readCondition(tag) {
  const match = new RegExp(
    `${CONDITION_ATTR}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    "i"
  ).exec(tag);
  if (!match) return undefined;
  const raw = decodeAttribute(match[2] ?? match[3] ?? "");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rules)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Index just past the `</span>` closing the span whose content starts at
 *  `from`, counting nested spans (conditional or not). */
function findMatchingClose(html, from) {
  SPAN_ANY.lastIndex = from;
  let depth = 0;
  let match;

  while ((match = SPAN_ANY.exec(html)) !== null) {
    const isClose = match[0].startsWith("</");
    if (isClose) {
      if (depth === 0)
        return { contentEnd: match.index, after: match.index + match[0].length };
      depth -= 1;
    } else if (!match[0].endsWith("/>")) {
      depth += 1;
    }
  }
  return { contentEnd: html.length, after: html.length };
}

function walk(html, handle) {
  let out = "";
  let cursor = 0;

  for (;;) {
    SPAN_OPEN.lastIndex = cursor;
    let open = null;
    let condition;

    // Ordinary spans pass through untouched, tags and all.
    for (;;) {
      const candidate = SPAN_OPEN.exec(html);
      if (!candidate) break;
      const found = readCondition(candidate[0]);
      if (found !== undefined) {
        open = candidate;
        condition = found;
        break;
      }
    }

    if (!open) {
      out += html.slice(cursor);
      return out;
    }

    out += html.slice(cursor, open.index);
    const contentStart = open.index + open[0].length;
    const { contentEnd, after } = findMatchingClose(html, contentStart);
    out += handle(
      condition ?? null,
      walk(html.slice(contentStart, contentEnd), handle),
      open[0]
    );
    cursor = after;
  }
}

/**
 * Rewrites every conditional span through `handle`, leaving ordinary spans and
 * surrounding text untouched.
 *
 * Exported because an EDITOR needs to transform these spans without owning a
 * second scanner — renaming a fact across a document, for instance. The
 * scanner is the subtle part (nesting, unclosed tags, malformed attributes);
 * duplicating it in a consumer is how the two would drift.
 *
 * `handle` receives the parsed condition (`null` when malformed), the already
 * walked inner html, and the ORIGINAL open tag — so a rewrite can keep
 * attributes this package does not model, like `data-interview-note`.
 *
 * @param {string} html
 * @param {(condition: object|null, inner: string, openTag: string) => string} handle
 */
export function mapConditionalSpans(html, handle) {
  if (!html || !html.includes(CONDITION_ATTR)) return html;
  return walk(html, handle);
}

/**
 * Drops conditional passages whose condition fails; unwraps the ones that pass.
 * @param {string} html
 * @param {Record<string, unknown>} facts
 */
export function resolveConditionalSpans(html, facts) {
  if (!html || !html.includes(CONDITION_ATTR)) return html;
  return walk(html, (condition, inner) => {
    if (condition === null) return inner; // malformed — keep, see header
    return evaluateCondition(condition, facts) ? inner : "";
  });
}

/** Unwraps every conditional span, keeping all text regardless of condition. */
export function stripConditionalSpans(html) {
  if (!html || !html.includes(CONDITION_ATTR)) return html;
  return walk(html, (_condition, inner) => inner);
}

/** Every fact referenced by conditional text in this HTML. */
export function collectConditionalFactKeys(html) {
  const keys = new Set();
  if (!html) return [];
  walk(html, (condition, inner) => {
    condition?.rules?.forEach((rule) => rule.factKey && keys.add(rule.factKey));
    return inner;
  });
  return Array.from(keys);
}
