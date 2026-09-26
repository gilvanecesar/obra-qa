"""Generate a PDF from observed audit results; never infer unexecuted coverage."""
import json
import sys
import textwrap
from html import escape
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
r=json.loads(Path(sys.argv[1]).read_text())
s=getSampleStyleSheet();s['BodyText'].leading=15
s.add(ParagraphStyle(name='EvidenceLog',fontName='Courier',fontSize=7,leading=9,spaceAfter=12))
items=[]
def p(text,style='BodyText'):
    items.extend([Paragraph(escape(str(text)),s[style]),Spacer(1,9)])
p('Obra QA | Relatório de execução','Title')
p('Revisão: '+r['revision'])
p('Execução: '+r['id'])
p('Veredito do executor: '+r['verdict'])
p('Somente os testes abaixo foram executados. Leitura de documentação não equivale a validação funcional.')
if r.get('coverage'):
    p('Funcionalidades e cobertura','Heading2')
    for requirement in r['coverage']:
        p(requirement['id'] + ': ' + requirement['behavior'], 'Heading3')
        p('Base do comportamento esperado: ' + requirement['basis'])
        p('Estado: ' + requirement['status'] + ' | Checks: ' + ', '.join(requirement['checks']))
    p('Testes gerados pelo agente são hipóteses verificáveis. Confira as premissas; aprovação não certifica toda a aplicação.')
if r.get('generatedTests'):
    p('Testes criados nesta auditoria','Heading2')
    for generated in r['generatedTests']:
        p(generated['source'] + ' | SHA-256: ' + generated['sha256'])
p('Resultados por teste','Heading2')
for c in r['checks']:
    p(c['name'],'Heading3')
    p(f"Estado: {c['status']} | saída: {c['exitCode']} | duração: {c['durationMs']} ms")
    p('Evidência: '+c['evidence'])
    p('SHA-256: '+c['sha256'])
    log=(Path(sys.argv[1]).parent/c['evidence']).read_text()
    excerpt = log if len(log) <= 3600 else log[:1800] + '\n[... excerpt truncated; full log in evidence file ...]\n' + log[-1800:]
    wrapped='\n'.join('\n'.join(textwrap.wrap(line,95,replace_whitespace=False,drop_whitespace=False)) if line else '' for line in excerpt.splitlines())
    items.extend([Preformatted(wrapped,s['EvidenceLog']),Spacer(1,9)])
p('Escopo e limites','Heading2')
for limit in r['limits']:p(limit)
if r.get('analysis'):
    p(f"Inventário: {r['analysis']['trackedFiles']} arquivos versionados. Documentação consultada: "+', '.join(d['path'] for d in r['analysis']['documentation']))
p('Um código de saída não zero exige revisão da evidência. Não certifica automaticamente um defeito de produto. Resultados simulados não confirmam comportamento em produção.')
def footer(canvas,doc):
    canvas.setFont('Helvetica',8);canvas.drawString(42,25,'Obra QA - evidências de execução');canvas.drawRightString(552,25,str(doc.page))
SimpleDocTemplate(sys.argv[2],pagesize=A4,leftMargin=42,rightMargin=42,topMargin=42,bottomMargin=45).build(items,onFirstPage=footer,onLaterPages=footer)
