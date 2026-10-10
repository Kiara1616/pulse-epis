from io import BytesIO
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from backend.app.analytics.demo import demo_analytics
from backend.app.analytics.excel_report import generate_excel
from backend.app.analytics.pdf_report import generate_pdf
from pypdf import PdfReader

def test_excel_contains_numeric_cells_sheets_charts_and_source_marker():
    data = demo_analytics().overview(period_code="2026-II").model_dump(mode="json")
    data["dataset"] = "demo"
    with ZipFile(BytesIO(generate_excel(data))) as book:
        strings = book.read("xl/sharedStrings.xml").decode()
        assert "DEMOSTRACIÓN LOCAL" in strings
        assert "Año de ingreso" in strings
        assert "level" not in strings
        assert len([p for p in book.namelist() if p.startswith("xl/charts/chart") and p.endswith(".xml")]) == 3
        ns = {"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        sheet = ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
        active = sheet.find('.//m:c[@r="C16"]',ns)
        assert active.attrib.get("t") != "s"
        assert int(active.find("m:v",ns).text) == data["kpis"]["active_students"]
        assert "Resumen" in book.read("xl/workbook.xml").decode()

def test_branded_pdf_preserves_counts_and_marks_demo():
    data = demo_analytics().overview(period_code="2026-II").model_dump(mode="json"); data["dataset"]="demo"
    pdf = PdfReader(BytesIO(generate_pdf(data)))
    text = " ".join(p.extract_text() for p in pdf.pages)
    assert "DEMOSTRACIÓN LOCAL" in text
    assert "2026-II" in text
    assert "AWS Cloud Practitioner" in text
    assert str(data["kpis"]["approved_certifications"]) in text
    assert "level" not in text and "@" not in text
