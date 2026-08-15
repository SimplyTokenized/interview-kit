/**
 * Every merge field a document may contain, and WHEN each one is knowable.
 *
 * The list is here rather than in either app because both must agree on it
 * exactly: the editor offers these codes, and the backend substitutes them. A
 * code one side knows and the other does not is a token that reaches a signed
 * contract as literal text, or a value that silently never appears.
 *
 * LABELS ARE NOT HERE. They are localised UI copy, they change without changing
 * the contract, and shipping them would drag translations into a package the
 * backend imports. The apps attach their own.
 *
 * `resolvedAt` is the load-bearing field:
 *
 *   • 'generation' — knowable when the tenant finishes the questionnaire and
 *     the document is assembled: the offering, the issuer, the network, the
 *     firm.
 *   • 'signing' — NOT knowable then, and deliberately never asked in the
 *     questionnaire: who the investor is and what they subscribed for. One
 *     assembled document is signed by many investors, so these are per
 *     signature. A questionnaire question asking the tenant for the investor's
 *     name would bake one signer into a document meant for all of them.
 *
 * Which means assembly MUST leave signing-time tokens standing. An unresolved
 * `{{account.name}}` in a generated draft is the correct state, not a bug, and
 * anything reporting on unfilled fields has to exclude them.
 */

/** @typedef {{code: string, group: string, valueType: string, resolvedAt: 'generation'|'signing'}} PlaceholderDef */

/** @type {PlaceholderDef[]} */
export const PLACEHOLDERS = [
  { code: "{{offering.asset_name}}", group: "offering", valueType: "string", resolvedAt: "generation" },
  { code: "{{offering.asset_symbol}}", group: "offering", valueType: "string", resolvedAt: "generation" },
  { code: "{{offering.offering_type}}", group: "offering", valueType: "string", resolvedAt: "generation" },
  { code: "{{offering.main_currency}}", group: "offering", valueType: "string", resolvedAt: "generation" },
  { code: "{{offering.price_per_token}}", group: "offering", valueType: "money", resolvedAt: "generation" },
  { code: "{{offering.softcap}}", group: "offering", valueType: "money", resolvedAt: "generation" },
  { code: "{{offering.hardcap}}", group: "offering", valueType: "money", resolvedAt: "generation" },
  { code: "{{offering.minimum_investment}}", group: "offering", valueType: "money", resolvedAt: "generation" },
  { code: "{{offering.maximum_investment}}", group: "offering", valueType: "money", resolvedAt: "generation" },
  { code: "{{offering.public_start_date}}", group: "offering", valueType: "date", resolvedAt: "generation" },
  { code: "{{offering.closing_date}}", group: "offering", valueType: "date", resolvedAt: "generation" },
  { code: "{{offering.public_address}}", group: "offering", valueType: "string", resolvedAt: "generation" },
  { code: "{{offering.network}}", group: "offering", valueType: "string", resolvedAt: "generation" },
  { code: "{{offering.decimals}}", group: "offering", valueType: "number", resolvedAt: "generation" },
  { code: "{{tenant.name}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{tenant.legal_form}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{tenant.register_number}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{tenant.register_court}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{tenant.address_line}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{tenant.postal_code}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{tenant.city}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{tenant.country}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{tenant.vat}}", group: "tenant", valueType: "string", resolvedAt: "generation" },
  { code: "{{network.name}}", group: "network", valueType: "string", resolvedAt: "generation" },
  { code: "{{network.asset_manager_domain}}", group: "network", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.company_name}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.brand_name}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.address_line}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.postal_code}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.city}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.state}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.country}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.vat}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.contact_person}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{firm.contact_number}}", group: "firm", valueType: "string", resolvedAt: "generation" },
  { code: "{{account.name}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.first_name}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.last_name}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.email}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.mobile}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.address_line}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.postal_code}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.city}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.country}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.date_of_birth}}", group: "account", valueType: "date", resolvedAt: "signing" },
  { code: "{{account.account_type}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{account.company_name}}", group: "account", valueType: "string", resolvedAt: "signing" },
  { code: "{{order.amount}}", group: "order", valueType: "money", resolvedAt: "signing" },
  { code: "{{order.currency}}", group: "order", valueType: "string", resolvedAt: "signing" },
  { code: "{{order.number_of_tokens}}", group: "order", valueType: "number", resolvedAt: "signing" },
  { code: "{{order.price_per_token}}", group: "order", valueType: "money", resolvedAt: "signing" },
  { code: "{{order.date_signed}}", group: "order", valueType: "date", resolvedAt: "signing" },]

/** Every code, for a fast membership test against document text. */
export const PLACEHOLDER_CODES = PLACEHOLDERS.map((p) => p.code)

const BY_CODE = new Map(PLACEHOLDERS.map((p) => [p.code, p]))

export function findPlaceholder(code) {
  return BY_CODE.get(code)
}

/**
 * Tokens that must still be standing when a generated document reaches the
 * review pipeline and the signature step. The assembler substitutes everything
 * else; leaving these is the correct outcome.
 */
export function signingTimeCodes() {
  return PLACEHOLDERS.filter((p) => p.resolvedAt === "signing").map((p) => p.code)
}

export function isSigningCode(code) {
  return BY_CODE.get(code)?.resolvedAt === "signing"
}

/**
 * `{{wizard.<factKey>}}` — the interview's own answers.
 *
 * Not in the list because it is not a fixed vocabulary: the codes exist only
 * once an author writes the questions, and differ per template. Recognised by
 * shape instead.
 */
export const WIZARD_TOKEN = /^\{\{\s*wizard\.([a-z0-9_]+)\s*\}\}$/i

export function wizardFactKey(code) {
  const match = WIZARD_TOKEN.exec(String(code || ""))
  return match ? match[1] : null
}
