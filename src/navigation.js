/**
 * The navigation rules a runner needs on top of a run.
 *
 * `runInterview` answers "given these answers, what is true". Paginating that
 * into a wizard needs more: which page the tenant is on, whether they may leave
 * it, and what a progress bar should say. Those are decisions, not rendering,
 * so they live here as pure functions rather than inside a hook — which is also
 * why they can be tested without a DOM, and shared by two apps that render
 * completely differently.
 *
 * The rules are shared by two surfaces that would otherwise each invent them:
 * the network manager's preview and the asset-manager's tenant runner. Two
 * answers to "is this step finished" is two different questionnaires.
 */

/**
 * Where the cursor really is.
 *
 * Held as an ID by callers, resolved to an index here, because the step list is
 * DERIVED from the answers: answering one question can remove the page the
 * tenant is standing on. An index into a list that just got shorter silently
 * points at a different step — this falls back to the first, which is the
 * honest recovery, since the page they were on no longer applies to them.
 */
export function resolveStepIndex(steps, stepId) {
  if (!steps.length) return -1
  const found = steps.findIndex((entry) => entry.step.id === stepId)
  return found === -1 ? 0 : found
}

/**
 * Required questions on this page that are still unanswered.
 *
 * An explicit "don't know" COUNTS as answered. It is a different outcome for
 * the lawyer — it becomes an open point — and the same one for navigation: the
 * tenant has said something either way, and blocking them on it would force a
 * guess into a legal document.
 */
export function blockingQuestions(questions, answers) {
  return questions.filter((question) => {
    if (!question.required) return false
    const given = answers[question.factKey]
    return !given || (given.value === undefined && !given.unknown)
  })
}

/** The step holding a question — what a review screen's "edit" jumps to. */
export function stepHoldingQuestion(steps, factKey) {
  return steps.find((entry) => entry.questions.some((question) => question.factKey === factKey))
}

/**
 * Progress in PAGES, not questions.
 *
 * A question-based bar lurches: answering one question can reveal five more and
 * send the bar backwards, which reads as punishment for answering. Pages are
 * what the tenant experiences, and a page appearing moves the denominator
 * honestly.
 */
export function stepProgress(steps, index) {
  const total = steps.length
  if (!total) return { current: 0, total: 0, ratio: 0 }
  const current = Math.min(Math.max(index + 1, 1), total)
  return { current, total, ratio: current / total }
}

/** The step to move to, or null when the move is not allowed. `delta` is +1/-1. */
export function stepAfterMove(steps, index, delta, blocked) {
  // Forward is gated on the page being finished; backward never is. A tenant
  // must always be able to retreat and change an answer, including one that
  // made the current page invalid.
  if (delta > 0 && blocked) return null
  return steps[index + delta] ?? null
}
