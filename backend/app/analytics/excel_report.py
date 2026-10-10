"""Application runtime XLSX export of the authorized aggregate snapshot."""
from datetime import datetime
from io import BytesIO
import xlsxwriter

NAVY = "#102D50"
BLUE = "#2563EB"
TEAL = "#0D9488"
PURPLE = "#7C3AED"

def generate_excel(data: dict) -> bytes:
    stream = BytesIO()
    book = xlsxwriter.Workbook(stream, {"in_memory": True, "strings_to_formulas": False, "strings_to_urls": False})
    book.set_properties({"title": "Pulse EPIS · Informe académico", "author": "Pulse EPIS"})
    title = book.add_format({"bold": True, "font_size": 24, "font_color": "white", "bg_color": NAVY, "valign": "vcenter"})
    subtitle = book.add_format({"font_size": 11, "font_color": "#475569", "text_wrap": True, "valign": "vcenter"})
    header = book.add_format({"bold": True, "bg_color": NAVY, "font_color": "white", "bottom": 1, "bottom_color": "#CBD5E1"})
    label = book.add_format({"bold": True, "font_color": "#475569"})
    numeric = book.add_format({"num_format": "#,##0", "font_color": NAVY})
    percent = book.add_format({"num_format": "0.00%", "font_color": TEAL, "bold": True})
    date_fmt = book.add_format({"num_format": "dd/mm/yyyy"})
    filters = data["filters"]
    source = "DEMOSTRACIÓN LOCAL · datos sintéticos" if data.get("dataset") == "demo" else "Datos registrados · corte publicado"
    def sheet(name, description):
        ws = book.add_worksheet(name); ws.hide_gridlines(2); ws.set_tab_color(BLUE)
        ws.set_column("A:A", 3); ws.set_column("B:B", 38); ws.set_column("C:H", 15)
        ws.merge_range("B2:H3", "PULSE EPIS", title)
        ws.merge_range("B4:H4", description, subtitle)
        ws.merge_range("B5:H5", source, subtitle)
        ws.set_row(4, 24); ws.set_landscape(); ws.fit_to_pages(1, 0)
        ws.set_paper(9); ws.set_margins(0.35,0.35,0.5,0.5)
        ws.set_footer("&LPulse EPIS · " + filters["period_code"] + "&RPágina &P de &N")
        return ws
    summary = sheet("Resumen", "Informe académico de certificaciones")
    summary.set_portrait(); summary.set_print_scale(65); summary.set_h_pagebreaks([42])
    for r, (key, text) in enumerate([("period_code","Periodo"),("cutoff_date","Fecha de corte"),("cohort","Año de ingreso"),("cycle","Ciclo"),("issuer","Entidad emisora")],7):
        summary.write(r,1,text,label)
        if key == "cutoff_date": summary.write_datetime(r,2,datetime.fromisoformat(filters[key]),date_fmt)
        else: summary.write(r,2,filters.get(key) or "Todos",subtitle)
    kpi_rows = [("Estudiantes activos",data["kpis"]["active_students"]),("Estudiantes certificados",data["kpis"]["certified_students"]),("Certificaciones aprobadas",data["kpis"]["approved_certifications"]),("Cobertura",data["kpis"]["coverage_percent"]/100),("Próximas a vencer (90 días)",data["kpis"]["expiring_soon"])]
    summary.add_table(14,1,19,2,{"name":"Indicadores", "style":"Table Style Medium 2", "columns":[{"header":"Indicador"},{"header":"Valor"}],"data":kpi_rows})
    summary.write_number(18,2,kpi_rows[3][1],percent)
    summary.merge_range("B22:H23", "Cobertura: estudiantes activos con al menos una certificación aprobada / estudiantes activos. Una certificación con varias habilidades se cuenta una sola vez en el total.",subtitle)
    summary.set_row(21,24); summary.set_row(22,24)
    distributions = sheet("Distribuciones", "Detalle agregado por certificación, emisor y habilidad")
    chart_ranges = {}
    row = 7
    for key, caption in [("by_issuer","Entidad emisora"),("by_credential","Certificación"),("by_skill","Habilidad"),("by_cohort","Año de ingreso"),("by_cycle","Ciclo")]:
        rows = data.get(key,[])
        distributions.write(row,1,caption,header); distributions.write(row,2,"Aprobadas",header)
        for i, item in enumerate(rows,row+1):
            distributions.write_string(i,1,item["name"]); distributions.write_number(i,2,item["value"],numeric)
        if rows: chart_ranges[key]=(row+1,row+len(rows))
        row+=len(rows)+3
    distributions.freeze_panes(8,2)
    gaps = data.get("skill_gaps", [])
    if gaps:
        distributions.write(row,1,"Cobertura por habilidad",header)
        distributions.add_table(row+1,1,row+1+len(gaps),4,{"name":"CoberturaHabilidades","style":"Table Style Medium 2",
            "columns":[{"header":"Habilidad"},{"header":"Certificados"},{"header":"Sin certificación"},{"header":"Cobertura", "format":percent}],
            "data":[[r["skill"],r["certified_students"],r["gap_students"],r["coverage_percent"]/100] for r in gaps]})
        row += len(gaps)+3
    evolution = sheet("Evolución", "Certificaciones y estudiantes por fecha de corte del periodo")
    evolution.write_row(7,1,["Fecha de corte","Estudiantes certificados","Certificaciones aprobadas"],header)
    evolution.set_column("C:D",27)
    for r,item in enumerate(data["evolution"],8):
        evolution.write_datetime(r,1,datetime.fromisoformat(item["cutoff_date"]),date_fmt)
        evolution.write_number(r,2,item["certified_students"],numeric); evolution.write_number(r,3,item["approved_certifications"],numeric)
    evolution.freeze_panes(8,2)
    if data["evolution"]:
        chart=book.add_chart({"type":"line"})
        for column,color in [(2,TEAL),(3,BLUE)]:
            chart.add_series({"name":["Evolución",7,column],"categories":["Evolución",8,1,7+len(data["evolution"]),1],"values":["Evolución",8,column,7+len(data["evolution"]),column],"line":{"color":color,"width":2.5},"marker":{"type":"circle","size":5,"border":{"color":color},"fill":{"color":color}},"data_labels":{"value":True}})
        chart.set_title({"name":"Evolución de certificaciones"}); chart.set_x_axis({"num_format":"dd mmm","date_axis":False}); chart.set_y_axis({"min":0,"major_gridlines":{"visible":True,"line":{"color":"#E2E8F0"}}})
        chart.set_legend({"position":"bottom"}); chart.set_size({"width":760,"height":310}); summary.insert_chart("B26",chart)
    for key,anchor,color,caption in [("by_issuer","B43",BLUE,"Certificaciones por emisor"),("by_skill","B61",TEAL,"Certificaciones por habilidad")]:
        if key not in chart_ranges: continue
        first,last=chart_ranges[key]; chart=book.add_chart({"type":"bar"})
        chart.add_series({"categories":["Distribuciones",first,1,last,1],"values":["Distribuciones",first,2,last,2],"fill":{"color":color},"border":{"none":True},"data_labels":{"value":True}})
        chart.set_title({"name":caption}); chart.set_legend({"none":True});chart.set_y_axis({"reverse":True});chart.set_x_axis({"min":0});chart.set_size({"width":760,"height":320});summary.insert_chart(anchor,chart)
    last_row = 77 if "by_skill" in chart_ranges else 59 if "by_issuer" in chart_ranges else 41 if data["evolution"] else 23
    summary.print_area(1,1,last_row,7); distributions.print_area(1,1,row,4)
    book.close()
    return stream.getvalue()
