"""Extract the PDF into structured blocks (paragraphs, headings, footnotes) with inline bold/italic markup.
Markup: \x01 toggles bold, \x02 toggles italic. Superscript digits become unicode superscripts."""
import pdfplumber, json, sys, re
from multiprocessing import Pool
from collections import Counter
PDF=sys.argv[1]; OUT=sys.argv[2]
SUP=str.maketrans('0123456789','⁰¹²³⁴⁵⁶⁷⁸⁹')
BIDI=dict.fromkeys(map(ord,'‪‫‬‭‮‎‏⁦⁧⁨⁩'),None)

def line_markup(chars):
    main=Counter(round(c['size'],1) for c in chars).most_common(1)[0][0]
    out=[];b=i=False;prev=None
    for c in chars:
        t=c['text']
        if prev is not None and t!=' ' and prev['text']!=' ' and c['x0']-prev['x1']>1.0 and abs(c['top']-prev['top'])<4:
            out.append(' ')
        fn=c['fontname']
        cb='Bold' in fn; ci='Italic' in fn or 'Oblique' in fn
        if t.strip()=='' : cb,ci=b,i   # don't toggle on spaces
        if cb!=b: out.append('\x01'); b=cb
        if ci!=i: out.append('\x02'); i=ci
        if c['size']<main*0.8 and t.isdigit(): t=t.translate(SUP)
        out.append(t); prev=c
    if b: out.append('\x01')
    if i: out.append('\x02')
    s=''.join(out).translate(BIDI)
    return s,main

def work(rng):
    res=[]
    with pdfplumber.open(PDF) as pdf:
        for pi in range(*rng):
            pg=pdf.pages[pi]
            try: lines=pg.extract_text_lines(layout=False,strip=True,return_chars=True)
            except Exception: lines=[]
            L=[]
            for l in lines:
                ch=[c for c in l['chars'] if c['text'] not in ('\x00',)]
                if not ch: continue
                s,size=line_markup(ch)
                plain=s.replace('\x01','').replace('\x02','').strip()
                if not plain: continue
                bold=sum('Bold' in c['fontname'] for c in ch if c['text'].strip())/max(1,sum(1 for c in ch if c['text'].strip()))
                L.append(dict(t=s.strip(),plain=plain,size=size,x0=l['x0'],x1=l['x1'],top=l['top'],bold=bold))
            res.append(dict(p=pi+1,lines=L,h=float(pg.height)))
    return res

if __name__=='__main__':
    n=557; step=25
    rngs=[(a,min(a+step,n)) for a in range(0,n,step)]
    with Pool(4) as p: out=p.map(work,rngs)
    pages=[x for r in out for x in r]
    json.dump(pages,open(OUT,'w'),ensure_ascii=False)
    print(len(pages),sum(len(p['lines']) for p in pages))
