import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { applyPrefill } from '../src/index.js'

const question = (factKey, extra = {}) => ({
  id: `${factKey}_id`,
  factKey,
  answerType: 'text',
  plainQuestion: { de: factKey },
  ...extra,
})

const definition = {
  defaultLocale: 'de',
  steps: [
    {
      id: 's1',
      questions: [
        question('register_number', { prefillKey: 'tenant.register_number' }),
        question('register_court', { prefillKey: 'tenant.register_court' }),
        question('own_thought'), // no prefillKey — nothing can fill it
      ],
    },
  ],
}

const values = {
  '{{tenant.register_number}}': 'FN 123456a',
  '{{tenant.register_court}}': 'LG Wien',
}

describe('applyPrefill', () => {
  test('seeds an unanswered question from the platform value', () => {
    const { answers, prefilled } = applyPrefill(definition, {}, values)
    assert.deepEqual(answers.register_number, { value: 'FN 123456a' })
    assert.deepEqual(prefilled.sort(), ['register_court', 'register_number'])
  })

  // The bug that makes people stop trusting a form: correcting a value and
  // finding it reverted on the next load.
  test('NEVER overwrites an answer the tenant already gave', () => {
    const { answers, prefilled } = applyPrefill(
      definition,
      { register_number: { value: 'FN 999999z' } },
      values,
    )
    assert.deepEqual(answers.register_number, { value: 'FN 999999z' })
    assert.ok(!prefilled.includes('register_number'))
  })

  test('respects an explicit "don\'t know" as an answer', () => {
    const { answers, prefilled } = applyPrefill(
      definition,
      { register_number: { unknown: true } },
      values,
    )
    assert.deepEqual(answers.register_number, { unknown: true })
    assert.ok(!prefilled.includes('register_number'))
  })

  // Seeding "" would present a blank as though it had been confirmed.
  test('an empty or missing platform value is not an answer', () => {
    const { answers, prefilled } = applyPrefill(definition, {}, {
      '{{tenant.register_number}}': '   ',
      '{{tenant.register_court}}': null,
    })
    assert.equal(answers.register_number, undefined)
    assert.deepEqual(prefilled, [])
  })

  test('leaves questions with no prefillKey alone', () => {
    const { answers } = applyPrefill(definition, {}, values)
    assert.equal(answers.own_thought, undefined)
  })

  test('is a no-op on a definition with no questions', () => {
    assert.deepEqual(applyPrefill(null, { a: { value: 1 } }, values), {
      answers: { a: { value: 1 } },
      prefilled: [],
    })
  })

  test('does not mutate the answers it was given', () => {
    const original = {}
    applyPrefill(definition, original, values)
    assert.deepEqual(original, {})
  })
})
