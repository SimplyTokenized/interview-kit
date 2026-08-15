/**
 * Answering a question from what the platform already knows.
 *
 * A `prefillKey` is a PLACEHOLDER CODE without its braces —
 * `"tenant.register_number"` resolves against the same `{{tenant.register_number}}`
 * the document substitutes. That is deliberate: a second vocabulary for "where
 * does this value come from" would mean two lists to keep in step, and the
 * failure would be silent — a question prefilled from one field while the
 * document prints another.
 *
 * PREFILL IS CONFIRM-OR-CHANGE, NOT AUTO-ANSWER. The value is seeded so the
 * tenant is not asked to retype their own company number — being asked for it
 * by the system that billed you last month is the fastest way to lose faith in
 * a questionnaire. But it is seeded VISIBLY, and the caller is told which
 * answers came this way, because an answer nobody looked at is exactly the one
 * that ends up wrong in a legal document.
 *
 * Only UNANSWERED questions are prefilled. A tenant who already corrected a
 * value must never have it silently reverted on the next load — that is the
 * bug that makes people stop trusting a form and start re-checking every field.
 */

/**
 * @param {object} definition
 * @param {Record<string, {value?: unknown, unknown?: boolean}>} answers current answers
 * @param {Record<string, unknown>} values placeholder values, keyed by full code
 * @returns {{answers: object, prefilled: string[]}} the answers to apply, and
 *   the factKeys that were filled — for a caller that wants to mark them.
 */
export function applyPrefill(definition, answers = {}, values = {}) {
  const next = { ...answers }
  const prefilled = []

  for (const step of definition?.steps ?? []) {
    for (const question of step?.questions ?? []) {
      if (!question?.prefillKey) continue

      const existing = next[question.factKey]
      // Answered, or explicitly "don't know" — either way the tenant has spoken.
      if (existing && (existing.value !== undefined || existing.unknown)) continue

      const value = values[`{{${question.prefillKey}}}`]
      // An empty platform value is not an answer. Seeding "" would present a
      // blank as though it had been confirmed.
      if (value === undefined || value === null || String(value).trim() === '') continue

      next[question.factKey] = { value }
      prefilled.push(question.factKey)
    }
  }

  return { answers: next, prefilled }
}
