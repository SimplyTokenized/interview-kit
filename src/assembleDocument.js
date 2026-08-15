/**
 * Turning an authored template body into the document a tenant receives.
 *
 * One entry point on purpose. The two transforms have a REQUIRED ORDER and
 * getting it wrong is silent: a conditional inside a repeated block must be
 * copied before it is evaluated, once per copy. Reversed, it is evaluated once
 * against the un-copied original and that single verdict is then duplicated —
 * so every copy says the same thing, which is exactly what the author was
 * trying to avoid. Nothing errors. Callers therefore do not get to choose the
 * order; they call this.
 *
 * Authoring markup NEVER reaches output. `data-interview-condition` and
 * `data-interview-repeat` are scaffolding the editor writes into the stored
 * HTML so the backend can act on them; a delivered PDF or .docx carrying them
 * would render every variant at once and print raw `{{item.label}}` tokens.
 *
 * WITHOUT FACTS the safe reading is "keep everything, once": every conditional
 * passage kept, one copy of each repeat, wrappers gone. That is the
 * proofreading view, and it is what a PDF built before any interview has been
 * run must show — a document missing clauses because nobody answered anything
 * would look finished and be wrong.
 */

import { resolveConditionalSpans, stripConditionalSpans } from "./conditionalText.js";
import { expandRepeatBlocks, stripRepeatBlocks } from "./repeatBlocks.js";

/**
 * @param {string} html the template's stored body
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.facts] answers from an interview
 *   run. Omit for the proofreading/no-run view.
 * @param {{steps?: Array<object>, defaultLocale?: string}} [options.definition]
 *   the template's interview — needed to resolve `{{item.label}}` to option
 *   labels while expanding repeats.
 * @param {string} [options.locale]
 * @returns {string}
 */
export function assembleDocumentHtml(html, options = {}) {
  if (!html) return html ?? "";

  const { facts, definition, locale } = options;

  // A run needs BOTH: facts to evaluate and a definition to name the options a
  // repeat iterates. With only one of them, resolving would drop passages on
  // incomplete information, so fall back to keeping everything.
  if (!facts || !definition) {
    return stripConditionalSpans(stripRepeatBlocks(html));
  }

  // Repeats first. See the header.
  return resolveConditionalSpans(
    expandRepeatBlocks(html, facts, definition, locale),
    facts
  );
}
