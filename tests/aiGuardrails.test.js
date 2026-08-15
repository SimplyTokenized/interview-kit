import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { AI_DOCUMENT_RULES, checkAiRevision } from '../src/index.js'

const rules = (before, after) => checkAiRevision(before, after).violations.map((v) => v.rule)

describe('checkAiRevision', () => {
  test('passes an edit that only changes prose', () => {
    const before = '<p>Der Anbieter haftet nicht.</p>{{sign:tenant.signature}}'
    const after = '<p>Der Anbieter haftet nur bei Vorsatz.</p>{{sign:tenant.signature}}'
    assert.deepEqual(checkAiRevision(before, after), { ok: true, violations: [] })
  })

  describe('signature anchors', () => {
    test('a removed anchor is a contract nobody can sign', () => {
      assert.deepEqual(
        rules('<p>x</p>{{sign:tenant.signature}}', '<p>x</p>'),
        ['signature_anchor_removed'],
      )
    })

    // An invented anchor becomes a signature box bound to no recipient, which
    // the backend writes with a null recipient and which fails at send time.
    test('an ADDED anchor is a violation too', () => {
      assert.deepEqual(rules('<p>x</p>', '<p>x</p>{{sign:firm.signature}}'), ['signature_anchor_added'])
    })

    test('notices one of several copies going missing', () => {
      const before = '{{sign:tenant.signature}} und {{sign:tenant.signature}}'
      assert.deepEqual(rules(before, '{{sign:tenant.signature}}'), ['signature_anchor_removed'])
    })

    test('whitespace inside the braces is not a change', () => {
      assert.equal(checkAiRevision('{{sign:tenant.signature}}', '{{ sign:tenant.signature }}').ok, true)
    })
  })

  describe('signing-time placeholders', () => {
    // The worst case here: it reads perfectly and bakes one investor into a
    // document meant for all of them.
    test('catches a signing token replaced with a literal value', () => {
      assert.deepEqual(
        rules('<p>Gezeichnet von {{account.name}}.</p>', '<p>Gezeichnet von Frau Meier.</p>'),
        ['signing_token_resolved'],
      )
    })

    test('allows a generation-time token to be resolved or moved', () => {
      assert.equal(checkAiRevision('<p>{{tenant.name}}</p>', '<p>Acme GmbH</p>').ok, true)
    })
  })

  describe('wizard answers', () => {
    test('catches a dropped answer', () => {
      assert.deepEqual(rules('<p>{{wizard.city}}</p>', '<p>Wien</p>'), ['wizard_token_removed'])
    })

    // No such question exists to answer it, so it renders as a marker in a
    // finished document.
    test('catches an invented answer', () => {
      assert.deepEqual(rules('<p>x</p>', '<p>{{wizard.invented}}</p>'), ['wizard_token_added'])
    })
  })

  describe('authoring markup', () => {
    // The likeliest failure of all: a model strips attributes it does not
    // understand, and a passage that applied to some clients now applies to
    // everybody — reading correctly the whole time.
    test('catches a conditional passage losing its span', () => {
      const before = '<span data-interview-condition="{}">Nur für Verbraucher.</span>'
      assert.deepEqual(rules(before, '<span>Nur für Verbraucher.</span>'), ['conditional_passage_lost'])
    })

    test('catches a repeat block losing its wrapper', () => {
      const before = '<div data-interview-repeat="recipients"><p>x</p></div>'
      assert.deepEqual(rules(before, '<div><p>x</p></div>'), ['repeat_block_lost'])
    })

    test('allows markup to be ADDED', () => {
      const after = '<span data-interview-condition="{}">a</span><span data-interview-condition="{}">b</span>'
      assert.equal(checkAiRevision('<span data-interview-condition="{}">a</span>', after).ok, true)
    })
  })

  // `{{buyer<strong>.name}}` stops matching the backend's regex entirely.
  test('catches a token interrupted by markup', () => {
    assert.deepEqual(
      rules('<p>{{tenant.name}}</p>', '<p>{{tenant.<strong>name</strong>}}</p>'),
      ['token_split_by_markup'],
    )
  })

  test('reports every violation at once rather than the first', () => {
    const before = '<span data-interview-condition="{}">{{wizard.a}}</span>{{sign:tenant.signature}}'
    const found = rules(before, '<span>gone</span>')
    assert.ok(found.includes('signature_anchor_removed'))
    assert.ok(found.includes('wizard_token_removed'))
    assert.ok(found.includes('conditional_passage_lost'))
  })

  test('handles empty input without throwing', () => {
    assert.equal(checkAiRevision('', '').ok, true)
    assert.equal(checkAiRevision(undefined, undefined).ok, true)
  })
})

describe('AI_DOCUMENT_RULES', () => {
  // Prompt and verifier drifting apart is how you enforce a rule the model was
  // never told — or, worse, tell it one that nothing enforces.
  test('states a rule for every class the verifier checks', () => {
    const text = AI_DOCUMENT_RULES.join(' ').toLowerCase()
    for (const needle of ['sign:', 'account.', 'wizard.', 'data-interview-condition', 'data-interview-repeat']) {
      assert.ok(text.includes(needle.toLowerCase()), needle)
    }
  })
})
