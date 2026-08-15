/**
 * Expanding `<div data-interview-repeat>` — repeating passages.
 *
 * Same bargain as its sibling: one algorithm, two runtimes, so what the lawyer
 * proofread is what the tenant receives.
 *
 * ORDER MATTERS at assembly and is the caller's responsibility: expand repeats
 * FIRST, resolve conditional spans SECOND. A conditional inside a repeated
 * block has to be copied before it is evaluated, once per copy; the other way
 * round evaluates once against the un-copied original and then duplicates
 * whatever that decided.
 *
 * Preserved behaviours worth not "tidying" later:
 *
 *   • An empty, unset, or NON-LIST fact emits nothing. A repeat that has
 *     quietly degenerated into a single block is far harder to notice than one
 *     that is missing, and enumerating no items is honestly no passage.
 *   • `{{item.label}}` falls back to the raw option id when the option no
 *     longer exists, so a deleted answer shows as a visible slug rather than an
 *     empty heading.
 *
 * v1 limitation: conditions inside a repeated block read GLOBAL facts, not the
 * current item.
 */

export const REPEAT_ATTR = "data-interview-repeat";

const DIV_ANY = /<\/?div\b[^>]*>/gi;
const DIV_OPEN = /<div\b[^>]*>/gi;

const decodeAttribute = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function readFactKey(tag) {
  const match = new RegExp(
    `${REPEAT_ATTR}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    "i"
  ).exec(tag);
  const value = match?.[2] ?? match?.[3];
  return value ? decodeAttribute(value) : undefined;
}

function findMatchingClose(html, from) {
  DIV_ANY.lastIndex = from;
  let depth = 0;
  let match;

  while ((match = DIV_ANY.exec(html)) !== null) {
    const isClose = match[0].startsWith("</");
    if (isClose) {
      if (depth === 0)
        return { contentEnd: match.index, after: match.index + match[0].length };
      depth -= 1;
    } else if (!match[0].endsWith("/>")) {
      depth += 1;
    }
  }
  return { contentEnd: html.length, after: html.length };
}

function walk(html, handle) {
  let out = "";
  let cursor = 0;

  for (;;) {
    DIV_OPEN.lastIndex = cursor;
    let open = null;
    let factKey;

    // Ordinary divs pass through untouched.
    for (;;) {
      const candidate = DIV_OPEN.exec(html);
      if (!candidate) break;
      const found = readFactKey(candidate[0]);
      if (found !== undefined) {
        open = candidate;
        factKey = found;
        break;
      }
    }

    if (!open || factKey === undefined) {
      out += html.slice(cursor);
      return out;
    }

    out += html.slice(cursor, open.index);
    const contentStart = open.index + open[0].length;
    const { contentEnd, after } = findMatchingClose(html, contentStart);
    out += handle(factKey, html.slice(contentStart, contentEnd), open[0]);
    cursor = after;
  }
}

const ITEM_TOKEN = /\{\{\s*item\.(label|value)\s*\}\}/gi;

const resolveLocalized = (text, locale, defaultLocale) => {
  if (!text) return "";
  return text[locale] ?? text[defaultLocale] ?? Object.values(text)[0] ?? "";
};

/**
 * Rewrites every repeat block through `handle`, leaving ordinary divs and
 * surrounding text untouched. Same reason as `mapConditionalSpans`: an editor
 * transforming these blocks must not carry its own copy of the scanner.
 *
 * `handle` receives the bound fact key, the inner html, and the ORIGINAL open
 * tag.
 *
 * @param {string} html
 * @param {(factKey: string, inner: string, openTag: string) => string} handle
 */
export function mapRepeatBlocks(html, handle) {
  if (!html || !html.includes(REPEAT_ATTR)) return html;
  return walk(html, handle);
}

/**
 * Expands every repeat block against a run's facts.
 *
 * @param {string} html
 * @param {Record<string, unknown>} facts
 * @param {{steps?: Array<object>, defaultLocale?: string}} definition
 * @param {string} [locale]
 */
export function expandRepeatBlocks(html, facts, definition, locale) {
  if (!html || !html.includes(REPEAT_ATTR)) return html;

  const defaultLocale = definition?.defaultLocale || "de";
  const activeLocale = locale || defaultLocale;

  const optionsByFact = new Map();
  for (const step of definition?.steps ?? []) {
    for (const question of step?.questions ?? []) {
      if (question?.options?.length)
        optionsByFact.set(question.factKey, question.options);
    }
  }

  return walk(html, (factKey, inner) => {
    const value = facts?.[factKey];
    if (!Array.isArray(value) || !value.length) return "";

    const options = optionsByFact.get(factKey) ?? [];
    return value
      .map((rawId) => {
        const id = String(rawId);
        const option = options.find((candidate) => candidate.id === id);
        const label = option
          ? resolveLocalized(option.label, activeLocale, defaultLocale) || id
          : id;
        return inner.replace(ITEM_TOKEN, (_match, field) =>
          field.toLowerCase() === "value" ? id : label
        );
      })
      .join("");
  });
}

/** Unwraps every repeat block, keeping ONE copy of its content. */
export function stripRepeatBlocks(html) {
  if (!html || !html.includes(REPEAT_ATTR)) return html;
  return walk(html, (_factKey, inner) => inner);
}

/** Every fact a repeat block iterates over. */
export function collectRepeatFactKeys(html) {
  const keys = new Set();
  if (!html) return [];
  walk(html, (factKey, inner) => {
    if (factKey) keys.add(factKey);
    return inner;
  });
  return Array.from(keys);
}
