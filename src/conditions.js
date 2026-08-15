/**
 * Evaluating an interview condition against a run's facts.
 *
 * THE operator table — there is deliberately only one. The authoring client
 * uses it to decide which passages an author SEES; the backend assembler uses
 * it to decide which ones a tenant GETS. When those were two implementations,
 * a disagreement between them would have meant a lawyer approving a document
 * that is not the document that ships, with nothing to report it.
 *
 * Several behaviours below look sloppy and are not:
 *
 *   • `is_false` passes on an UNSET fact. Deliberate: an unanswered yes/no is
 *     not yes, and a clause guarded by "unless X" must appear until someone
 *     says X. (The client's disqualifier check deliberately does NOT use this
 *     rule — see `disqualifierMatches` there — but that is about ending an
 *     interview, not about rendering.)
 *   • Comparisons go through `String(...)`, so `eq` matches an option id
 *     whether the answer arrived as a string or a number.
 *   • `in` asks whether a single answer is one of several allowed values;
 *     `includes` asks whether a chosen SET contains one option. They are not
 *     interchangeable and swapping them silently produces a rule that never
 *     fires.
 *
 * An absent or empty condition PASSES — "no condition" means "always".
 */

const asArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
};

const asNumber = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
};

/**
 * @param {{factKey?: string, op?: string, value?: unknown}|undefined} predicate
 * @param {Record<string, unknown>} facts
 */
export function evaluatePredicate(predicate, facts) {
  if (!predicate?.factKey) return true;
  const fact = facts?.[predicate.factKey];
  const { op, value } = predicate;

  switch (op) {
    case "is_true":
      return fact === true || fact === "true";
    case "is_false":
      return fact === false || fact === "false" || fact === undefined;
    case "eq":
      return String(fact ?? "") === String(value ?? "");
    case "neq":
      return String(fact ?? "") !== String(value ?? "");
    case "in":
      return asArray(value).includes(String(fact ?? ""));
    case "not_in":
      return !asArray(value).includes(String(fact ?? ""));
    case "includes":
      return asArray(fact).includes(String(value ?? ""));
    case "lt":
      return asNumber(fact) < asNumber(value);
    case "lte":
      return asNumber(fact) <= asNumber(value);
    case "gt":
      return asNumber(fact) > asNumber(value);
    case "gte":
      return asNumber(fact) >= asNumber(value);
    default:
      // An operator this build does not know is not a licence to guess. A rule
      // that cannot be evaluated must not silently include the passage.
      return false;
  }
}

/**
 * @param {{mode?: string, rules?: Array<object>}|undefined} condition
 * @param {Record<string, unknown>} facts
 */
export function evaluateCondition(condition, facts) {
  if (!condition?.rules?.length) return true;
  return condition.mode === "any"
    ? condition.rules.some((rule) => evaluatePredicate(rule, facts))
    : condition.rules.every((rule) => evaluatePredicate(rule, facts));
}
