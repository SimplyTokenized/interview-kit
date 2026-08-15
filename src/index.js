/**
 * The rules that decide what a generated contract contains.
 *
 * Two consumers, one implementation: the network manager's authoring UI (so a
 * lawyer proofreads the real thing) and the backend's assembler (so a tenant
 * receives it). See README for why this is plain JS with hand-written types.
 */

export { evaluatePredicate, evaluateCondition } from './conditions.js'
export {
  CONDITION_ATTR,
  resolveConditionalSpans,
  stripConditionalSpans,
  collectConditionalFactKeys,
  mapConditionalSpans,
} from './conditionalText.js'
export {
  REPEAT_ATTR,
  expandRepeatBlocks,
  stripRepeatBlocks,
  collectRepeatFactKeys,
  mapRepeatBlocks,
} from './repeatBlocks.js'
export { assembleDocumentHtml } from './assembleDocument.js'
export { runInterview } from './runInterview.js'
export {
  PLACEHOLDERS,
  PLACEHOLDER_CODES,
  findPlaceholder,
  isSigningCode,
  signingTimeCodes,
  wizardFactKey,
} from './placeholders.js'
export { MISSING_VALUE, substitutePlaceholders, unresolvedPlaceholders } from './substitute.js'
export {
  blockingQuestions,
  resolveStepIndex,
  stepAfterMove,
  stepHoldingQuestion,
  stepProgress,
} from './navigation.js'
export { applyPrefill } from './prefill.js'
export { AI_DOCUMENT_RULES, checkAiRevision } from './aiGuardrails.js'
export {
  ANCHOR_PATTERN,
  SIGNATURE_FIELD_TYPES,
  SIGNATURE_ROLES,
  SIGNATURE_ROLE_DEFS,
  availableRolesFor,
  defaultSignatureRole,
  findUnknownAnchorRoles,
  rolesFor,
  rolesForSituation,
  signatureAnchor,
} from './signatureRoles.js'
