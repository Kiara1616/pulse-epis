"""Build polished academic PDFs from the canonical Pulse EPIS Markdown reports."""

from __future__ import annotations

import html
import re
import subprocess
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUTPUT = ROOT / "output" / "pdf"
LOGO = ROOT / "dashboard-app" / "public" / "epis-logo.png"
BLUE = colors.HexColor("#173F5F")
TEAL = colors.HexColor("#20639B")
LIGHT_BLUE = colors.HexColor("#EAF2F8")
LIGHT_GRAY = colors.HexColor("#F2F4F6")
BORDER = colors.HexColor("#B8C3CF")


REPORTS = (
    {
        "source": DOCS / "FD01-Informe-Factibilidad.md",
        "output": OUTPUT / "FD01_PULSE_EPIS_FACTIBILIDAD.pdf",
        "kind": "Informe de Factibilidad",
        "version": "3.0",
        "start": "## Resumen ejecutivo y decisión",
    },
    {
        "source": DOCS / "FD02-Informe-Vision.md",
        "output": OUTPUT / "FD02_PULSE_EPIS_VISION.pdf",
        "kind": "Informe de Vision",
        "version": "3.0",
        "start": "## 1 Propósito",
    },
    {
        "source": DOCS / "FD03-EPIS-Informe Especificación Requerimientos.md",
        "output": OUTPUT / "FD03_PULSE_EPIS_ESPECIFICACION_REQUERIMIENTOS.pdf",
        "kind": "Informe de Especificacion de Requerimientos",
        "version": "3.0",
        "start": "## 1 Introducción",
    },
    {
        "source": DOCS / "FD04-EPIS-Informe Arquitectura de Software.md",
        "output": OUTPUT / "FD04_PULSE_EPIS_ARQUITECTURA_SOFTWARE.pdf",
        "kind": "Informe de Arquitectura de Software",
        "version": "3.0",
        "start": "## 1. Propósito, alcance y estado",
    },
)


def git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short=12", "HEAD"], cwd=ROOT, text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "desconocido"


def ascii_hyphens(value: str) -> str:
    return value.replace("\u2013", "-").replace("\u2014", "-").replace("\u2011", "-")


def inline_markup(value: str) -> str:
    """Convert the small Markdown inline subset used by the reports to Paragraph XML."""

    value = ascii_hyphens(value.strip())
    value = html.escape(value, quote=False)
    value = value.replace("&lt;br&gt;", "<br/>")
    value = re.sub(
        r"\[([^]]+)\]\(([^)]+)\)",
        r'<link href="\2" color="#173F5F">\1</link>',
        value,
    )
    value = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"__([^_]+)__", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    return value


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(inline_markup(text), style)


class AcademicDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, report: dict[str, str], commit: str, styles: dict[str, ParagraphStyle]):
        left = 25 * mm
        right = 20 * mm
        top = 27 * mm
        bottom = 21 * mm
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=left,
            rightMargin=right,
            topMargin=top,
            bottomMargin=bottom,
            title=f"{report['kind']} - Pulse EPIS",
            author="Kiara Holly Zapana Murillo; Vincenzo Rafael Lllanos Niño",
        )
        frame = Frame(
            left,
            bottom,
            A4[0] - left - right,
            A4[1] - top - bottom,
            id="content",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(
            [
                PageTemplate(
                    id="academic",
                    frames=[frame],
                    onPage=lambda canvas, doc: draw_header_footer(
                        canvas, doc, report["kind"], commit
                    ),
                )
            ]
        )
        self._styles = styles
        self._heading_count = 0

    def afterFlowable(self, flowable) -> None:  # noqa: N802 - ReportLab hook name
        if not isinstance(flowable, Paragraph):
            return
        level_by_style = {"Section": 0, "Subsection": 1, "Subsubsection": 2}
        level = level_by_style.get(flowable.style.name)
        if level is None:
            return
        text = flowable.getPlainText()
        key = f"heading-{self.page}-{self._heading_count}"
        self._heading_count += 1
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=False)
        self.notify("TOCEntry", (level, text, self.page))


def draw_header_footer(canvas, document, report_kind: str, commit: str) -> None:
    canvas.saveState()
    if document.page > 1:
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.35)
        canvas.line(document.leftMargin, A4[1] - 18 * mm, A4[0] - document.rightMargin, A4[1] - 18 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(BLUE)
        canvas.drawString(document.leftMargin, A4[1] - 14 * mm, "Pulse EPIS")
        canvas.drawRightString(A4[0] - document.rightMargin, A4[1] - 14 * mm, report_kind)
        canvas.line(document.leftMargin, 16 * mm, A4[0] - document.rightMargin, 16 * mm)
        canvas.setFillColor(colors.HexColor("#5D6875"))
        canvas.drawString(document.leftMargin, 11 * mm, f"Corte técnico: main {commit}")
        canvas.drawRightString(A4[0] - document.rightMargin, 11 * mm, f"Página {document.page}")
    canvas.restoreState()


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_uni": ParagraphStyle("CoverUni", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=15, leading=18, alignment=TA_CENTER, textColor=colors.black, spaceAfter=2),
        "cover_school": ParagraphStyle("CoverSchool", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=12.5, leading=15, alignment=TA_CENTER, textColor=colors.black),
        "cover_kind": ParagraphStyle("CoverKind", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=17, leading=20, alignment=TA_CENTER, textColor=BLUE, spaceBefore=12),
        "cover_project": ParagraphStyle("CoverProject", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=14, leading=18, alignment=TA_CENTER, textColor=colors.black),
        "cover_meta": ParagraphStyle("CoverMeta", parent=base["Normal"], fontName="Helvetica", fontSize=11, leading=15, alignment=TA_CENTER, textColor=colors.black),
        "cover_people": ParagraphStyle("CoverPeople", parent=base["Normal"], fontName="Helvetica-BoldOblique", fontSize=10.5, leading=14, alignment=TA_LEFT, textColor=colors.black),
        "section": ParagraphStyle("Section", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=14, leading=17, textColor=BLUE, spaceBefore=13, spaceAfter=7, keepWithNext=True),
        "subsection": ParagraphStyle("Subsection", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=14, textColor=TEAL, spaceBefore=9, spaceAfter=5, keepWithNext=True),
        "subsubsection": ParagraphStyle("Subsubsection", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=BLUE, spaceBefore=7, spaceAfter=4, keepWithNext=True),
        "body": ParagraphStyle("Body", parent=base["BodyText"], fontName="Helvetica", fontSize=9.2, leading=12.3, alignment=TA_JUSTIFY, firstLineIndent=8, spaceAfter=5),
        "body_noindent": ParagraphStyle("BodyNoIndent", parent=base["BodyText"], fontName="Helvetica", fontSize=9.2, leading=12.3, alignment=TA_LEFT, spaceAfter=5),
        "list_item": ParagraphStyle("ListItem", parent=base["BodyText"], fontName="Helvetica", fontSize=9.2, leading=12.3, alignment=TA_LEFT, leftIndent=14, firstLineIndent=-14, spaceAfter=3),
        "quote": ParagraphStyle("Quote", parent=base["BodyText"], fontName="Helvetica-Oblique", fontSize=8.5, leading=11, leftIndent=12, rightIndent=8, textColor=colors.HexColor("#46515D"), spaceBefore=3, spaceAfter=6),
        "table": ParagraphStyle("Table", parent=base["BodyText"], fontName="Helvetica", fontSize=7.1, leading=8.8, alignment=TA_LEFT),
        "table_header": ParagraphStyle("TableHeader", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=7.2, leading=8.8, alignment=TA_LEFT, textColor=colors.black),
        "code": ParagraphStyle("Code", parent=base["Code"], fontName="Courier", fontSize=6.4, leading=7.5, leftIndent=6),
        "toc_title": ParagraphStyle("TocTitle", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=19, textColor=BLUE, alignment=TA_LEFT, spaceAfter=12),
        "toc0": ParagraphStyle("TOC0", fontName="Helvetica-Bold", fontSize=9.2, leading=13, leftIndent=0, firstLineIndent=0, textColor=BLUE),
        "toc1": ParagraphStyle("TOC1", fontName="Helvetica", fontSize=8.6, leading=12, leftIndent=15, firstLineIndent=0, textColor=colors.black),
        "toc2": ParagraphStyle("TOC2", fontName="Helvetica", fontSize=8.2, leading=11, leftIndent=28, firstLineIndent=0, textColor=colors.HexColor("#44505C")),
    }


def version_table(report: dict[str, str], styles: dict[str, ParagraphStyle]) -> Table:
    rows = [
        [Paragraph("CONTROL DE VERSIONES", styles["table_header"])],
        [Paragraph("Versión", styles["table_header"]), Paragraph("Autores", styles["table_header"]), Paragraph("Revisada por", styles["table_header"]), Paragraph("Aprobada por", styles["table_header"]), Paragraph("Fecha", styles["table_header"]), Paragraph("Motivo", styles["table_header"])],
        [Paragraph(report["version"], styles["table"]), Paragraph("Kiara Zapana y Vincenzo Lllanos", styles["table"]), Paragraph("Pendiente", styles["table"]), Paragraph("Pendiente", styles["table"]), Paragraph("01/10/2026", styles["table"]), Paragraph("Edición académica basada en main actualizado y estado verificable del prototipo", styles["table"])],
    ]
    table = Table(rows, colWidths=[174 * mm], hAlign="CENTER")
    table._argW = [174 * mm]
    table.setStyle(TableStyle([
        ("SPAN", (0, 0), (-1, 0)),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9D9D9")),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#F2F2F2")),
        ("GRID", (0, 0), (-1, -1), 0.45, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    # Rebuild with deliberate widths after the one-cell title row is configured.
    table._argW = [22 * mm, 36 * mm, 29 * mm, 29 * mm, 20 * mm, 38 * mm]
    table._colWidths = table._argW
    return table


def parse_table(lines: list[str], styles: dict[str, ParagraphStyle]) -> Table:
    rows: list[list[str]] = []
    for raw in lines:
        cells = [cell.strip() for cell in raw.strip().strip("|").split("|")]
        if cells and all(re.fullmatch(r"[:\-\s]+", cell or " ") for cell in cells):
            continue
        rows.append(cells)
    if not rows:
        return Table([[""]])
    columns = max(len(row) for row in rows)
    for row in rows:
        row.extend([""] * (columns - len(row)))
    header = [[Paragraph(inline_markup(cell), styles["table_header"]) for cell in rows[0]]]
    body = [[Paragraph(inline_markup(cell), styles["table"]) for cell in row] for row in rows[1:]]
    widths = [174 * mm / columns] * columns
    table = Table(header + body, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BLUE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def consume_list(lines: list[str], index: int, styles: dict[str, ParagraphStyle]):
    ordered = bool(re.match(r"^\d+[.)]\s+", lines[index].strip()))
    items: list[Paragraph] = []
    item_number = 1
    while index < len(lines):
        raw = lines[index].strip()
        match = re.match(r"^(\d+[.)]|[-*])\s+(.*)$", raw)
        if not match or (ordered != match.group(1)[0].isdigit()):
            break
        prefix = f"{item_number}. " if ordered else "- "
        items.append(paragraph(prefix + match.group(2), styles["list_item"]))
        item_number += 1
        index += 1
    return items, index


def mermaid_placeholder(code: list[str], styles: dict[str, ParagraphStyle]) -> list[object]:
    first = next((line.strip() for line in code if line.strip()), "")
    if first.startswith("sequenceDiagram"):
        summary = "Secuencia de referencia: captura autorizada -> validación y normalización -> persistencia -> validación humana -> indicadores y dashboard."
    elif "deployment" in " ".join(code).lower() or "Production" in " ".join(code):
        summary = "Despliegue por ambientes: desarrollo local -> staging protegido -> producción institucional, con CI/CD, monitoreo y respaldos."
    else:
        summary = "Vista arquitectónica: fuentes autorizadas -> API y ETL -> PostgreSQL y almacenamiento privado -> dashboard y reportes agregados."
    return [paragraph("**Diagrama de arquitectura**", styles["body_noindent"]), paragraph(summary, styles["body_noindent"])]


def report_body(report: dict[str, str], styles: dict[str, ParagraphStyle]) -> list[object]:
    lines = report["source"].read_text(encoding="utf-8").splitlines()
    start_index = next(i for i, line in enumerate(lines) if line.strip() == report["start"])
    lines = lines[start_index:]
    story: list[object] = []
    index = 0
    while index < len(lines):
        raw = lines[index].rstrip()
        stripped = raw.strip()
        if not stripped:
            index += 1
            continue
        if stripped.startswith("```"):
            language = stripped[3:].strip()
            index += 1
            code: list[str] = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code.append(lines[index].rstrip())
                index += 1
            if index < len(lines):
                index += 1
            if language == "mermaid":
                story.extend(mermaid_placeholder(code, styles))
            else:
                story.append(Preformatted("\n".join(code), styles["code"]))
                story.append(Spacer(1, 3 * mm))
            continue
        if stripped.startswith("|") and stripped.endswith("|"):
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            story.append(parse_table(table_lines, styles))
            story.append(Spacer(1, 4 * mm))
            continue
        if re.match(r"^(?:[-*]\s+|\d+[.)]\s+)", stripped):
            flows, index = consume_list(lines, index, styles)
            story.extend(flows)
            story.append(Spacer(1, 2 * mm))
            continue
        if stripped.startswith(">"):
            story.append(paragraph(stripped[1:].strip(), styles["quote"]))
            index += 1
            continue
        heading = re.match(r"^(#{2,4})\s+(.*)$", stripped)
        if heading:
            level = len(heading.group(1))
            style = styles[{2: "section", 3: "subsection", 4: "subsubsection"}[level]]
            story.append(paragraph(heading.group(2), style))
            index += 1
            continue
        if stripped == "---":
            story.append(PageBreak())
            index += 1
            continue
        story.append(paragraph(stripped, styles["body"]))
        index += 1
    return story


def cover(report: dict[str, str], styles: dict[str, ParagraphStyle], commit: str) -> list[object]:
    story: list[object] = [Spacer(1, 12 * mm)]
    story.append(Paragraph("UNIVERSIDAD PRIVADA DE TACNA", styles["cover_uni"]))
    story.append(Paragraph("FACULTAD DE INGENIERÍA", styles["cover_school"]))
    story.append(Paragraph("Escuela Profesional de Ingeniería de Sistemas", styles["cover_school"]))
    story.append(Spacer(1, 8 * mm))
    if LOGO.exists():
        image = Image(str(LOGO), width=30 * mm, height=30 * mm)
        image.hAlign = "CENTER"
        story.append(image)
    else:
        story.append(Spacer(1, 30 * mm))
    story.extend([
        Spacer(1, 7 * mm),
        Paragraph(report["kind"], styles["cover_kind"]),
        Spacer(1, 3 * mm),
        Paragraph("Pulse EPIS", styles["cover_project"]),
        Paragraph("Dashboard de acreditaciones y certificaciones de estudiantes de la EPIS", styles["cover_project"]),
        Spacer(1, 9 * mm),
        Paragraph("Curso: <i>Inteligencia de Negocios</i>", styles["cover_meta"]),
        Spacer(1, 2 * mm),
        Paragraph("Docente: <i>Patrick Cuadros Quiroga</i>", styles["cover_meta"]),
        Spacer(1, 8 * mm),
        Paragraph("Integrantes:", styles["cover_meta"]),
        Paragraph("Kiara Holly Zapana Murillo (2023077087)<br/>Vincenzo Rafael Lllanos Niño (2023076796)", styles["cover_people"]),
        Spacer(1, 28 * mm),
        Paragraph("Corte técnico: main " + commit, styles["cover_meta"]),
        Spacer(1, 3 * mm),
        Paragraph("Tacna - Perú", styles["cover_meta"]),
        Paragraph("2026", styles["cover_meta"]),
        PageBreak(),
        version_table(report, styles),
        Spacer(1, 22 * mm),
        Paragraph("Sistema Pulse EPIS", styles["cover_project"]),
        Paragraph("Documento " + report["kind"], styles["cover_project"]),
        Spacer(1, 3 * mm),
        Paragraph("Versión " + report["version"], styles["cover_meta"]),
        Paragraph("Estado: entregable académico basado en el estado verificable del repositorio", styles["cover_meta"]),
        PageBreak(),
    ])
    return story


def build_report(report: dict[str, str], commit: str) -> None:
    styles = make_styles()
    report["output"].parent.mkdir(parents=True, exist_ok=True)
    document = AcademicDocTemplate(str(report["output"]), report, commit, styles)
    toc = TableOfContents()
    toc.levelStyles = [styles["toc0"], styles["toc1"], styles["toc2"]]
    story = cover(report, styles, commit)
    story.extend([Paragraph("Contenido", styles["toc_title"]), toc, PageBreak()])
    story.extend(report_body(report, styles))
    document.multiBuild(story)


def main() -> int:
    commit = git_commit()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for report in REPORTS:
        build_report(report, commit)
        print(report["output"].relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
