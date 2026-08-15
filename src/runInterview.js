/**
 * Runs an interview against a set of answers.
 *
 * One mechanism: order plus conditions. Questions are asked in order unless
 * `askWhen` excludes them. There is no traversal, so there are no cycles to
 * guard against and no path to truncate.
 *
 * A run produces FACTS, not a document. What the text does with those facts —
 * which passages survive, how many copies a block gets — is `assembleDocument`,
 * because the body is one document with inline marks rather than a set of slots
 * this function could select.
 *
 * Facts fold forward INCREMENTALLY, and only for questions that were actually
 * asked. That is not an optimisation, it is the correctness property that makes
 * back-navigation safe. A tenant who answers "do you use processors? yes", names
 * three of them, then goes back and switches to "no", must not have those three
 * names survive in the fact bag and steer a clause into the document. A question
 * that is not asked contributes nothing, even when a stale answer for it is
 * still sitting in the answers map.
 *
 * The run stops folding at the first unanswered REQUIRED question but still
 * returns the facts gathered so far: the authoring preview renders the document
 * as it stands mid-interview, and `complete` says whether to trust it.
 */

import { evaluateCondition, evaluatePredicate } from './conditions.js'

const asArray = (value) => {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

const resolveLocalized = (text, locale, defaultLocale) => {
  if (!text) return ''
  return text[locale] ?? text[defaultLocale] ?? Object.values(text)[0] ?? ''
}

/**
 * Whether a disqualifier fires, given only the facts collected SO FAR.
 *
 * Plain `evaluateCondition` is wrong here, and subtly so. Several operators
 * pass on an unset fact by design — `is_false` and `neq` most of all — which is
 * correct when deciding whether to SHOW something and catastrophic when
 * deciding whether to END the interview: a disqualifier reading
 * `processes_eu_subjects is_false` would fire on the very first question,
 * before that question has been asked, and tell the tenant the document does
 * not apply to them.
 *
 * So a rule only counts once its fact has actually been written. Under `all`,
 * every rule must be known and pass; under `any`, one known passing rule is
 * enough. An unanswered or "don't know" question therefore never disqualifies
 * anyone — it leaves an open point, which is the honest outcome.
 */
function disqualifierMatches(condition, facts) {
  if (!condition?.rules?.length) return false
  const known = condition.rules.filter((rule) => facts[rule.factKey] !== undefined)

  if (condition.mode === 'any') return known.some((rule) => evaluatePredicate(rule, facts))
  return known.length === condition.rules.length && known.every((rule) => evaluatePredicate(rule, facts))
}

/** Did this answer select an option the author marked as disqualifying? */
function disqualifyingOption(question, answer) {
  if (!answer || answer.unknown || !question.options?.length) return false
  const chosen = new Set(asArray(answer.value))
  return question.options.some((option) => option.disqualifying && chosen.has(option.id))
}

/**
 * @param {object} definition
 * @param {Record<string, {value?: unknown, unknown?: boolean, note?: string}>} answers
 */
export function runInterview(definition, answers = {}) {
  const locale = definition?.defaultLocale || 'de'
  const facts = {}
  const steps = []
  const askedQuestions = []
  const openPoints = []

  let pendingQuestion = null
  let pendingStepKey = null
  let disqualifiedBy = null
  let answered = 0

  // Disqualification is checked after every answer, not once at the end. "This
  // document does not apply to you" has to stop the interview where it becomes
  // true — asking twelve more questions and only then saying it was pointless
  // is the single most annoying thing a questionnaire can do.
  const checkDisqualified = () => {
    disqualifiedBy = definition?.disqualifiers?.find((d) => disqualifierMatches(d.when, facts)) ?? null
    return disqualifiedBy !== null
  }

  outer: for (const step of definition?.steps ?? []) {
    // A step's own condition reads the facts collected before it — the same
    // backwards-only rule every `askWhen` follows.
    if (!evaluateCondition(step.showWhen, facts)) continue

    const visible = []

    for (const question of step.questions ?? []) {
      if (!evaluateCondition(question.askWhen, facts)) continue
      visible.push(question)
      askedQuestions.push(question)

      const answer = answers?.[question.factKey]

      if (!answer || (answer.value === undefined && !answer.unknown)) {
        // Stop folding at the first unanswered REQUIRED question: nothing after
        // it can be resolved honestly. Optional gaps are stepped over, leaving
        // their fact unset — which every operator already treats as falsy.
        if (question.required && !pendingQuestion) {
          pendingQuestion = question
          pendingStepKey = step.key
        }
        continue
      }

      answered += 1

      if (answer.unknown) {
        openPoints.push({
          questionId: question.id,
          factKey: question.factKey,
          question: resolveLocalized(question.plainQuestion, locale, locale),
          note: answer.note,
        })
        continue
      }

      if (answer.value !== undefined) facts[question.factKey] = answer.value

      if (disqualifyingOption(question, answer)) {
        disqualifiedBy = {
          when: { mode: 'all', rules: [{ factKey: question.factKey, op: 'eq', value: answer.value }] },
          message: question.whyAsked ?? question.plainQuestion,
        }
        if (visible.length) steps.push({ step, questions: visible })
        break outer
      }

      if (checkDisqualified()) {
        if (visible.length) steps.push({ step, questions: visible })
        break outer
      }
    }

    if (visible.length) steps.push({ step, questions: visible })
  }

  // Final sweep: a disqualifier reading a fact that was never folded during the
  // loop (every question skipped, or the last answer an explicit "unknown")
  // would otherwise go unevaluated.
  if (!disqualifiedBy) checkDisqualified()

  const complete = !disqualifiedBy && !pendingQuestion

  return {
    steps,
    askedQuestions,
    pendingQuestion,
    pendingStepKey,
    facts,
    openPoints,
    disqualifiedBy,
    terminal: disqualifiedBy ? 'not_applicable' : complete ? 'assemble' : null,
    complete,
    progress: { answered, total: askedQuestions.length },
  }
}
