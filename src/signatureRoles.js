/**
 * Who a `{{sign:<role>.<type>}}` anchor belongs to.
 *
 * ── The trap this file exists to close ────────────────────────────────────
 * The backend does NOT validate anchor roles. `signatureAnchors.js` matches
 * `[a-z0-9_-]+` and checks only the field TYPE against its allow-list; the role
 * is reconciled later by plain string equality against the envelope's recipient
 * refs (`envelopeService.js`, `recipientIdsByRef`). A role that matches nothing
 * does not raise — it writes a `sign_fields` row with `recipient_id = NULL`.
 * The document renders with a signature box that no recipient owns and nobody
 * can ever sign, and the first person to notice is the counterparty who cannot
 * complete the signing.
 *
 * So a free-text role box is a typo generator pointed at a silent failure. This
 * is the closed list of roles that actually resolve.
 *
 * ── Two roles named "role", and they are not the same ─────────────────────
 * `sign_recipients.role` is a separate, procedural column — `signer`,
 * `approver`, `cc`, `viewer` — describing HOW someone acts on an envelope. It
 * never appears in an anchor. The values below are recipient *refs*.
 *
 * ── Why `client` is not here ──────────────────────────────────────────────
 * The editor used to default the role to `client`. `client` is not a recipient
 * anywhere in the backend: it is a value of `contract_templates.
 * signature_requirement` ('none' | 'client' | 'client_and_firm'), i.e. WHETHER
 * a signature is needed, not WHOSE. Every anchor written with it produced an
 * orphan field.
 */


export const SIGNATURE_ROLES = ['tenant', 'firm', 'investor', 'issuer']

/**
 * The roles with a working resolver.
 *
 * `issuer` joined them once `signerResolution.resolveIssuerSigner` landed: the
 * tenant's own signatory, picked the same way the provider's is (admins first,
 * then oldest active membership). Before that, an `issuer` anchor was silently
 * not placed.
 *
 * `fixed` is still absent by design — it is not a party the platform knows, it
 * is an explicit address on the layout's role entry, so it belongs to whatever
 * configures `sign_templates.roles`, not to a role picker in a document editor.
 */
export const SIGNATURE_ROLE_DEFS = [
  // Situation 1 — the law-firm mandate. `start-law-firm-mandate-signing.js`
  // creates recipients with refs `tenant` (order 1) and `firm` (order 2); the
  // counter-signature is expressed by ORDER, both are procedurally `signer`.
  // The tenant's own anchors are auto-appended too when a template has none
  // at all (:92) — a document nobody can sign is never worth failing over.
  { role: 'tenant', situation: 'mandate', autoPlaced: true },
  // The mandate handler appends "Für die Kanzlei / For the firm" plus the
  // signature and date anchors when a counter-signed template carries none
  // (`withSignatureAnchor`, :97). So an author only places this by hand to
  // control WHERE the firm signs, not to make the firm sign at all.
  { role: 'firm', situation: 'mandate', requires: ['client_and_firm'], enabledBy: 'client_and_firm', autoPlaced: true },
  // Situation 2 — the subscription. Bound via `sign_templates.roles`:
  // `recipient_kind: 'investor'` resolves from the order's account,
  // `recipient_kind: 'issuer'` from the tenant's own users.
  { role: 'investor', situation: 'subscription' },
  { role: 'issuer', situation: 'subscription' },
]

/**
 * Every role, with whether this template can actually bind it.
 *
 * Unavailable roles are RETURNED, not filtered out. Silently omitting `firm`
 * from a `client`-only template made it look like the provider signature did
 * not exist; showing it disabled, with the setting to change, is the difference
 * between "missing feature" and "one switch away".
 *
 * The stakes for `firm` specifically: the mandate handler does NOT drop an
 * unbindable firm anchor, it reassigns it —
 * `recipientRef: firmSigner && role === 'firm' ? 'firm' : 'tenant'`. So on a
 * template without a firm signer, a block labelled "Für die Kanzlei" is signed
 * by the CLIENT. Not an empty box: the wrong party's signature in the right
 * party's place.
 */
export function rolesFor(requirement) {
  return SIGNATURE_ROLE_DEFS.map((def) => {
    const available = !def.requires || Boolean(requirement && def.requires.includes(requirement))
    return available ? { def, available } : { def, available, reasonKey: `signatureRoleUnavailable.${def.role}` }
  })
}

/** Just the roles this template can bind — for defaulting and validation. */
export function availableRolesFor(requirement) {
  return rolesFor(requirement).filter((option) => option.available).map((option) => option.def)
}

/**
 * The role to preselect.
 *
 * `tenant` for anything a firm agrees with its client, because that is the
 * party who signs first in the only fully-wired flow.
 */
export function defaultSignatureRole() {
  return 'tenant'
}

/** Field types, mirroring `ANCHOR_FIELD_TYPES` and the `sign_fields.type` CHECK. */
export const SIGNATURE_FIELD_TYPES = ['signature', 'initials', 'name', 'date_signed', 'text', 'checkbox']

/** Mirrors the backend's own anchor regex, so the editor cannot emit a token
 *  the renderer will treat as literal text. */
export const ANCHOR_PATTERN = /\{\{\s*sign:([a-z0-9_-]+)\.([a-z_]+)\s*\}\}/gi

export function signatureAnchor(role, type) {
  return `{{sign:${role}.${type}}}`
}

/** Anchors in this HTML whose role resolves to no recipient — the silent
 *  orphan case, surfaced so it can be linted rather than discovered at signing. */
export function findUnknownAnchorRoles(html) {
  const known = new Set<string>(SIGNATURE_ROLES)
  const found = new Set()
  let match
  const pattern = new RegExp(ANCHOR_PATTERN.source, 'gi')

  while ((match = pattern.exec(html ?? '')) !== null) {
    const role = match[1]?.toLowerCase()
    if (role && !known.has(role)) found.add(role)
  }
  return Array.from(found)
}

/**
 * The roles a given DOCUMENT can carry.
 *
 * A subscription contract is signed by the investor and countersigned by the
 * issuer; a law-firm mandate by the tenant and the firm. Offering all four
 * everywhere is how an author places `{{sign:firm.signature}}` in an investor
 * contract — an anchor no recipient in that flow can bind, which the backend
 * writes with a null recipient and which fails silently at send time.
 *
 * @param {'mandate'|'subscription'} situation
 */
export function rolesForSituation(situation) {
  return SIGNATURE_ROLE_DEFS.filter((def) => def.situation === situation)
}
