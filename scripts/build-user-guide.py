"""Build the Turkish user guide from its reviewable Markdown source."""
from pathlib import Path
import re, sys, html
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output/pdf/LSIP_3_Kurumsal_Kullanim_Kilavuzu_TR.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Guide', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('GuideBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='Guide', boldItalic='GuideBold')
INK=HexColor('#172D43'); MUTED=HexColor('#50657A'); TEAL=HexColor('#007E87'); LIGHT=HexColor('#EDF4F6')
styles={
 'body':ParagraphStyle('body',fontName='Guide',fontSize=10,leading=14.3,textColor=INK,spaceAfter=8),
 'h1':ParagraphStyle('h1',fontName='GuideBold',fontSize=21,leading=26,textColor=INK,spaceAfter=17),
 'h2':ParagraphStyle('h2',fontName='GuideBold',fontSize=12.2,leading=16,textColor=TEAL,spaceBefore=9,spaceAfter=7,keepWithNext=True),
 'cell':ParagraphStyle('cell',fontName='Guide',fontSize=8.8,leading=11.5,textColor=INK),
 'head':ParagraphStyle('head',fontName='GuideBold',fontSize=8.9,leading=11.5,textColor=white),
 'note':ParagraphStyle('note',fontName='Guide',fontSize=9.5,leading=13.2,textColor=INK),
 'step':ParagraphStyle('step',fontName='Guide',fontSize=10,leading=14.2,textColor=INK,leftIndent=16,firstLineIndent=-16,spaceAfter=6),
}
for name in ('body', 'cell', 'note', 'step'):
 styles[name].alignment = TA_JUSTIFY
def fmt(s):
 s=html.escape(s)
 return re.sub(r'`([^`]+)`',r'<b>\1</b>',s)

class GuideCanvas(canvas.Canvas):
 def __init__(self,*a,**kw):
  super().__init__(*a,**kw)
  self.setTitle('LSIP 3.0 - Kurumsal Kullanım Kılavuzu')
  self.setAuthor('LSIP Ürün ve Dağıtım Ekibi')
  self.setSubject('Türkçe kullanıcı kılavuzu; mevcut işlevler, araştırma ve kurumsal işletim')

pages=(ROOT/'docs/LSIP_Kurumsal_Kullanim_Kilavuzu.md').read_text(encoding='utf8').split('---PAGE---')
W,H=A4; usable=W-100
def chrome(c,d):
 n=d.page
 c.saveState()
 if n==1:
  c.setFillColor(INK);c.rect(0,H-28,W,28,fill=1,stroke=0)
  c.setFillColor(TEAL);c.rect(50,H-170,9,68,fill=1,stroke=0)
 else:
  c.setFillColor(TEAL);c.rect(0,H-8,W,8,fill=1,stroke=0)
  c.setFont('GuideBold',8);c.setFillColor(INK);c.drawString(50,H-36,'LSIP 3.0  /  KURUMSAL KULLANIM KILAVUZU')
  c.setFont('Guide',8);c.setFillColor(MUTED);c.drawRightString(W-50,H-36,'10 Eylül 2026')
 c.setStrokeColor(HexColor('#D9E3E9'));c.line(50,42,W-50,42)
 c.setFont('Guide',8);c.setFillColor(MUTED);c.drawString(50,28,'Türkçe  |  Belge sürümü 1.0')
 c.drawRightString(W-50,28,f'{n} / {len(pages)}')
 c.bookmarkPage(f'page{n}')
 if n<=len(pages):
  title=next((s[2:] for s in pages[n-1].strip().splitlines() if s.startswith('# ')),str(n))
  c.addOutlineEntry(title,f'page{n}',level=0)
 c.restoreState()

story=[]
for idx,page in enumerate(pages):
 lines=page.strip().splitlines();i=0
 if idx==0: story.append(Spacer(1,56))
 while i<len(lines):
  line=lines[i].strip()
  if not line: i+=1;continue
  if line.startswith('|'):
   rows=[]
   while i<len(lines) and lines[i].strip().startswith('|'):
    row=[x.strip() for x in lines[i].strip().strip('|').split('|')]
    rows.append(row);i+=1
   cols=len(rows[0]); widths=[usable/cols]*cols
   if idx==1: widths=[42,294,usable-336]
   elif cols==2: widths=[145,usable-145]
   elif cols==3: widths=[133,190,usable-323]
   if idx==13: widths=[180,125,usable-305]
   cells=[]
   for ri,row in enumerate(rows):
    vals=[]
    for ci,value in enumerate(row):
     text=fmt(value)
     if idx==1 and ri>0 and ci==0 and value.isdigit(): text=f'<link href="#page{value}" color="#007E87">{value}</link>'
     vals.append(Paragraph(text,styles['head' if ri==0 else 'cell']))
    cells.append(vals)
   table=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
   table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),INK),('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT,white]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,-1),(-1,-1),.4,HexColor('#D5E3E7'))]))
   if idx==1:
    table.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),3.4),('BOTTOMPADDING',(0,0),(-1,-1),3.4)]))
   story.extend([table,Spacer(1,10)]);continue
  if line.startswith('# '):
   if idx==0:
    st=ParagraphStyle('cover',parent=styles['h1'],fontSize=45,leading=51,spaceAfter=14,leftIndent=23)
   else: st=styles['h1']
   story.append(Paragraph(fmt(line[2:]),st))
  elif line.startswith('## '):
   st=styles['h2'] if idx else ParagraphStyle('subtitle',parent=styles['h1'],fontSize=25,leading=31,spaceAfter=35)
   story.append(Paragraph(fmt(line[3:]),st))
  elif line.startswith('> '):
   note=Table([[Paragraph(fmt(line[2:]),styles['note'])]],colWidths=[usable])
   note.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),.4,TEAL),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
   story.extend([note,Spacer(1,10)])
  elif re.match(r'^\d+\. ',line): story.append(Paragraph(fmt(line),styles['step']))
  else: story.append(Paragraph(fmt(line),styles['body']))
  i+=1
 if idx<len(pages)-1:story.append(PageBreak())

doc=SimpleDocTemplate(str(OUT),pagesize=A4,leftMargin=50,rightMargin=50,topMargin=64,bottomMargin=56,pageCompression=1)
doc.build(story,onFirstPage=chrome,onLaterPages=chrome,canvasmaker=GuideCanvas)
reader=PdfReader(OUT)
assert len(reader.pages)==len(pages),f'Overflow: expected {len(pages)}, got {len(reader.pages)}'
for i,p in enumerate(reader.pages):
 text=p.extract_text()
 assert len(text)>400, f'Unexpected sparse page {i+1}'
 assert '\ufffd' not in text and '\u25a0' not in text,f'Broken text page {i+1}'
print(f'{OUT}\nPages: {len(reader.pages)} | Bytes: {OUT.stat().st_size}')
