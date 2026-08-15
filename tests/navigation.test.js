import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  blockingQuestions,
  resolveStepIndex,
  stepAfterMove,
  stepHoldingQuestion,
  stepProgress,
} from '../src/index.js'

const question = (factKey, required = true) => ({
  id: `${factKey}_id`,
  factKey,
  answerType: 'boolean',
  plainQuestion: { de: factKey },
  required,
})

const steps = [
  { step: { id: 's1', key: 'one' }, questions: [question('a')] },
  { step: { id: 's2', key: 'two' }, questions: [question('b'), question('c', false)] },
  { step: { id: 's3', key: 'three' }, questions: [question('d')] },
]

describe('resolveStepIndex', () => {
  test('finds the held step', () => {
    assert.equal(resolveStepIndex(steps, 's2'), 1)
  })

  // The bug an index-based cursor causes: the tenant answers something that
  // removes the page they were standing on.
  test('falls back to the first step when the held one has disappeared', () => {
    assert.equal(resolveStepIndex(steps, 'gone'), 0)
  })

  test('starts at the first step when nothing is held yet', () => {
    assert.equal(resolveStepIndex(steps, null), 0)
  })

  test('reports -1 when there are no steps at all', () => {
    assert.equal(resolveStepIndex([], 's1'), -1)
  })
})

describe('blockingQuestions', () => {
  test('lists required questions with no answer', () => {
    assert.deepEqual(blockingQuestions(steps[1].questions, {}).map((q) => q.factKey), ['b'])
  })

  test('ignores optional ones entirely', () => {
    assert.deepEqual(blockingQuestions([question('x', false)], {}), [])
  })

  // Forcing a guess into a legal document is worse than recording that nobody
  // knew — so "don't know" must not block.
  test('treats an explicit "don\'t know" as answered', () => {
    assert.deepEqual(blockingQuestions([question('b')], { b: { unknown: true } }), [])
  })

  test('does not treat an empty answer object as answered', () => {
    assert.deepEqual(blockingQuestions([question('b')], { b: {} }).map((q) => q.factKey), ['b'])
  })

  test('accepts falsy values — "no" is an answer', () => {
    assert.deepEqual(blockingQuestions([question('b')], { b: { value: false } }), [])
  })
})

describe('stepHoldingQuestion', () => {
  test('finds the page a question is on', () => {
    assert.equal(stepHoldingQuestion(steps, 'c')?.step.key, 'two')
  })

  test('returns nothing for a question that is not being asked', () => {
    assert.equal(stepHoldingQuestion(steps, 'unasked'), undefined)
  })
})

describe('stepProgress', () => {
  test('counts pages from one', () => {
    assert.deepEqual(stepProgress(steps, 0), { current: 1, total: 3, ratio: 1 / 3 })
    assert.deepEqual(stepProgress(steps, 2), { current: 3, total: 3, ratio: 1 })
  })

  test('clamps an index that outran the list', () => {
    assert.equal(stepProgress(steps, 99).current, 3)
    assert.equal(stepProgress(steps, -5).current, 1)
  })

  test('reports zero rather than dividing by it', () => {
    assert.deepEqual(stepProgress([], 0), { current: 0, total: 0, ratio: 0 })
  })
})

describe('stepAfterMove', () => {
  test('moves forward when the page is finished', () => {
    assert.equal(stepAfterMove(steps, 0, 1, false)?.step.key, 'two')
  })

  test('refuses to move forward while the page is blocked', () => {
    assert.equal(stepAfterMove(steps, 0, 1, true), null)
  })

  // A tenant must always be able to retreat — including away from a page their
  // own answer just invalidated.
  test('always allows going back, even when blocked', () => {
    assert.equal(stepAfterMove(steps, 1, -1, true)?.step.key, 'one')
  })

  test('stops at both ends', () => {
    assert.equal(stepAfterMove(steps, 2, 1, false), null)
    assert.equal(stepAfterMove(steps, 0, -1, false), null)
  })
})
