/**
 * Hand-written to match `src/*.js`. Keep them in step by hand — see README for
 * why this package is JS rather than TypeScript.
 */

export type ConditionOperator =
  | 'is_true'
  | 'is_false'
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'includes'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'

export interface InterviewPredicate {
  factKey: string
  op: ConditionOperator
  value?: unknown
}

export interface InterviewCondition {
  mode: 'all' | 'any'
  rules: InterviewPredicate[]
}

/** Answers folded into a flat bag, keyed by `factKey`. */
export type InterviewFacts = Record<string, unknown>

export interface LocalizedText {
  [locale: string]: string
}

export interface InterviewOption {
  id: string
  label: LocalizedText
  disqualifying?: boolean
}

/**
 * Only the parts the transforms actually read. The authoring model is richer;
 * this package deliberately depends on the smallest shape that lets it resolve
 * a document, so a change to authoring metadata is not a change here.
 */
export interface InterviewDefinitionLike {
  defaultLocale?: string
  steps?: Array<{
    questions?: Array<{ factKey: string; options?: InterviewOption[] }>
  }>
}

/** An absent or empty condition passes — "no condition" means "always". */
export function evaluateCondition(
  condition: InterviewCondition | undefined | null,
  facts: InterviewFacts,
): boolean

export function evaluatePredicate(
  predicate: InterviewPredicate | undefined | null,
  facts: InterviewFacts,
): boolean

export const CONDITION_ATTR: string
export const REPEAT_ATTR: string

/** Drops passages whose condition fails; unwraps the ones that pass. A
 *  MALFORMED condition keeps its text — corruption must not silently shorten a
 *  contract. */
export function resolveConditionalSpans(html: string, facts: InterviewFacts): string

/** Unwraps every conditional span, keeping all text. Proofreading and export. */
export function stripConditionalSpans(html: string): string

export function collectConditionalFactKeys(html: string): string[]

/**
 * Rewrite hook over conditional spans, for editors that must transform them
 * without owning a second scanner. `condition` is null when malformed;
 * `openTag` is the original tag, so unmodelled attributes survive a rewrite.
 */
export function mapConditionalSpans(
  html: string,
  handle: (condition: InterviewCondition | null, inner: string, openTag: string) => string,
): string

/** One copy per selected answer. An empty, unset or NON-LIST fact emits
 *  nothing. */
export function expandRepeatBlocks(
  html: string,
  facts: InterviewFacts,
  definition: InterviewDefinitionLike,
  locale?: string,
): string

/** Unwraps every repeat block, keeping ONE copy with its `{{item.*}}` tokens. */
export function stripRepeatBlocks(html: string): string

export function collectRepeatFactKeys(html: string): string[]

/** Rewrite hook over repeat blocks — see `mapConditionalSpans`. */
export function mapRepeatBlocks(
  html: string,
  handle: (factKey: string, inner: string, openTag: string) => string,
): string

/**
 * The whole transform, in the required order: repeats expand FIRST, conditions
 * resolve SECOND. Callers do not get to choose — reversed, a condition inside a
 * repeat is evaluated once against the un-copied original and that verdict is
 * duplicated across every copy, silently.
 *
 * Without `facts` AND `definition`, everything is kept once: the proofreading
 * read, and the honest one for a template no tenant has answered.
 */
export function assembleDocumentHtml(
  html: string,
  options?: {
    facts?: InterviewFacts
    definition?: InterviewDefinitionLike
    locale?: string
  },
): string

/** One answer, as the tenant gave it. `unknown` is a real third state, not a
 *  blank — forcing a guess into a legal document is worse than a recorded gap. */
export interface InterviewAnswer {
  value?: unknown
  unknown?: boolean
  note?: string
}

export interface InterviewOpenPoint {
  questionId: string
  factKey: string
  question: string
  note?: string
}

/**
 * The linear pass over an interview: fold answers in order, skip steps and
 * questions whose conditions fail, and report what is still outstanding.
 *
 * Two rules are load-bearing and both are asserted by the golden fixtures:
 * facts fold ONLY for questions actually asked, so a stale answer behind a
 * flipped gate cannot steer the document; and a disqualifier counts only once
 * its fact is WRITTEN, since `is_false` passes on an unset fact and would
 * otherwise end the interview on question one.
 *
 * The generics are deliberately loose — the two apps carry their own richer
 * question and step types, and this returns whatever it was given.
 */
export function runInterview<
  TQuestion extends { factKey: string } = { factKey: string },
  TStep extends { id: string; key: string } = { id: string; key: string },
>(
  definition: InterviewDefinitionLike | null | undefined,
  answers?: Record<string, InterviewAnswer>,
): {
  steps: Array<{ step: TStep; questions: TQuestion[] }>
  askedQuestions: TQuestion[]
  pendingQuestion: TQuestion | null
  pendingStepKey: string | null
  facts: InterviewFacts
  openPoints: InterviewOpenPoint[]
  disqualifiedBy: { when: InterviewCondition; message?: LocalizedText } | null
  terminal: 'not_applicable' | 'assemble' | null
  complete: boolean
  progress: { answered: number; total: number }
}

/**
 * The merge-field catalog both sides must agree on exactly. A code one knows
 * and the other does not is either a literal `{{…}}` printed in a signed
 * contract or a value that silently never appears.
 *
 * `resolvedAt` is the load-bearing field. `'generation'` is knowable when the
 * tenant finishes the questionnaire; `'signing'` is not, and must not be —
 * ONE assembled document is signed by MANY investors, so filling
 * `{{account.name}}` at generation bakes the first signer into all of them.
 * An unfilled signing-time token in a generated draft is therefore the correct
 * state, not a bug.
 *
 * Labels live in the apps, deliberately: they are localised UI copy that
 * changes without changing the contract.
 */
export type PlaceholderGroup =
  | 'offering'
  | 'tenant'
  | 'network'
  | 'firm'
  | 'account'
  | 'order'

export interface PlaceholderDef {
  /** With braces, exactly as written in the document: `{{offering.softcap}}`. */
  code: string
  group: PlaceholderGroup
  valueType: 'string' | 'number' | 'money' | 'date'
  resolvedAt: 'generation' | 'signing'
}

export const PLACEHOLDERS: PlaceholderDef[]

/** Every code, for a fast membership test against document text. */
export const PLACEHOLDER_CODES: string[]

export function findPlaceholder(code: string): PlaceholderDef | undefined

export function isSigningCode(code: string): boolean

/** The codes that must still be STANDING when a generated document reaches the
 *  review pipeline and the signature step. */
export function signingTimeCodes(): string[]

/** `{{wizard.<factKey>}}` → `factKey`, or null. Not in `PLACEHOLDERS` because it
 *  is not a fixed vocabulary — the codes exist only once an author writes the
 *  questions, and differ per template. Recognised by shape instead. */
export function wizardFactKey(code: string): string | null

/** What a known-but-valueless placeholder renders as. Not blank: a contract with
 *  a gap where the register number belongs reads as complete. */
export const MISSING_VALUE: string

/**
 * Fill generation-time placeholders, and ONLY those. Three rules, each because
 * breaking it yields a document that looks finished and is wrong:
 * signing-time tokens are left standing; an unknown token is left alone
 * (replacing it would destroy authored text); a known token with no value
 * renders `MISSING_VALUE`.
 */
export function substitutePlaceholders(
  html: string,
  options?: {
    values?: Record<string, unknown>
    facts?: InterviewFacts
    includeSigning?: boolean
  },
): string

/** Known codes still unfilled in this HTML — for linting, not for repair. */
export function unresolvedPlaceholders(html: string): string[]

/** A step and the questions visible in it — `runInterview`'s shape. */
export interface NavigableStep {
  step: { id: string; key: string }
  questions: Array<{ factKey: string; required?: boolean }>
}

/**
 * Resolves the held step ID to an index, falling back to the first step when it
 * has disappeared. Held as an ID and not an index because the step list is
 * DERIVED from the answers: answering one question can delete the page the
 * tenant is standing on, and an index into a shorter list points elsewhere.
 */
export function resolveStepIndex(steps: NavigableStep[], stepId: string | null): number

/** Required questions still unanswered. An explicit "don't know" COUNTS as
 *  answered — blocking on it would force a guess into a legal document. */
export function blockingQuestions<T extends { factKey: string; required?: boolean }>(
  questions: T[],
  answers: Record<string, { value?: unknown; unknown?: boolean }>,
): T[]

export function stepHoldingQuestion(steps: NavigableStep[], factKey: string): NavigableStep | undefined

/** Progress in PAGES, not questions: a question-based bar runs backwards when a
 *  step reveals five more, which reads as punishment for answering. */
export function stepProgress(
  steps: NavigableStep[],
  index: number,
): { current: number; total: number; ratio: number }

/** The step to move to, or null. Forward is gated on the page being finished;
 *  backward never is — a tenant must always be able to retreat. */
export function stepAfterMove(
  steps: NavigableStep[],
  index: number,
  delta: number,
  blocked: boolean,
): NavigableStep | null

/**
 * Seeds unanswered questions from what the platform already knows.
 *
 * `prefillKey` is a placeholder code without braces, so prefill and
 * substitution share one vocabulary. Only UNANSWERED questions are touched — a
 * corrected value must never be silently reverted. Returns the factKeys it
 * filled, so a caller can show them as confirm-or-change rather than as
 * answers the tenant gave.
 */
export function applyPrefill(
  definition: InterviewDefinitionLike,
  answers: Record<string, { value?: unknown; unknown?: boolean }>,
  values: Record<string, unknown>,
): { answers: Record<string, { value?: unknown; unknown?: boolean }>; prefilled: string[] }

export interface AiViolation {
  rule: string
  detail: string
}

/**
 * Checks an AI's proposed revision for the damage a human reviewer cannot see:
 * altered signature anchors, resolved signing-time placeholders, dropped or
 * invented wizard tokens, lost conditional/repeat markup, tokens split by
 * markup. Run it BEFORE applying, so a violation rejects a suggestion rather
 * than leaving a document to repair.
 */
export function checkAiRevision(before: string, after: string): { ok: boolean; violations: AiViolation[] }

/** The same rules as prompt text — kept beside the verifier so the two cannot
 *  drift into enforcing one thing and asking for another. */
export const AI_DOCUMENT_RULES: string[]

export type SignatureRole = "tenant" | "firm" | "investor" | "issuer"
export type SignatureFieldType = "signature" | "initials" | "name" | "date_signed" | "text" | "checkbox"

export interface SignatureRoleDef {
  role: SignatureRole
  /** Which document this role belongs to. A subscription is signed by the
   *  investor and the issuer; a mandate by the tenant and the firm. */
  situation: "mandate" | "subscription"
  requires?: string[]
  enabledBy?: string
  autoPlaced?: boolean
}

export const SIGNATURE_ROLES: readonly SignatureRole[]
export const SIGNATURE_ROLE_DEFS: SignatureRoleDef[]
export const SIGNATURE_FIELD_TYPES: readonly SignatureFieldType[]
export const ANCHOR_PATTERN: RegExp

/** Only the roles the given document can actually bind — offering all four
 *  everywhere is how an unsignable anchor reaches a contract. */
export function rolesForSituation(situation: "mandate" | "subscription"): SignatureRoleDef[]

export function rolesFor(requirement: string | undefined): Array<{
  def: SignatureRoleDef
  available: boolean
  reasonKey?: string
}>
export function availableRolesFor(requirement: string | undefined): SignatureRoleDef[]
export function defaultSignatureRole(): SignatureRole
export function signatureAnchor(role: SignatureRole, type: SignatureFieldType): string
/** Anchor roles in the html that no flow can bind — for linting. */
export function findUnknownAnchorRoles(html: string): string[]
