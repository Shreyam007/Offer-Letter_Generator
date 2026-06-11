from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
import sys

md_path = 'PROJECT_GUIDE.md'
pdf_path = 'PROJECT_GUIDE.pdf'

if len(sys.argv) > 1:
    md_path = sys.argv[1]
if len(sys.argv) > 2:
    pdf_path = sys.argv[2]

with open(md_path, 'r', encoding='utf-8') as f:
    text = f.read()

styles = getSampleStyleSheet()
normal = styles['Normal']
heading = styles['Heading1']

# Simple conversion: split by blank lines for paragraphs
paras = [p.strip() for p in text.split('\n\n') if p.strip()]

doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
flow = []

for p in paras:
    # treat lines starting with '- ' as bulleted group; else paragraph
    if p.startswith('OfferFlow HR —') or p.startswith('TalentDraft —') or p.startswith('OnboardGo —') or p.startswith('# OnboardGo —') or p.startswith('# TalentDraft —') or p.startswith('# OfferFlow HR —'):
        flow.append(Paragraph(p, ParagraphStyle('title', parent=heading, fontSize=18, spaceAfter=12)))
    else:
        # replace markdown code inline backticks with nothing for simplicity
        p = p.replace('`', '')
        # replace bullets '- ' with bullets
        if p.startswith('- '):
            lines = p.split('\n')
            for ln in lines:
                if ln.startswith('- '):
                    flow.append(Paragraph('• ' + ln[2:], ParagraphStyle('bullet', parent=normal, leftIndent=12, bulletIndent=0, spaceAfter=4)))
                else:
                    flow.append(Paragraph(ln, normal))
        else:
            flow.append(Paragraph(p.replace('\n', '<br/>'), normal))
    flow.append(Spacer(1,8))

print('Generating PDF:', pdf_path)
doc.build(flow)
print('Done')
