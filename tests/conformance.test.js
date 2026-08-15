import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { assembleDocumentHtml, runInterview } from '../src/index.js'

/**
 * The fixtures are the contract between the two implementations, so this is a
 * loop over data rather than a set of hand-written cases: adding a rule means
 * adding a fixture, which both repositories then assert against automatically.
 * A case that only exists here is a rule only one side knows.
 */
const golden = JSON.parse(readFileSync(new URL('../src/fixtures/golden.json', import.meta.url), 'utf8'))

describe('golden fixtures', () => {
  for (const testCase of golden.cases) {
    test(testCase.name, () => {
      assert.equal(assembleDocumentHtml(testCase.html, testCase.options), testCase.expected)
    })
  }

  test('every case leaves no authoring markup behind', () => {
    for (const testCase of golden.cases) {
      const out = assembleDocumentHtml(testCase.html, testCase.options)
      assert.ok(!out.includes('data-interview-condition'), testCase.name)
      assert.ok(!out.includes('data-interview-repeat'), testCase.name)
    }
  })
})

describe('golden runs', () => {
  const { definition, cases } = golden.runs

  for (const runCase of cases) {
    test(runCase.name, () => {
      const result = runInterview(definition, runCase.answers)
      const { expect: want } = runCase

      // Each assertion is opt-in per case, so a fixture can pin exactly the
      // property it is about rather than restating the whole result — which
      // would make every case break when an unrelated field is added.
      if (want.facts !== undefined) assert.deepEqual(result.facts, want.facts)
      if (want.pendingFactKey !== undefined) {
        assert.equal(result.pendingQuestion?.factKey ?? null, want.pendingFactKey)
      }
      if (want.complete !== undefined) assert.equal(result.complete, want.complete)
      if (want.terminal !== undefined) assert.equal(result.terminal, want.terminal)
      if (want.askedFactKeys !== undefined) {
        assert.deepEqual(result.askedQuestions.map((q) => q.factKey), want.askedFactKeys)
      }
      if (want.openPointFactKeys !== undefined) {
        assert.deepEqual(result.openPoints.map((p) => p.factKey), want.openPointFactKeys)
      }
    })
  }

  test('progress never counts a question that was not asked', () => {
    for (const runCase of cases) {
      const result = runInterview(definition, runCase.answers)
      assert.ok(result.progress.answered <= result.progress.total, runCase.name)
      assert.equal(result.progress.total, result.askedQuestions.length, runCase.name)
    }
  })
})
