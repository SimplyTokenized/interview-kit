import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  MISSING_VALUE,
  signingTimeCodes,
  substitutePlaceholders,
  unresolvedPlaceholders,
} from '../src/index.js'

describe('substitutePlaceholders', () => {
  test('fills a generation-time token from the supplied values', () => {
    assert.equal(
      substitutePlaceholders('<p>{{tenant.name}}</p>', { values: { '{{tenant.name}}': 'Acme GmbH' } }),
      '<p>Acme GmbH</p>'
    )
  })

  // The rule that stops one investor being baked into a document meant for
  // many: an assembled draft is signed repeatedly, by different people.
  test('LEAVES signing-time tokens standing at generation', () => {
    const html = '<p>{{account.name}} zeichnet {{order.amount}}</p>'
    assert.equal(substitutePlaceholders(html, { values: { '{{account.name}}': 'Frau Meier' } }), html)
  })

  test('fills them only when the signer is known', () => {
    assert.equal(
      substitutePlaceholders('<p>{{account.name}}</p>', {
        values: { '{{account.name}}': 'Frau Meier' },
        includeSigning: true,
      }),
      '<p>Frau Meier</p>'
    )
  })

  // Replacing an unrecognised token would destroy authored text; leaving it
  // visible makes the mistake findable.
  test('leaves an unknown token exactly as written', () => {
    assert.equal(substitutePlaceholders('<p>{{not_a_real_token}}</p>'), '<p>{{not_a_real_token}}</p>')
  })

  // A blank where the register number belongs reads as complete and is not.
  test('renders a known token with no value as a visible marker', () => {
    assert.equal(substitutePlaceholders('<p>{{tenant.register_number}}</p>'), `<p>${MISSING_VALUE}</p>`)
    assert.equal(
      substitutePlaceholders('<p>{{tenant.vat}}</p>', { values: { '{{tenant.vat}}': '   ' } }),
      `<p>${MISSING_VALUE}</p>`
    )
  })

  describe('wizard answers', () => {
    test('fills from the run facts', () => {
      assert.equal(
        substitutePlaceholders('<p>{{wizard.city}}</p>', { facts: { city: 'Wien' } }),
        '<p>Wien</p>'
      )
    })

    test('renders a multi-select as a readable list, not a comma-joined accident', () => {
      assert.equal(
        substitutePlaceholders('<p>{{wizard.recipients}}</p>', { facts: { recipients: ['hosting', 'payment'] } }),
        '<p>hosting, payment</p>'
      )
    })

    test('renders a yes/no as words', () => {
      assert.equal(substitutePlaceholders('{{wizard.x}}', { facts: { x: true } }), 'Ja')
      assert.equal(substitutePlaceholders('{{wizard.x}}', { facts: { x: false } }), 'Nein')
    })

    test('an unanswered question is a visible marker', () => {
      assert.equal(substitutePlaceholders('{{wizard.missing}}', { facts: {} }), MISSING_VALUE)
      assert.equal(substitutePlaceholders('{{wizard.empty}}', { facts: { empty: [] } }), MISSING_VALUE)
    })

    test('tolerates whitespace inside the braces', () => {
      assert.equal(substitutePlaceholders('{{ wizard.x }}', { facts: { x: 'y' } }), 'y')
    })
  })
})

describe('unresolvedPlaceholders', () => {
  test('reports generation-time tokens still present', () => {
    assert.deepEqual(unresolvedPlaceholders('<p>{{tenant.name}} {{tenant.vat}}</p>'), [
      '{{tenant.name}}',
      '{{tenant.vat}}',
    ])
  })

  // They are SUPPOSED to still be there — reporting them would train people to
  // ignore the report.
  test('never reports signing-time tokens', () => {
    const html = signingTimeCodes().join(' ')
    assert.deepEqual(unresolvedPlaceholders(html), [])
  })

  test('ignores tokens it does not own', () => {
    assert.deepEqual(unresolvedPlaceholders('<p>{{something_else}}</p>'), [])
  })

  test('reports each token once', () => {
    assert.deepEqual(unresolvedPlaceholders('{{tenant.city}} {{tenant.city}}'), ['{{tenant.city}}'])
  })
})
