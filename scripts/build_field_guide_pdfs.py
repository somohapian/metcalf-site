"""Render the field guide and standalone working sheets from their shared HTML.

Run after build_field_guide.py. Requires reportlab, lxml and pypdf. No browser,
network requests, or independently maintained worksheet wording is involved.
"""
from pathlib import Path
from html import escape
import json
from copy import deepcopy
import re
from lxml import html
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT.parent / 'qa' / 'field-guide'
QA.mkdir(parents=True, exist_ok=True)
FONTS = Path('/System/Library/Fonts/Supplemental')
for name, filename in [('Body', 'Arial.ttf'), ('BodyBold', 'Arial Bold.ttf'), ('Serif', 'Georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / filename)))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='Body', boldItalic='BodyBold')
INK = HexColor('#26382e'); GREEN = HexColor('#496552'); RULE = HexColor('#acb9af'); MIST = HexColor('#eef2ee')
W, H = 612, 792
LEFT, WIDTH, TOP, BOTTOM = 47, 518, 748, 57
STYLES = {
    'body': ParagraphStyle('body', fontName='Body', fontSize=10.3, leading=14, textColor=INK),
    'small': ParagraphStyle('small', fontName='Body', fontSize=9.1, leading=12, textColor=INK),
    'title': ParagraphStyle('title', fontName='Serif', fontSize=25, leading=29, textColor=INK),
    'section': ParagraphStyle('section', fontName='Serif', fontSize=14, leading=17, textColor=GREEN),
    'lede': ParagraphStyle('lede', fontName='Serif', fontSize=13.2, leading=17, textColor=GREEN),
    'eyebrow': ParagraphStyle('eyebrow', fontName='BodyBold', fontSize=8.3, leading=11, textColor=GREEN),
    'brand': ParagraphStyle('brand', fontName='Body', fontSize=8.5, leading=11, textColor=INK),
    'table': ParagraphStyle('table', fontName='BodyBold', fontSize=9, leading=12, textColor=GREEN),
    'footer': ParagraphStyle('footer', fontName='Body', fontSize=7.5, leading=10, textColor=INK),
}

def rich(el):
    value = escape(el.text or '')
    for child in el:
        if child.tag == 'br': value += '<br/>'
        elif child.tag == 'strong': value += '<b>' + rich(child) + '</b>'
        elif child.tag == 'a':
            href = child.get('href', '')
            if href.startswith('#'): href = 'https://metcalfsearch.com/stack-field-guide' + href
            elif href.startswith('/'): href = 'https://metcalfsearch.com' + href
            value += '<a href="' + escape(href, quote=True) + '">' + rich(child) + '</a>'
        else: value += (' ' if child.tag == 'span' else '') + rich(child)
        value += escape(child.tail or '')
    return value

def paragraph(el, key='body', before=0, after=6, prefix=''):
    p = Paragraph(prefix + rich(el), STYLES[key])
    height = p.wrap(WIDTH, 1000)[1]
    return dict(type='p', p=p, h=height+before+after, before=before, after=after, ph=height)

def parse(node):
    blocks = []
    for el in node:
        cls = set(el.get('class', '').split())
        if el.tag == 'footer': continue
        if 'write' in cls:
            blocks.append(dict(type='lines', n=3 if 'lines-3' in cls else 2, h=0))
        elif 'fields' in cls:
            ps = [Paragraph(rich(x), STYLES['small']) for x in el]
            blocks.append(dict(type='fields', ps=ps, h=43))
        elif 'brand' in cls:
            blocks.append(dict(type='brand', parts=[rich(x) for x in el], h=26))
        elif el.tag == 'table':
            caption = el.find('caption')
            if caption is not None: blocks.append(paragraph(caption, 'small', after=5))
            heads = el.findall('.//th'); rows = el.findall('.//tbody/tr')
            widths = [.32, .15, .15, .38] if 'tracker-table' in cls else [.30, .35, .35] if 'evidence-table' in cls else [.48, .20, .32]
            height = 36 if 'tracker-table' in cls else 38 if 'evidence-table' in cls else 36
            vals = [[Paragraph(rich(th), STYLES['table']) for th in heads]] + [[''] * len(heads) for _ in rows]
            tab = Table(vals, colWidths=[WIDTH*x for x in widths], rowHeights=[34]+[height]*len(rows))
            tab.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),MIST),('GRID',(0,0),(-1,-1),.6,RULE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),6)]))
            blocks.append(dict(type='table', table=tab, h=tab.wrap(WIDTH,1000)[1]+10))
        elif el.tag in ('ul', 'ol'):
            for i, li in enumerate(el):
                blocks.append(paragraph(li, 'body', after=5, prefix=(str(i+1)+'. ' if el.tag=='ol' else '\u2022 ')))
        elif el.tag in ('h1','h2','h3','p'):
            key = 'title' if 'chapter-title' in cls else 'section' if el.tag in ('h2','h3') else 'eyebrow' if 'eyebrow' in cls else 'lede' if 'lede' in cls else 'small' if cls & {'small','prompt','guide-link'} else 'body'
            blocks.append(paragraph(el,key,before=8 if key=='section' else 0,after=8 if key in ('title','lede') else 5))
        else:
            blocks.extend(parse(el))
    return blocks

def normalized(value):
    return re.sub(r'\s+', '', value).replace('\u2022', '')

def generate(dest, pages):
    c = canvas.Canvas(str(dest), pagesize=(W,H))
    c.setTitle('The STACK Method | '+ {'interview-worksheet.pdf':'Interview worksheet','candidate-tracker.pdf':'Candidate follow-up tracker'}.get(dest.name,'Field guide'))
    c.setAuthor('Metcalf Search')
    stats = []
    for page in pages:
        blocks = parse(page)
        fixed = sum(b['h'] for b in blocks)
        count = sum(b.get('n',0) for b in blocks)
        pitch = min(23,(TOP-BOTTOM-fixed)/count) if count else 0
        if count and pitch < 17: raise RuntimeError(f"{page.get('id')}: writing pitch {pitch:.2f} too small")
        if not count and fixed > TOP-BOTTOM: raise RuntimeError(f"{page.get('id')}: content exceeds page by {fixed-(TOP-BOTTOM):.2f}")
        y = TOP
        for b in blocks:
            if b['type'] == 'brand':
                c.setFont('Body',8.5); c.setFillColor(INK)
                c.drawString(LEFT,y-11,b['parts'][0]); c.drawRightString(LEFT+WIDTH,y-11,b['parts'][1])
                c.setStrokeColor(RULE); c.setLineWidth(.6); c.line(LEFT,y-17,LEFT+WIDTH,y-17); y -= b['h']
            elif b['type'] == 'p':
                y -= b['before']; b['p'].drawOn(c,LEFT,y-b['ph']); y -= b['ph']+b['after']
            elif b['type'] == 'lines':
                c.setStrokeColor(RULE); c.setLineWidth(.45)
                for _ in range(b['n']):
                    y -= pitch; c.line(LEFT,y+4,LEFT+WIDTH,y+4)
            elif b['type'] == 'fields':
                inner = (WIDTH-24)/2
                for i,p in enumerate(b['ps']):
                    height = p.wrap(inner,100)[1]; p.drawOn(c,LEFT+i*(inner+24),y-height-2)
                    c.setStrokeColor(RULE); c.setLineWidth(.6); c.line(LEFT+i*(inner+24),y-34,LEFT+i*(inner+24)+inner,y-34)
                y -= b['h']
            elif b['type'] == 'table':
                b['table'].drawOn(c,LEFT,y-b['h']+10); y -= b['h']
        footer = page.find('footer')
        c.setStrokeColor(RULE); c.setLineWidth(.6); c.line(LEFT,42,LEFT+WIDTH,42)
        parts = list(footer)
        p = Paragraph(rich(parts[0]),STYLES['footer']); p.wrap(WIDTH*.65,40); p.drawOn(c,LEFT,27)
        c.setFont('Body',7.5); c.setFillColor(INK); c.drawRightString(LEFT+WIDTH,27,''.join(parts[1].itertext()))
        stats.append({'section':page.get('id'),'content_bottom':round(y,2),'writing_lines':count,'writing_line_pitch':round(pitch,2)})
        c.showPage()
    c.save()
    reader = PdfReader(dest)
    assert len(reader.pages)==len(pages)
    for i,page in enumerate(pages):
        expected = normalized(''.join(page.itertext()))
        actual = normalized(reader.pages[i].extract_text())
        # Ordered-list markers are generated presentation, not stored HTML text.
        if expected != actual:
            for ol in page.findall('.//ol'):
                for index,li in enumerate(ol,1):
                    snippet = normalized(''.join(li.itertext()))
                    actual = actual.replace(str(index)+'.'+snippet,snippet,1)
        assert expected==actual, (dest.name,i+1,'Text mismatch',expected,actual)
    return {'file':str(dest),'pages':len(pages),'text_check':'Exact HTML text match ignoring whitespace and generated list markers','layout':stats}

if __name__ == '__main__':
    tree = html.fromstring((ROOT/'stack-field-guide.html').read_text())
    pages = tree.xpath('//section[contains(concat(" ",normalize-space(@class)," ")," page ")]')
    outputs = [generate(ROOT/'stack-field-guide.pdf',pages)]
    for name,ids in [('interview-worksheet', ['interview-worksheet','interview-evidence']),('candidate-tracker',['candidate-tracker'])]:
        selected = [deepcopy(p) for p in pages if p.get('id') in ids]
        for i,page in enumerate(selected,1):
            page.find('footer')[1].text = ('Interview worksheet' if name=='interview-worksheet' else 'Candidate follow-up tracker') + f' · {i} / {len(selected)}'
        outputs.append(generate(ROOT/(name+'.pdf'),selected))
    (QA/'validation.json').write_text(json.dumps(outputs,indent=2))
    print(json.dumps(outputs,indent=2))
