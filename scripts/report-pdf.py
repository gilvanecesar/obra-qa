"""Generate a PDF from observed audit results; never infer unexecuted coverage."""
import json
import sys
from html import escape
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
r=json.loads(Path(sys.argv[1]).read_text())
s=getSampleStyleSheet();s['BodyText'].leading=15
items=[]
def p(text,style='BodyText'):
    items.extend([Paragraph(escape(str(text)),s[style]),Spacer(1,9)])
p('Obra QA | Relatório de execução','Title')
p('Revisão: '+r['revision'])
p('Execução: '+r['id'])
p('Veredito do executor: '+r['verdict'])
p('Somente os testes abaixo foram executados. Leitura de documentação não equivale a validação funcional.')
p('Resultados por teste','Heading2')
for c in r['checks']:
    p(c['name'],'Heading3')
    p(f"Estado: {c['status']} | saída: {c['exitCode']} | duração: {c['durationMs']} ms")
    p('Evidência: '+c['evidence'])
    p('SHA-256: '+c['sha256'])
    log=(Path(sys.argv[1]).parent/c['evidence']).read_text()
    p(log[-1800:])
p('Escopo e limites','Heading2')
for limit in r['limits']:p(limit)
if r.get('analysis'):
    p(f"Inventário: {r['analysis']['trackedFiles']} arquivos versionados. Documentação consultada: "+', '.join(d['path'] for d in r['analysis']['documentation']))
p('Um código de saída não zero exige revisão da evidência. Não certifica automaticamente um defeito de produto. Resultados simulados não confirmam comportamento em produção.')
def footer(canvas,doc):
    canvas.setFont('Helvetica',8);canvas.drawString(42,25,'Obra QA - evidências de execução');canvas.drawRightString(552,25,str(doc.page))
SimpleDocTemplate(sys.argv[2],pagesize=A4,leftMargin=42,rightMargin=42,topMargin=42,bottomMargin=45).build(items,onFirstPage=footer,onLaterPages=footer)
