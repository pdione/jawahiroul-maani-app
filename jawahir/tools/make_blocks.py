"""pages.json -> blocks.json : paragraphs/headings/footnotes in reading order, each with its source page."""
import json, re, sys
from collections import Counter

pages = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
SUP = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
PAGENUM = re.compile(r'^-\s*\d+\s*-$')
BULLET = re.compile(r'^[\x01\x02]*[•▪●○◦\-–·o]\s')


def strip_marks(s):
    return s.replace('\x01', '').replace('\x02', '')


def is_caps(t):
    letters = [c for c in t if c.isalpha()]
    return len(letters) >= 10 and sum(c.isupper() for c in letters) / len(letters) > 0.85


def clean_join(parts):
    s = ' '.join(parts)
    # merge adjacent identical toggles produced by joining lines (e.g. "\x01 foo\x01 \x01bar")
    s = s.replace('\x01 \x01', ' ').replace('\x02 \x02', ' ')
    s = s.replace('\x01\x01', '').replace('\x02\x02', '')
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def balance(s):
    """make sure bold/italic toggles are balanced inside one block"""
    for tok in ('\x01', '\x02'):
        if s.count(tok) % 2:
            s += tok
    return s


blocks = []
open_par = None      # dict for the paragraph still open at end of previous page
pending_fn = []      # footnote blocks waiting for the open paragraph to close
last_short = True


def flush_open():
    global open_par
    if open_par is not None:
        open_par['x'] = balance(clean_join(open_par.pop('parts')))
        if open_par['x'].strip():
            blocks.append(open_par)
        open_par = None
        for fn in pending_fn:
            blocks.append(fn)
        pending_fn.clear()


def start_par(kind, pg, text, last=False):
    global open_par
    flush_open()
    open_par = dict(t=kind, pg=pg, parts=[text])


# skip pages: cover(1,2), sommaire (550-552)
SKIP = set([1, 2, 550, 551, 552, 557])

for page in pages:
    p = page['p']
    if p in SKIP:
        continue
    lines = page['lines']
    body, foot = [], []
    for l in lines:
        plain = l['plain']
        if PAGENUM.match(plain):
            continue
        if l['size'] <= 9.6 and l['top'] > page['h'] * 0.6:
            foot.append(l)
        else:
            body.append(l)
    # page 298: Tome II title page lines precede the real content
    if p == 298:
        body = [l for l in body if not (l['top'] < 175)]  # drop title block (kept heading of Deuxième partie below)
    if not body and not foot:
        continue
    xs = [l['x0'] for l in body if l['size'] >= 10 and l['size'] < 12 and len(l['plain']) > 40]
    ml = Counter(round(x) for x in xs).most_common(1)[0][0] if xs else 71
    x1s = sorted(l['x1'] for l in body if len(l['plain']) > 60)
    mr = x1s[int(len(x1s) * 0.9)] if x1s else 740
    prev = None
    i = 0
    while i < len(body):
        l = body[i]
        plain = l['plain']
        size = l['size']
        heading = None
        if size >= 12 and l['bold'] > 0.6:
            heading = 'h1' if size >= 14 else ('h2' if size >= 13 else 'h3')
        elif is_caps(plain) and len(plain) < 200 and (l['bold'] > 0.5 or plain.startswith('PARTIE') or plain.startswith('CHAPITRE')):
            heading = 'h2' if plain.startswith(('PARTIE', 'PREMIÈRE PARTIE')) else 'h3'
        elif re.match(r'^(PARTIE|PREMIÈRE PARTIE)\s', plain) and is_caps(plain):
            heading = 'h2'
        if p == 298 and plain.startswith('Deuxième partie'):
            heading = 'h2'
        if heading:
            # merge following heading lines of same size/style
            parts = [l['t']]
            j = i + 1
            while j < len(body):
                n = body[j]
                same = abs(n['size'] - size) < 0.3 and ((n['bold'] > 0.5) == (l['bold'] > 0.5)) and (not is_caps(plain) or is_caps(n['plain']))
                if same and n['top'] - body[j - 1]['top'] < size * 2.0:
                    parts.append(n['t']); j += 1
                else:
                    break
            flush_open()
            txt = balance(clean_join(parts))
            blocks.append(dict(t=heading, pg=p, x=strip_marks(txt)))
            i = j
            prev = None
            continue
        indent = l['x0'] - ml
        bullet = bool(BULLET.match(l['t']))
        quote = indent >= 24
        new = False
        if open_par is None:
            new = True
        elif prev is None:
            # first body line on a page continues an open paragraph unless it is indented / previous ended short
            new = indent >= 8 or last_short or bullet
        else:
            new = indent >= 8 or bullet or (prev['x1'] < mr - 38)
            if quote and prev['x0'] - ml >= 24 and not bullet and prev['x1'] >= mr - 38:
                new = False
        if new:
            kind = 'q' if (quote or bullet) else 'p'
            start_par(kind, p, l['t'])
        else:
            open_par['parts'].append(l['t'])
        prev = l
        last_short = l['x1'] < mr - 38
        i += 1
    # footnotes
    if foot:
        notes = []
        for f in sorted(foot, key=lambda z: z['top']):
            plain = f['plain']
            txt = strip_marks(f['t'])
            m = re.match(r'^([0-9⁰¹²³⁴⁵⁶⁷⁸⁹]{1,3})\s*[-–]?\s*(.*)', txt)
            if m and re.match(r'^[⁰¹²³⁴⁵⁶⁷⁸⁹]', txt) or (m and re.match(r'^\d{1,3}\s', txt)):
                notes.append(m.group(1).translate(SUP) + ' ' + m.group(2))
            else:
                if notes:
                    notes[-1] += ' ' + txt
                else:
                    notes.append(txt)
        fn = dict(t='fn', pg=p, x='\n'.join(re.sub(r'\s+', ' ', n).strip() for n in notes))
        if open_par is not None:
            pending_fn.append(fn)
        else:
            blocks.append(fn)

flush_open()
json.dump(blocks, open(OUT, 'w'), ensure_ascii=False)
c = Counter(b['t'] for b in blocks)
print(len(blocks), dict(c))
