"""blocks.json -> app content (units, TOC, thematic index)."""
import json, re, sys, os, unicodedata
from collections import defaultdict

BLOCKS = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
os.makedirs(os.path.join(OUT, 'units'), exist_ok=True)


TOKEN = re.compile('\x03\\d+\x04[^\x05]*\x05')
SUPDIG = '⁰¹²³⁴⁵⁶⁷⁸⁹'
SUP = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
SUPRUN = re.compile('[⁰¹²³⁴⁵⁶⁷⁸⁹]+')
SUP2INT = str.maketrans(SUPDIG, '0123456789')


def strip_marks(s):
    return TOKEN.sub('', s).replace('\x01', '').replace('\x02', '')


def split_notes(raw):
    """Moves footnotes out of the text flow. Returns (main blocks, notes). Markers in the text that match a note become
    link tokens  \\x03<note index>\\x04<label>\\x05  and each note records the index of the block holding its marker."""
    main, notes, pending, allm = [], [], [], []
    for blk in raw:
        if blk['t'] == 'fn':
            for line in blk['x'].split('\n'):
                line = line.strip()
                if not line:
                    continue
                m = re.match('^([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\\s*(.*)$', line)
                label, text = (m.group(1), m.group(2)) if m else (None, line)
                note = dict(pg=blk['pg'], n=int(label.translate(SUP2INT)) if label else None, x=text, ref=None, pos=max(0, len(main) - 1))
                if label:
                    for mk in pending:
                        if mk['note'] is None and mk['label'] == label and 0 <= blk['pg'] - main[mk['block']]['pg'] <= 2:
                            mk['note'] = len(notes)
                            note['ref'] = mk['block']
                            break
                if notes and (label is None or (note['ref'] is None and text[:1].islower())):
                    # continuation of the previous note (note split across a page break, or a number inside the text)
                    tgt = notes[-1]
                    notes[-1 if tgt['ref'] is not None or len(notes) < 2 or tgt['pg'] != notes[-2]['pg'] else -2]['x'] = (notes[-1 if tgt['ref'] is not None or len(notes) < 2 or tgt['pg'] != notes[-2]['pg'] else -2]['x']).rstrip() + ' ' + (line if label else text)
                    continue
                notes.append(note)
            pending = [mk for mk in pending if mk['note'] is None and blk['pg'] - main[mk['block']]['pg'] <= 2]
            continue
        idx = len(main)
        main.append(dict(t=blk['t'], x=blk['x'], pg=blk['pg']))
        for m in SUPRUN.finditer(blk['x']):
            mk = dict(label=m.group(0), block=idx, start=m.start(), end=m.end(), note=None)
            pending.append(mk)
            allm.append(mk)
    # markers printed as plain digits glued to a word (size not small enough to be read as superscript)
    for ni, nt in enumerate(notes):
        if nt['ref'] is not None or nt['n'] is None or nt['n'] > 30:
            continue
        rx = re.compile('(?<=[^\\W\\d_])%d(?=[\\s.,;:!?»)\\x01\\x02]|$)' % nt['n'])
        for bi, b in enumerate(main):
            if not (nt['pg'] - 1 <= b['pg'] <= nt['pg']) or b['t'] == 'fn':
                continue
            hit = rx.search(b['x'])
            if hit and not any(mk['block'] == bi and mk['start'] == hit.start() for mk in allm):
                lab = str(nt['n']).translate(SUP)
                mk = dict(label=lab, block=bi, start=hit.start(), end=hit.end(), note=ni)
                allm.append(mk)
                nt['ref'] = bi
                break
    allm.sort(key=lambda mk: (mk['block'], mk['start']))
    for mk in reversed(allm):
        if mk['note'] is None:
            continue
        x = main[mk['block']]['x']
        main[mk['block']]['x'] = x[:mk['start']] + '\x03%d\x04%s\x05' % (mk['note'], mk['label']) + x[mk['end']:]
    return main, notes


def norm(s):
    s = strip_marks(s).lower().replace('’', "'").replace('‘', "'")
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s


# ---- merge consecutive headings of the same level on the same page -------------------------------------------
merged = []
for b in BLOCKS:
    if merged and b['t'] in ('h1', 'h2', 'h3') and merged[-1]['t'] == b['t'] and merged[-1]['pg'] == b['pg']:
        merged[-1]['x'] = merged[-1]['x'].rstrip() + ' ' + b['x']
    else:
        merged.append(dict(b))
# the heading of Part III of chapter IV ends on a stray one-word paragraph
for i, b in enumerate(merged):
    if b['t'] == 'h2' and b['x'].endswith('SES PAROLES ET SES') and merged[i + 1]['x'].strip() == 'ACTES ?':
        b['x'] += ' ACTES ?'
        merged[i + 1]['x'] = ''
merged = [b for b in merged if b['x'].strip()]
BLOCKS, ALL_NOTES = split_notes(merged)

# ---- table of contents --------------------------------------------------------------------------------------
# (id, group id, group title, title, subtitle, start page, heading prefix that opens the unit (None = first block of page))
G_AV = ('avant', 'Avant-propos')
U = [
    ('u01', 'avant', 'Avant-propos', 'Introduction du traducteur', 'Ahmed Ibn Abdallah Skiredj', 3, None),
    ('u02', 'avant', 'Avant-propos', 'Les clés du livre', 'Notions de base pour comprendre l’ouvrage', 9, None),
    ('u03', 'avant', 'Avant-propos', 'Étude du livre', 'L’auteur, l’ijaza et les manuscrits', 28, None),
    ('u04', 'avant', 'Avant-propos', 'Introduction de Sidi Ali Harazem Berrada', 'Présentation par l’auteur', 56, None),
    ('u05', 'avant', 'Avant-propos', 'Introduction à Jawahir al-Maâni', 'Le soufisme et la voie des saints', 64, None),

    ('u06', 'c1', 'Chapitre I — Identité du cheikh', 'Partie I', 'Identité, naissance, parents, famille et proches', 75, None),
    ('u07', 'c1', 'Chapitre I — Identité du cheikh', 'Partie II', 'Naissance, débuts et efforts du cheikh', 80, 'PARTIE II'),
    ('u08', 'c1', 'Chapitre I — Identité du cheikh', 'Partie III', 'Son affiliation au chemin de la raison et de la guidance', 88, 'PARTIE III'),

    ('u09', 'c2', 'Chapitre II — Illuminations spirituelles du cheikh', 'Partie I', 'Illuminations, états, station spirituelle et perfection', 103, None),
    ('u10', 'c2', 'Chapitre II — Illuminations spirituelles du cheikh', 'Partie II', 'La conduite splendide du cheikh', 119, 'PARTIE II'),

    ('u11', 'c3', 'Chapitre III — Le savoir du cheikh', 'Partie I', 'Savoir, générosité, largesse, magnanimité et fidélité', 130, None),
    ('u12', 'c3', 'Chapitre III — Le savoir du cheikh', 'Partie II', 'Crainte, endurance, piété, ascèse, conseil et liberté', 136, 'PARTIE II'),
    ('u13', 'c3', 'Chapitre III — Le savoir du cheikh', 'Partie III', 'Guidance : comportement et parole qui rassemblent autour d’Allah', 142, 'PARTIE III'),

    ('u14', 'c4', 'Chapitre IV — Litanies du cheikh', 'Partie I', 'Organisation des litanies, sa voie tijanie et ses disciples', 153, None),
    ('u15', 'c4', 'Chapitre IV — Litanies du cheikh', 'Partie II', 'Mérite du wird tijani, le disciple et son état', 163, 'PARTIE II'),
    ('u16', 'c4', 'Chapitre IV — Litanies du cheikh', 'Partie III', 'Comment reconnaître le vrai cheikh à suivre', 188, 'PARTIE III'),

    ('u17', 'c5', 'Chapitre V — Versets coraniques, hadiths et correspondances', 'Partie I', 'Explications de versets coraniques', 201, None),
    ('u18', 'c5', 'Chapitre V — Versets coraniques, hadiths et correspondances', 'Partie II', 'Hadiths prophétiques et sciences propres au Prophète', 298, None),
    ('u19', 'c5', 'Chapitre V — Versets coraniques, hadiths et correspondances', 'Partie III', 'Ses saints signes et leurs déchiffrements', 337, None),
    ('u20', 'c5', 'Chapitre V — Versets coraniques, hadiths et correspondances', 'Partie IV', 'Les correspondances du cheikh', 428, None),
    ('u21', 'c5', 'Chapitre V — Versets coraniques, hadiths et correspondances', 'Partie V', 'Questions juridiques et sentences du cheikh', 458, None),

    ('u22', 'c6', 'Chapitre VI — Prodiges et conduites du cheikh', 'Introduction', 'Prodiges et conduites courantes du cheikh', 479, None),
    ('u23', 'c6', 'Chapitre VI — Prodiges et conduites du cheikh', 'Prière I', 'Explication de la première prière', 490, None),
    ('u24', 'c6', 'Chapitre VI — Prodiges et conduites du cheikh', 'Prière II', 'Explication de la seconde prière', 522, None),
    ('u25', 'c6', 'Chapitre VI — Prodiges et conduites du cheikh', 'Prière III', 'Explication de la troisième prière', 532, None),

    ('u26', 'fin', 'Conclusion et traducteur', 'Conclusion', 'Offrir la rétribution des bonnes œuvres au Prophète', 544, None),
    ('u27', 'fin', 'Conclusion et traducteur', 'Le traducteur', 'Ahmed Ibn Abdallah Skiredj', 553, None),
]
# last page of the book body for each unit = start page of next unit - 1 (u26 -> 549 ; u27 -> 556)
LAST = {'u26': 549, 'u27': 556}

starts = []
for (uid, gid, gt, title, sub, pg, prefix) in U:
    idx = None
    for i, b in enumerate(BLOCKS):
        if b['pg'] == pg and (prefix is None or (b['t'] in ('h1', 'h2') and b['x'].startswith(prefix))):
            idx = i
            break
    assert idx is not None, (uid, pg, prefix)
    starts.append(idx)
assert starts == sorted(starts), starts

units = []
for k, (uid, gid, gt, title, sub, pg, prefix) in enumerate(U):
    a = starts[k]
    b = starts[k + 1] if k + 1 < len(U) else len(BLOCKS)
    blocks = BLOCKS[a:b]
    pages = [x['pg'] for x in blocks]
    p0, p1 = min(pages), LAST.get(uid) or (U[k + 1][5] if prefix is None and k + 1 < len(U) and U[k + 1][6] is None else max(pages))
    p1 = max(pages) if uid not in LAST else LAST[uid]
    main = [dict(x) for x in blocks]
    owned = [(k, n) for k, n in enumerate(ALL_NOTES) if a <= (n['ref'] if n['ref'] is not None else n['pos']) < b]
    remap = {k: j for j, (k, n) in enumerate(owned)}
    notes = [dict(pg=n['pg'], n=n['n'], x=n['x'], ref=(n['ref'] - a) if n['ref'] is not None else None) for k, n in owned]
    for x in main:
        x['x'] = re.sub('\x03(\\d+)\x04', lambda m: '\x03%d\x04' % remap[int(m.group(1))], x['x'])
    words = sum(len(strip_marks(x['x']).split()) for x in main)
    plan = [dict(i=i, t=x['t'], x=strip_marks(x['x']), pg=x['pg']) for i, x in enumerate(main) if x['t'] in ('h1', 'h2', 'h3')]
    unit = dict(id=uid, group=gid, groupTitle=gt, title=title, subtitle=sub, pages=[p0, p1], words=words, plan=plan, notes=notes, blocks=main)
    units.append(unit)
    json.dump(unit, open(os.path.join(OUT, 'units', uid + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

# ---- thematic index -----------------------------------------------------------------------------------------
THEMES = [
    ('dhikr', 'Le dhikr, les litanies et le wird', 'Invocation d’Allah, wird, wazifa, hadra : pratique, mérites et conditions.',
     r"\b(dhikr|dzikr|zikr|litanies?|wirds?|wazifa|wadhifa|hadra|invocations?|invoquer|rappel d'allah|evocation d'allah|la ilaha illa|point de divinite|istighfar)"),
    ('salat', 'La prière sur le Prophète et la Salat al-Fatih', 'La Salat al-Fatih, la Jawharat al-Kamal et les prières sur le Prophète.',
     r"(fatih|jawharat|jawhara|perle de la perfection|(prier|priere|prieres|salat|salate|salawat|salawate) (sur|pour) (le )?(prophete|messager)|priere (du )?fatih|prier sur le prophete)"),
    ('maitre', 'Le maître et le disciple', 'Éducation spirituelle, ijaza, taqdim, adab du disciple et rôle du cheikh éducateur.',
     r"\b(disciples?|educateurs?|moqaddem|taqdim|ijaza|affiliation|affilie|initiation|initie|maitre spirituel|education spirituelle|voie tijanie|voie tidjaniya|tariqa|compagnons du cheikh)"),
    ('gnose', 'Gnose, dévoilement et ouverture spirituelle', 'Connaissance d’Allah (maârifa), fath, illuminations, stations et présences.',
     r"\b(gnos\w+|devoil\w+|ouverture spirituelle|fath|maarifa|illuminations?|station spirituelle|stations?|presence divine|sainte presence|lahout|jabarout|malakout|nassout)"),
    ('prophete', 'Le Prophète et la réalité mohammadienne', 'La réalité mohammadienne, l’intermédiaire suprême, les visions du Prophète.',
     r"(mohammadienn\w*|ahmadienn\w*|sceau des prophetes|sceau des messagers|intercess\w+|intermediaire|sidna mohamed|vu le prophete|vu en reve le prophete)"),
    ('prodiges', 'Prodiges et miracles (karamât)', 'Récits de prodiges du cheikh et de ses compagnons.',
     r"\b(prodiges?|prodigieu\w+|miracles?|miraculeu\w+|karamat|karama|extraordinaires?|guerison|gueri|guerir|surnaturel\w*|violation des (lois|habitudes|traditions)|lu (ses|mes|les) pensees|clairvoyan\w+|marcher sur l'eau)"),
    ('visions', 'Rêves, visions et signes', 'Songes, visions, rencontres avec le Prophète en état d’éveil.',
     r"\b(reves?|songes?|visions?|visionnaires?|etat d'eveil|apparition|apparu|m'est apparu)"),
    ('vertus', 'Piété, ascèse et belles qualités', 'Générosité, patience, humilité, crainte d’Allah, renoncement, sincérité.',
     r"\b(ascese|renoncement|renoncer|piete|pieux|crainte|patience|patient|generosite|largesse|magnanimite|humilite|humble|sincerite|veracite|confiance en allah|vertus?|scrupule|pudeur|bienseance|bon caractere|ethique)"),
    ('coran', 'Le Coran et ses versets', 'Versets commentés, rangs des lecteurs du Coran, signes seigneuriaux.',
     r"\b(sourates?|versets?|corani\w*|coran)\b"),
    ('hadith', 'Hadiths et enseignements prophétiques', 'Hadiths cités, hadiths qodssi, sciences propres au Prophète.',
     r"\b(hadiths?|rapporteurs?|qodssi|sunna|sounna|tradition prophetique)"),
    ('fiqh', 'Jurisprudence et règles religieuses', 'Questions juridiques, licite et illicite, purification, prière, jeûne.',
     r"\b(jurisprud\w*|juristes?|fiqh|licite|illicite|obligatoire|obligatoires|ablutions?|jeune|zakat|zakate|pelerinage|fatwa|malikites?|interdit|interdits|reprehensible|divorce|mariage|heritage|loi religieuse)"),
    ('audela', 'La mort, l’au-delà, le Paradis et l’Enfer', 'Mort, tombe, jugement, Paradis, Enfer et sort des croyants.',
     r"\b(paradis|enfer|resurrection|jugement|tombeau|barzakh|au-dela|trepas|agonie|mort|morts|supplice|chatiment|sirat)"),
    ('amour', 'L’amour d’Allah et la proximité', 'Amour divin, proximité, nostalgie, union et rapprochement du serviteur.',
     r"\b(amour|aimer|bien-aimes?|aime|proximite|rapprochement|rapprocher|intimite|nostalgie|amoureux)"),
    ('saints', 'Les saints, le pôle et le sceau', 'Les gens de Dieu, le pôle caché, le sceau des saints, les califes.',
     r"\b(saints?|awliya|poles?|ghaout|gaout|califes?|elus?|veridiques?|gnostiques?|proches d'allah|walis?)"),
    ('pardon', 'Miséricorde, pardon et repentir', 'Miséricorde divine, rémission des péchés, repentir et bonne opinion d’Allah.',
     r"\b(misericord\w*|pardon\w*|repent\w*|remission|clemence|indulgen\w*|peches?|fautes?|tawba)"),
    ('unicite', 'L’unicité divine, les noms et les attributs', 'Tawhid, Entité suprême, noms et attributs, rangs de l’unicité.',
     r"\b(unicite|monothei\w*|attributs?|noms? d'allah|entite|essence|divinite|seigneurie|ahadia|wahidiya|wahda|tawhid|transcendance)"),
    ('biographie', 'Vie du cheikh et généalogie', 'Naissance, famille, voyages, maîtres, lieux et moments de vie de Sidi Ahmed Tijani.',
     r"\b(genealog\w*|naissance|naquit|enfance|sa mere|son pere|famille|ain madhi|fes|tlemcen|medine|mecque|voyages?|zaouia|jeunesse|deces)"),
]

page_blocks = defaultdict(list)  # page -> [(unit, idx, block)]
for u in units:
    for i, b in enumerate(u['blocks']):
        page_blocks[b['pg']].append((u['id'], i, b))

compiled = [(tid, title, desc, re.compile(rx)) for tid, title, desc, rx in THEMES]
page_words = {}
page_hits = {t[0]: {} for t in compiled}
block_hits = {}
for pg, items in page_blocks.items():
    txt_words = 0
    for uid, i, b in items:
        if b['t'] == 'fn':
            continue
        n = norm(b['x'])
        w = len(n.split())
        txt_words += w
        for tid, title, desc, rx in compiled:
            c = len(rx.findall(n))
            if c:
                page_hits[tid][pg] = page_hits[tid].get(pg, 0) + c
                block_hits[(tid, uid, i)] = c
    page_words[pg] = max(txt_words, 1)

unit_of_page = {}
for u in units:
    for b in u['blocks']:
        unit_of_page.setdefault((u['id'], b['pg']), True)

# selection parameters : keep pages in the top share of density, with a minimum count
SHARE = float(os.environ.get('SHARE', '0.16'))
themes_out = []
all_pages = sorted(page_words)
for tid, title, desc, rx in compiled:
    hits = page_hits[tid]
    min_hits, share = {'prodiges': (2, 0.14), 'salat': (2, 0.14), 'visions': (3, 0.14)}.get(tid, (3, SHARE))
    scored = sorted(((hits.get(p, 0), hits.get(p, 0) / page_words[p], p) for p in all_pages if hits.get(p, 0) >= min_hits), reverse=True)
    keep_n = max(8, int(len(all_pages) * share))
    sel = sorted(p for d, c, p in scored[:keep_n])
    # runs of consecutive pages (gap <= 1)
    runs = []
    for p in sel:
        if runs and p - runs[-1][-1] <= 2:
            runs[-1].append(p)
        else:
            runs.append([p])
    passages = []
    for run in runs:
        # split run by unit
        by_unit = defaultdict(list)
        for p in range(run[0], run[-1] + 1):
            for uid in {u for (u, i, b) in page_blocks.get(p, [])}:
                by_unit[uid].append(p)
        for uid, pgs in by_unit.items():
            pgs = sorted(pgs)
            u = next(x for x in units if x['id'] == uid)
            first = next(i for i, b in enumerate(u['blocks']) if b['pg'] == pgs[0])
            # best paragraph in range
            cand = [(block_hits.get((tid, uid, i), 0) + (2 if b['t'] == 'p' else 0), -i, i) for i, b in enumerate(u['blocks']) if pgs[0] <= b['pg'] <= pgs[-1] and b['t'] in ('p', 'q') and len(strip_marks(b['x'])) > 90]
            cand = [c for c in cand if block_hits.get((tid, uid, c[2]), 0) > 0]
            if not cand:
                continue
            best = max(cand)
            bi = best[2]
            text = strip_marks(u['blocks'][bi]['x'])
            if len(text) > 230:
                text = text[:230].rsplit(' ', 1)[0] + '…'
            score = sum(hits.get(p, 0) for p in pgs)
            if score < 3:
                continue
            passages.append(dict(unit=uid, block=first, pages=[pgs[0], pgs[-1]], score=score, excerpt=text))
    passages.sort(key=lambda x: (x['pages'][0]))
    themes_out.append(dict(id=tid, title=title, description=desc, count=len(passages), passages=passages))

toc = dict(
    groups=[],
    themes=[dict(id=t['id'], title=t['title'], description=t['description'], count=t['count']) for t in themes_out],
)
seen = []
for u in units:
    if u['group'] not in seen:
        seen.append(u['group'])
        toc['groups'].append(dict(id=u['group'], title=u['groupTitle'], units=[]))
    next(g for g in toc['groups'] if g['id'] == u['group'])['units'].append(
        dict(id=u['id'], title=u['title'], subtitle=u['subtitle'], pages=u['pages'], words=u['words'], blocks=len(u['blocks']), notes=len(u['notes']))
    )
json.dump(toc, open(os.path.join(OUT, 'toc.json'), 'w'), ensure_ascii=False, indent=1)
for t in themes_out:
    json.dump(t, open(os.path.join(OUT, 'themes_%s.json' % t['id']), 'w'), ensure_ascii=False, separators=(',', ':'))
print('units', len(units), 'themes', [(t['id'], t['count']) for t in themes_out])
