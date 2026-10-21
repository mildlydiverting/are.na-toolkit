// Pure logic for the block metadata editor: types, validation, diffs and the tag list format.
// No DOM. Plan: _claude/arena-palimpsest-v2-editing-and-tagging-plan.md (§4.2, §4.3, §5, §6).

export const META_KEY_PATTERN = /^[A-Za-z0-9_]{1,40}$/;
export const META_MAX_KEYS = 50;
export const META_MAX_BYTES = 32 * 1024;
export const META_MAX_VALUE_CHARS = 2000;

// Finite, and if it is a whole number, inside JavaScript's safe range.
const isSafeNumeric = (v) => Number.isFinite(v) && (!Number.isInteger(v) || Number.isSafeInteger(v));

// A JSON array string such as '["a","b"]' (goby.garden's multi-select encoding), or null.
function jsonArrayItems(text) {
  const t = String(text).trim();
  if (!t.startsWith('[') || !t.endsWith(']')) return null;
  try {
    const arr = JSON.parse(t);
    return Array.isArray(arr) && arr.every((x) => typeof x === 'string' || typeof x === 'number')
      ? arr.map(String)
      : null;
  } catch {
    return null;
  }
}

// A JSON array string, or (older tags) a string made only of "- item" lines, blank lines ignored.
function looksLikeList(text) {
  if (typeof text !== 'string') return false;
  if (jsonArrayItems(text)) return true;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  return lines.length > 0 && lines.every((l) => /^\s*-(\s|$)/.test(l));
}

// 'text' | 'number' | 'checkbox' | 'list'. Numbers outside the safe range are Text, so they are never re-sent as numbers.
export function detectType(value) {
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') return isSafeNumeric(value) ? 'number' : 'text';
  if (typeof value === 'string' && looksLikeList(value)) return 'list';
  return 'text';
}

// null when fine, otherwise a plain-language message.
export function validateKey(key, existingKeys = []) {
  const k = String(key ?? '');
  if (!k) return 'Give the property a name.';
  if (!META_KEY_PATTERN.test(k)) {
    return k.length > 40
      ? 'Names can be at most 40 characters.'
      : 'Names can only use letters, numbers and underscores.';
  }
  if (new Set(existingKeys).has(k)) return `There is already a property called ${k}.`;
  return null;
}

// ---- Tags: a JSON array written as text, e.g. ["journal", "silly thing"] ----
// are.na values are scalar, so the array lives inside one string. Older bullet lists
// ("- a\n- b") are still read, and are rewritten as JSON the next time the value is edited.

function unquoteTag(s) {
  const m = /^"(.*)"$/.exec(s);
  if (m) return m[1].replace(/\\(["\\])/g, '$1');
  const q = /^'(.*)'$/.exec(s);
  return q ? q[1].replace(/''/g, "'") : s;
}

const cleanTag = (t) => String(t).trim().replace(/ {2,}/g, ' ');

// Text (JSON array string, or an older bullet list) -> array of tags.
export function parseList(text) {
  if (text == null) return [];
  const fromJson = jsonArrayItems(text);
  const raw = fromJson
    ? fromJson
    : String(text)
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '')
        .map((l) => unquoteTag(l.replace(/^\s*-\s?/, '').trim()));
  return dedupe(raw.map(cleanTag).filter(Boolean));
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Array of tags -> '["a", "b"]'. Trims, collapses spaces, drops empties and case-insensitive duplicates.
export function serialiseList(items) {
  const tags = dedupe((items || []).map(cleanTag).filter(Boolean));
  return `[${tags.map((t) => JSON.stringify(t)).join(', ')}]`;
}

// ---- Values and type changes ----

// raw: what the person typed or chose (string, boolean, number, or for lists an array or text).
// -> { ok: true, value } or { ok: false, message }
export function validateValue(type, raw) {
  if (type === 'checkbox') {
    if (typeof raw === 'boolean') return { ok: true, value: raw };
    const s = String(raw).trim().toLowerCase();
    if (s === 'true' || s === 'false') return { ok: true, value: s === 'true' };
    return { ok: false, message: 'Choose on or off.' };
  }
  if (type === 'number') {
    const s = String(raw ?? '').trim();
    if (s === '') return { ok: false, message: 'Enter a number.' };
    const n = Number(s);
    if (!Number.isFinite(n)) return { ok: false, message: 'Not a number. Change the value first.' };
    if (Number.isInteger(n) && !Number.isSafeInteger(n)) {
      return { ok: false, message: 'Too large to store as a number safely. Keep it as Text.' };
    }
    return { ok: true, value: n };
  }
  if (type === 'list') {
    const text = Array.isArray(raw) ? serialiseList(raw) : serialiseList(parseList(raw));
    if (text.length > META_MAX_VALUE_CHARS) {
      return { ok: false, message: `Too many tags for one are.na value (limit ${META_MAX_VALUE_CHARS} characters). Currently ${text.length}.` };
    }
    return { ok: true, value: text };
  }
  const s = String(raw ?? '');
  if (s.length > META_MAX_VALUE_CHARS) {
    return { ok: false, message: `Text can be at most ${META_MAX_VALUE_CHARS} characters. Currently ${s.length}.` };
  }
  return { ok: true, value: s };
}

// Change a value from one type to another.
// -> { ok: true, value, lossy } (lossy: show the "your data will be adapted" warning) or { ok: false, message }
export function coerce(fromType, toType, value) {
  if (fromType === toType) return { ok: true, value, lossy: false };

  // Everything else goes through its text form.
  const asText = fromType === 'list' ? value : String(value ?? '');

  if (toType === 'text') return { ok: true, value: asText, lossy: false };

  if (toType === 'list') {
    const items = fromType === 'list' ? parseList(value) : asText.split(/[,\n]/).map(cleanTag).filter(Boolean);
    const out = validateValue('list', items);
    if (!out.ok) return out;
    return { ok: true, value: out.value, lossy: out.value !== asText };
  }

  // A list can become a number or checkbox only when it has exactly one item.
  let single = asText;
  if (fromType === 'list') {
    const items = parseList(value);
    if (items.length !== 1) return { ok: false, message: 'A list with several items cannot become a single value. Remove items first.' };
    single = items[0];
  }

  if (toType === 'number') {
    if (fromType === 'checkbox') return { ok: true, value: value ? 1 : 0, lossy: true };
    const out = validateValue('number', single);
    return out.ok ? { ok: true, value: out.value, lossy: fromType === 'list' } : out;
  }

  if (toType === 'checkbox') {
    if (fromType === 'number') return { ok: true, value: value !== 0, lossy: true };
    const s = single.trim().toLowerCase();
    if (s === 'true' || s === 'false') return { ok: true, value: s === 'true', lossy: fromType === 'list' };
    return { ok: false, message: 'Not true or false. Change the value first.' };
  }

  return { ok: false, message: 'Unknown type.' };
}

// ---- Comparing ----

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const same = (a, b) => Object.is(a, b);

// The metadata to send: added or changed keys as they are in `edited`, removed keys as null.
// Unchanged keys are left out, so values we never touched keep their original type. {} when nothing differs.
export function buildPatch(original, edited) {
  const orig = original || {};
  const next = edited || {};
  const patch = {};
  for (const key of Object.keys(next)) {
    if (!has(orig, key) || !same(orig[key], next[key])) patch[key] = next[key];
  }
  for (const key of Object.keys(orig)) {
    if (!has(next, key)) patch[key] = null;
  }
  return patch;
}

// For the review panel: { added: [{key, value, type}], changed: [{key, from, to, fromType, toType}], removed: [{key, value, type}] }
export function diffMetadata(original, edited) {
  const orig = original || {};
  const next = edited || {};
  const out = { added: [], changed: [], removed: [] };
  for (const key of Object.keys(next)) {
    if (!has(orig, key)) {
      out.added.push({ key, value: next[key], type: detectType(next[key]) });
    } else if (!same(orig[key], next[key])) {
      out.changed.push({
        key, from: orig[key], to: next[key],
        fromType: detectType(orig[key]), toType: detectType(next[key]),
      });
    }
  }
  for (const key of Object.keys(orig)) {
    if (!has(next, key)) out.removed.push({ key, value: orig[key], type: detectType(orig[key]) });
  }
  return out;
}

// Whole-block limits: 50 keys, 32KB. -> { ok, keyCount, bytes, problems: string[] }
export function checkLimits(metadata) {
  const meta = metadata || {};
  const keyCount = Object.keys(meta).length;
  const bytes = new TextEncoder().encode(JSON.stringify(meta)).length;
  const problems = [];
  if (keyCount > META_MAX_KEYS) problems.push(`A block can have at most ${META_MAX_KEYS} properties. This one has ${keyCount}.`);
  if (bytes > META_MAX_BYTES) problems.push(`Metadata can be at most 32KB in total. This is ${(bytes / 1024).toFixed(1)}KB.`);
  return { ok: problems.length === 0, keyCount, bytes, problems };
}
