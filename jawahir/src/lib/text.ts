export interface Span {
  s: string;
  b: boolean;
  i: boolean;
  /** index of the footnote this span points to (tappable marker) */
  note?: number;
}

/** Inline markup produced by the extractor: \x01 toggles bold, \x02 toggles italic. */
export function parseMarkup(x: string): Span[] {
  const out: Span[] = [];
  let b = false;
  let i = false;
  let cur = '';
  const push = () => {
    if (cur) out.push({ s: cur, b, i });
    cur = '';
  };
  for (let k = 0; k < x.length; k++) {
    const c = x[k];
    if (c === '\x01') {
      push();
      b = !b;
    } else if (c === '\x02') {
      push();
      i = !i;
    } else if (c === '\x03') {
      // footnote marker: \x03<note index>\x04<label>\x05
      push();
      const mid = x.indexOf('\x04', k);
      const end = x.indexOf('\x05', mid);
      if (mid > 0 && end > 0) {
        out.push({ s: x.slice(mid + 1, end), b, i, note: parseInt(x.slice(k + 1, mid), 10) });
        k = end;
      }
    } else cur += c;
  }
  push();
  return out;
}

export function stripMarkup(x: string) {
  return x.replace(/\x03\d+\x04[^\x05]*\x05/g, '').replace(/[\x01\x02]/g, '');
}

const DIACRITICS = /[̀-ͯ]/g;

/** Lower-cases and removes accents while keeping the string length (1 char -> 1 char), so offsets stay valid. */
export function fold(s: string) {
  let out = '';
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '’' || c === '‘' || c === '`') {
      out += "'";
      continue;
    }
    let f = c.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
    if (f.length !== 1) f = f.length ? f[0] : c;
    out += f;
  }
  return out;
}

export function queryTerms(q: string) {
  return fold(q)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Index of the first occurrence of `t` in the folded string `f` that starts at a word boundary. */
export function indexOfWord(f: string, t: string, from = 0) {
  // terms of 1-2 letters must match a whole word ("al" must not match "Allah"); longer ones match word starts
  const whole = t.length < 3;
  let at = f.indexOf(t, from);
  while (at >= 0 && ((at > 0 && WORD_CHAR.test(f[at - 1])) || (whole && at + t.length < f.length && WORD_CHAR.test(f[at + t.length]))))
    at = f.indexOf(t, at + 1);
  return at;
}

/** Splits `text` into [plain | match] chunks for highlighting (accent-insensitive). */
export function highlightRanges(text: string, terms: string[]): [number, number][] {
  if (!terms.length) return [];
  const f = fold(text);
  const ranges: [number, number][] = [];
  for (const t of terms) {
    let from = 0;
    for (;;) {
      const at = indexOfWord(f, t, from);
      if (at < 0) break;
      ranges.push([at, at + t.length]);
      from = at + t.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

export function snippet(text: string, terms: string[], radius = 90) {
  const f = fold(text);
  let at = -1;
  for (const t of terms) {
    const k = indexOfWord(f, t);
    if (k >= 0 && (at < 0 || k < at)) at = k;
  }
  if (at < 0) at = 0;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + radius * 1.6);
  let out = text.slice(start, end).trim();
  if (start > 0) out = '… ' + out.replace(/^\S*\s/, '');
  if (end < text.length) out = out.replace(/\s\S*$/, '') + ' …';
  return out;
}
