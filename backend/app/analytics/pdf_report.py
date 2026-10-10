"""Branded aggregate academic report with summary, charts and detail."""
from io import BytesIO
from html import escape
from datetime import date
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.graphics.shapes import Drawing, Rect, String

NAVY = colors.HexColor("#102D50")
BLUE = colors.HexColor("#2563EB")
TEAL = colors.HexColor("#0D9488")
PALETTE = [BLUE,TEAL,colors.HexColor("#7C3AED"),colors.HexColor("#F59E0B"),colors.HexColor("#0284C7"),colors.HexColor("#E11D48")]

def generate_pdf(overview: dict) -> bytes:
 stream=BytesIO(); doc=SimpleDocTemplate(stream,pagesize=A4,leftMargin=38,rightMargin=38,topMargin=62,bottomMargin=42,title="Pulse EPIS · Informe académico",author="Pulse EPIS")
 styles=getSampleStyleSheet()
 styles.add(ParagraphStyle(name="ReportTitle",fontName="Helvetica-Bold",fontSize=25,leading=30,textColor=NAVY,spaceAfter=10))
 styles["Normal"].fontSize=9;styles["Normal"].leading=13;styles["Normal"].textColor=colors.HexColor("#475569")
 styles["Heading2"].textColor=NAVY;styles["Heading2"].fontSize=12;styles["Heading2"].spaceBefore=8;styles["Heading2"].spaceAfter=6
 filters=overview["filters"]; kpis=overview["kpis"]
 cutoff=date.fromisoformat(filters["cutoff_date"]).strftime("%d/%m/%Y")
 source="DEMOSTRACIÓN LOCAL · Datos sintéticos" if overview.get("dataset")=="demo" else "Datos registrados · Corte publicado"
 def para(text,style="Normal"):return Paragraph(text,styles[style])
 content=[para("Informe de certificaciones","ReportTitle"),para(f"Periodo <b>{escape(filters['period_code'])}</b> &nbsp; | &nbsp; Corte <b>{cutoff}</b>"),Spacer(1,8),para(source),Spacer(1,10)]
 context=" · ".join(f"{label}: {escape(str(filters.get(key) or 'Todos'))}" for key,label in [("cohort","Año de ingreso"),("cycle","Ciclo"),("issuer","Entidad emisora")])
 content.extend([para(context),Spacer(1,14)])
 cards=Table([[para("Estudiantes activos"),para("Estudiantes certificados"),para("Cobertura")],[para(f"<font size='22' color='#102D50'><b>{kpis['active_students']}</b></font>"),para(f"<font size='22' color='#0D9488'><b>{kpis['certified_students']}</b></font>"),para(f"<font size='22' color='#2563EB'><b>{kpis['coverage_percent']}%</b></font>")]],colWidths=[doc.width/3]*3,rowHeights=[28,38])
 cards.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#F1F5F9")),("LEFTPADDING",(0,0),(-1,-1),12),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
 content.extend([cards,Spacer(1,12),para(f"<b>{kpis['approved_certifications']}</b> certificaciones aprobadas · <b>{kpis['expiring_soon']}</b> próximas a vencer en 90 días"),Spacer(1,12)])
 def bars(title,rows):
  content.append(para(title,"Heading2"))
  if not rows:content.append(para("Sin certificaciones aprobadas para los filtros seleccionados."));return
  h=len(rows)*23+12;d=Drawing(doc.width,h);maxvalue=max(r["value"] for r in rows) or 1
  for i,item in enumerate(rows):
   y=h-24-i*23;name=item["name"]
   d.add(String(0,y+4,name[:34],fontName="Helvetica",fontSize=8,fillColor=NAVY))
   d.add(Rect(175,y,doc.width-212,13,fillColor=colors.HexColor("#F1F5F9"),strokeColor=None))
   d.add(Rect(175,y,(doc.width-212)*item["value"]/maxvalue,13,fillColor=PALETTE[i%len(PALETTE)],strokeColor=None))
   d.add(String(doc.width-6,y+3,str(item["value"]),textAnchor="end",fontName="Helvetica-Bold",fontSize=9,fillColor=NAVY))
  content.append(d)
 bars("Certificaciones por entidad emisora",overview["by_issuer"])
 bars("Certificaciones por habilidad",overview["by_skill"])
 content.append(para("Una certificación puede acreditar varias habilidades. Las categorías de habilidades no se suman para obtener el total."))
 content.append(PageBreak()); content.append(para("Detalle del periodo","ReportTitle"))
 def table(title,headers,rows):
  if not rows:return
  content.append(para(title,"Heading2"))
  cell_style=ParagraphStyle(name="TableCell",parent=styles["Normal"],fontSize=8,leading=10)
  cells=[[Paragraph('<font color="#FFFFFF">'+escape(str(v))+"</font>",cell_style) for v in headers]] + [[Paragraph(escape(str(v)),cell_style) for v in row] for row in rows]
  t=Table(cells,repeatRows=1,colWidths=[doc.width*0.68,doc.width*0.32] if len(headers)==2 else [doc.width/len(headers)]*len(headers))
  t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),NAVY),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#F8FAFC")]),("VALIGN",(0,0),(-1,-1),"TOP"),("LINEBELOW",(0,0),(-1,-1),0.4,colors.HexColor("#E2E8F0")),("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3)]))
  content.extend([t,Spacer(1,6)])
 for key,title in [("by_credential","Certificaciones aprobadas"),("by_cohort","Certificaciones por año de ingreso"),("by_cycle","Certificaciones por ciclo")]:table(title,["Categoría","Cantidad"],[[r["name"],r["value"]] for r in overview.get(key,[])])
 table("Evolución dentro del periodo",["Fecha de corte","Estudiantes certificados","Certificaciones aprobadas"],[[date.fromisoformat(r["cutoff_date"]).strftime("%d/%m/%Y"),r["certified_students"],r["approved_certifications"]] for r in overview["evolution"]])
 if overview.get("skill_gaps"):
  content.append(PageBreak());content.append(para("Cobertura por habilidad","ReportTitle"))
  table("Estudiantes activos del periodo",["Habilidad","Certificados","Sin certificación","Cobertura (%)"],[[r["skill"],r["certified_students"],r["gap_students"],r["coverage_percent"]] for r in overview["skill_gaps"]])
 content.extend([Spacer(1,12),para("<b>Metodología.</b> Cobertura = estudiantes activos con al menos una certificación aprobada / estudiantes activos × 100. Se cuentan registros y estudiantes distintos. Ventana de vencimiento: 90 días. Las brechas representan cobertura académica interna."),Spacer(1,5),para("Este informe contiene datos agregados y requiere revisión institucional para su uso oficial.")])
 def footer(canvas,document):
  canvas.setFillColor(NAVY);canvas.rect(0,A4[1]-37,A4[0],37,fill=1,stroke=0);canvas.setFillColor(colors.white);canvas.setFont("Helvetica-Bold",12);canvas.drawString(38,A4[1]-24,"PULSE EPIS")
  canvas.setFont("Helvetica",8);canvas.drawRightString(A4[0]-38,A4[1]-23,"GESTIÓN ACADÉMICA DE CERTIFICACIONES")
  canvas.setFillColor(colors.HexColor("#64748B"));canvas.setFont("Helvetica",8);canvas.drawString(38,23,source);canvas.drawRightString(A4[0]-38,23,f"Página {document.page}")
 doc.build(content,onFirstPage=footer,onLaterPages=footer);return stream.getvalue()
