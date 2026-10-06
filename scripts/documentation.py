"""Shared, lossless documentation build for academic and project sources."""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

from markdown import markdown
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUTPUT = ROOT / "artifacts/docs"
WIDTH = 165 * mm
BLUE = colors.HexColor("#173F5F")
LINKS = re.compile(r"(!?)\[([^\]]+)\]\(([^)]+)\)")
MERMAID = re.compile(r"```mermaid\s*\n(.*?)```", re.S)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def catalog() -> list[dict]:
    return json.loads((DOCS / "catalogo.json").read_text(encoding="utf-8"))["documents"]


def source_revision() -> dict:
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()
    return {
        "source_commit": git("rev-parse", "HEAD"),
        "source_branch": git("branch", "--show-current") or "detached",
        "working_tree_dirty": bool(git("status", "--porcelain", "--untracked-files=no")),
        "technical_baseline": "d123beaae64df4f60e6f270cf0b9d682be481f37",
        "reference_documentation_commit": "a618c3e70a51cb07713264bbaa5d4440c3f11ad8",
    }


def target_for(source: str, extension: str) -> Path:
    relative = Path(source).relative_to("docs") if source.startswith("docs/") else Path("proyecto/repositorio") / source
    return OUTPUT / relative.with_suffix(extension)


def title_of(text: str, fallback: str) -> str:
    return next((line[2:].strip() for line in text.splitlines() if line.startswith("# ")), fallback)


def academic_metadata(text: str) -> dict[str, str]:
    """Read cover fields from the canonical report, rather than duplicate them."""
    fields = dict(re.findall(r"^\*\*([^*]+):\*\* (.+?)(?:<br>)?$", text, re.M))
    required = ("Institución", "Curso", "Docente", "Código", "Versión", "Fecha")
    missing = [key for key in required if not fields.get(key)]
    if missing or not (fields.get("Integrantes") or fields.get("Autores")):
        raise ValueError(f"Incomplete academic cover: {missing or ['Integrantes/Autores']}")
    return fields


def diagram_key(code: str) -> str:
    return hashlib.sha256(code.strip().encode()).hexdigest()[:20]


def diagram_path(code: str) -> Path:
    return OUTPUT / "diagrams" / (diagram_key(code) + ".svg")


def render_diagrams(entries: list[dict]) -> list[dict]:
    """Fail on missing renderer or malformed figures; never substitute prose."""
    codes = {}
    for entry in entries:
        for code in MERMAID.findall((ROOT / entry["source"]).read_text(encoding="utf-8")):
            codes[diagram_key(code)] = code.strip()
    if not codes:
        return []
    command = DOCS / "tooling/node_modules/.bin" / ("mmdc.cmd" if os.name == "nt" else "mmdc")
    if not command.exists():
        raise RuntimeError("Install Mermaid CLI first: npm ci --prefix docs/tooling")
    directory = OUTPUT / "diagrams"
    directory.mkdir(parents=True, exist_ok=True)
    records = []
    for index, (key, code) in enumerate(sorted(codes.items()), 1):
        source, image = directory / (key + ".mmd"), directory / (key + ".svg")
        cached = image.exists() and source.exists() and source.read_text(encoding="utf-8").strip() == code
        source.write_text(code + "\n", encoding="utf-8")
        if not cached:
            args = [str(command), "-i", str(source), "-o", str(image), "-b", "white", "-c", str(DOCS / "tooling/mermaid-config.json")]
            if os.getenv("CI"):
                args.extend(["-p", str(DOCS / "tooling/puppeteer-config.json")])
            subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True)
        if not image.exists() or "<foreignObject" in image.read_text(encoding="utf-8"):
            raise ValueError(f"Figure must contain SVG text, without HTML-only labels: {source.name}")
        png = image.with_suffix(".png")
        if not cached or not png.exists():
            subprocess.run(["node", str(DOCS / "tooling/svg-to-png.cjs"), str(image), str(png)], cwd=ROOT, check=True)
        records.append({"source": source.relative_to(OUTPUT).as_posix(), "svg": image.relative_to(OUTPUT).as_posix(), "sha256": digest(image), "png": png.relative_to(OUTPUT).as_posix(), "png_sha256": digest(png)})
        print(f"Diagram {index}/{len(codes)}: {key}", flush=True)
    return records


def resolve_link(target: str, source: str, output: Path, revision: dict) -> str:
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
        return target
    base, sep, fragment = target.partition("#")
    path = (ROOT / source).parent.joinpath(unquote(base).strip("<>")).resolve()
    try:
        relative = path.relative_to(ROOT).as_posix()
    except ValueError:
        raise ValueError(f"Reference escapes repository: {source} -> {target}")
    document_sources = {entry["source"] for entry in catalog()}
    if relative in document_sources:
        destination = target_for(relative, ".html")
        result = quote(os.path.relpath(destination, output.parent).replace("\\", "/"), safe="/.-_")
    elif relative.startswith("docs/recursos/"):
        destination = OUTPUT / relative.removeprefix("docs/")
        result = quote(os.path.relpath(destination, output.parent).replace("\\", "/"), safe="/.-_")
    else:
        kind = "tree" if path.is_dir() else "blob"
        result = f"https://github.com/Kiara1616/pulse-epis/{kind}/{revision['source_commit']}/{quote(relative, safe='/.-_')}"
    return result + (sep + fragment if sep else "")


def html_page(title: str, body: str, revision: dict, output: Path) -> str:
    home = quote(os.path.relpath(OUTPUT / "index.html", output.parent).replace("\\", "/"), safe="/.-_")
    return f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title><style>
body{{font:16px/1.6 system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 24px;color:#172033}}
h1,h2,h3,h4{{color:#173f5f}} table{{border-collapse:collapse;display:block;overflow-x:auto;margin:18px 0;max-width:100%}}
th,td{{border:1px solid #ccd5e0;padding:8px;vertical-align:top}} th{{background:#edf2f6}} pre{{background:#f2f5f8;padding:14px;overflow:auto}}
figure{{margin:24px 0}} figure img{{display:block;max-width:100%;height:auto;margin:auto}} figcaption{{font-size:14px;color:#46515d}}
a{{color:#155784}} footer{{margin-top:32px;font-size:13px;color:#596579}} .toc{{background:#f7f9fb;padding:16px}} nav{{margin-bottom:24px}}
</style></head><body><nav><a href="{home}">Índice documental</a></nav>{body}
<footer>Pulse EPIS · fuente {revision['source_commit'][:12]} · cambios locales: {'sí' if revision['working_tree_dirty'] else 'no'}</footer></body></html>'''


def build_html(entry: dict, revision: dict) -> Path:
    source = entry["source"]
    text = (ROOT / source).read_text(encoding="utf-8")
    output = target_for(source, ".html")
    output.parent.mkdir(parents=True, exist_ok=True)
    def figure(match):
        image = diagram_path(match.group(1))
        link = quote(os.path.relpath(image, output.parent).replace("\\", "/"), safe="/.-_")
        return f'\n<figure><img src="{link}" alt="Diagrama de {html.escape(title_of(text, "Pulse EPIS"))}"><figcaption>Diagrama renderizado desde la fuente Mermaid del documento</figcaption></figure>\n'
    text = MERMAID.sub(figure, text)
    def link(match):
        return f"{match.group(1)}[{match.group(2)}]({resolve_link(match.group(3), source, output, revision)})"
    # Do not rewrite literals in code fences as document links.
    pieces = re.split(r"(```.*?```)", text, flags=re.S)
    text = "".join(piece if piece.startswith("```") else LINKS.sub(link, piece) for piece in pieces)
    academic = entry["group"] == "academico" and Path(source).name.startswith("FD")
    if academic:
        fields = academic_metadata(text)
        logo = resolve_link("../recursos/imagenes/upt-logo.png", source, output, revision)
        authors = fields.get("Integrantes", fields.get("Autores", ""))
        cover = f'''<section class="academic-cover" style="text-align:center;font-family:'Times New Roman',serif;page-break-after:always">
<h2>UNIVERSIDAD PRIVADA DE TACNA</h2><h3>FACULTAD DE INGENIERÍA</h3><p>Escuela Profesional de Ingeniería de Sistemas</p>
<img src="{logo}" alt="Escudo de la Universidad Privada de Tacna" style="height:120px;width:auto">
<h1>{html.escape(title_of(text, Path(source).stem))}</h1><h2>Pulse EPIS</h2>
<p>Dashboard de certificaciones tecnológicas verificadas</p><p><b>Curso:</b> {html.escape(fields['Curso'])}</p>
<p><b>Docente:</b> {html.escape(fields['Docente'])}</p><p><b>Integrantes:</b><br>{html.escape(authors)}</p>
<p>{fields['Código']} · Versión {fields['Versión']} · {fields['Fecha']}</p><p>Tacna – Perú<br>2026</p></section>'''
        # The Markdown logo is useful on GitHub; the generated cover already has it.
        text = re.sub(r"^!\[Escudo institucional\].*\n", "", text, flags=re.M)
        marker = re.search(r"^## 1(?:\.| )", text, re.M)
        text = text[:marker.start()] + "[TOC]\n\n" + text[marker.start():] if marker else "[TOC]\n\n" + text
    else:
        cover = ""
        text = "[TOC]\n\n" + text
    body = cover + markdown(text, extensions=["tables", "fenced_code", "toc", "sane_lists"], output_format="html")
    output.write_text(html_page(title_of(text, Path(source).stem), body, revision, output), encoding="utf-8")
    return output


def styles(academic: bool = False):
    base = getSampleStyleSheet()
    result = {
        "title": ParagraphStyle("DocTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=19, leading=24, textColor=colors.black, spaceAfter=16),
        "body": ParagraphStyle("DocBody", fontName="Helvetica", fontSize=10, leading=14, spaceAfter=6),
        "list": ParagraphStyle("DocList", fontName="Helvetica", fontSize=10, leading=14, leftIndent=12, firstLineIndent=-10, spaceAfter=5),
        "cell": ParagraphStyle("DocCell", fontName="Helvetica", fontSize=8.4, leading=11, spaceAfter=0),
        "header": ParagraphStyle("DocHeader", fontName="Helvetica-Bold", fontSize=8.4, leading=11),
        "caption": ParagraphStyle("DocCaption", fontName="Helvetica-Oblique", fontSize=8.5, leading=11, alignment=TA_CENTER, spaceAfter=9),
        "code": ParagraphStyle("DocCode", fontName="Courier", fontSize=8, leading=10.5, leftIndent=5, spaceAfter=0),
        "cover": ParagraphStyle("DocCover", fontName="Helvetica-Bold", fontSize=14, leading=20, alignment=TA_CENTER, spaceAfter=12),
        "toc_title": ParagraphStyle("ContentsTitle", fontName="Helvetica-Bold", fontSize=16, leading=20, spaceAfter=14),
    }
    for level, size in ((1,15), (2,12), (3,10.5), (4,10)):
        result[f"h{level}"] = ParagraphStyle(f"DocH{level}", fontName="Helvetica-Bold", fontSize=size, leading=size+4, textColor=BLUE, spaceBefore=12, spaceAfter=7, keepWithNext=True)
    if academic:
        for key in ("body", "list"):
            result[key].fontName = "Times-Roman"
            result[key].fontSize = 12
            result[key].leading = 17
        result["body"].alignment = TA_JUSTIFY
        for key in ("cover", "title", "toc_title", "h1", "h2", "h3", "h4"):
            result[key].fontName = "Times-Bold"
        result["cell"].fontName = "Times-Roman"
        result["header"].fontName = "Times-Bold"
        result["cover"].fontSize = 13
        result["cover"].leading = 18
        result["cover"].spaceAfter = 8
        result["cover_meta"] = ParagraphStyle("CoverMetadata", fontName="Times-Roman", fontSize=12, leading=17, alignment=TA_CENTER, spaceAfter=8)
    return result


def inline(value: str, source: str, output: Path, revision: dict) -> str:
    value = value.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
    tokens = []
    def link(match):
        href = html.escape(resolve_link(match.group(3), source, output, revision), quote=True)
        tokens.append(f'<link href="{href}" color="#155784">{html.escape(match.group(2))}</link>')
        return f"PULSELINKTOKEN{len(tokens)-1}END"
    value = LINKS.sub(link, value)
    value = html.escape(value, quote=False).replace("&lt;br&gt;", "<br/>").replace("&lt;br/&gt;", "<br/>")
    value = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    for index, token in enumerate(tokens):
        value = value.replace(f"PULSELINKTOKEN{index}END", token)
    return value


class DocumentTemplate(BaseDocTemplate):
    def __init__(self, output: Path, title: str, revision: dict, academic: bool):
        super().__init__(str(output), pagesize=A4, leftMargin=25*mm, rightMargin=20*mm, topMargin=23*mm, bottomMargin=22*mm, title=title, author="Equipo Pulse EPIS")
        frame = Frame(self.leftMargin, self.bottomMargin, WIDTH, self.height, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="content")
        def footer(canvas, doc):
            if academic and doc.page == 1:
                return
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.HexColor("#5D6875"))
            canvas.drawString(self.leftMargin, A4[1]-15*mm, "Pulse EPIS")
            canvas.drawRightString(A4[0]-self.rightMargin, A4[1]-15*mm, "Documentación " + ("académica" if academic else "del proyecto"))
            canvas.drawString(self.leftMargin, 12*mm, f"Fuente {revision['source_commit'][:12]}" + (" con cambios locales" if revision["working_tree_dirty"] else ""))
            canvas.drawRightString(A4[0]-self.rightMargin, 12*mm, f"Página {doc.page}")
            canvas.restoreState()
        self.addPageTemplates([PageTemplate(id="document", frames=[frame], onPage=footer)])
        self.serial = 0

    def beforeDocument(self):
        self.serial = 0

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name.startswith("DocH"):
            level = int(flowable.style.name[-1])-1
            key = f"section-{self.page}-{self.serial}"
            self.serial += 1
            self.canv.bookmarkPage(key)
            # TOC supports skipped Markdown levels without invalid PDF outlines.
            self.notify("TOCEntry", (level, flowable.getPlainText(), self.page, key))


def table_flows(lines: list[str], st: dict, para) -> list:
    rows = [[part.strip() for part in re.split(r"(?<!\\)\|", line.strip().strip("|"))] for line in lines]
    rows = [row for row in rows if not all(re.fullmatch(r"[:\-\s]+", cell or " ") for cell in row)]
    count = max(map(len, rows))
    rows = [row + [""]*(count-len(row)) for row in rows]
    styling = TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#EDF2F6")),
        ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#BCC7D2")),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ])
    if count > 6:
        # Wide analytical matrices become labeled records with every cell kept.
        result = []
        for row in rows[1:]:
            data = [[para(label, st["header"]), para(value, st["cell"])] for label,value in zip(rows[0],row)]
            table = Table(data, colWidths=[WIDTH*.24, WIDTH*.76], hAlign="LEFT")
            table.setStyle(styling)
            result.extend([table, Spacer(1,7*mm)])
        return result
    weights = [1.0]*count
    if count > 2 and rows[0][0].casefold() in {"id", "código", "requisito", "versión"}:
        weights[0] = .5
    if count > 3:
        for i, cell in enumerate(rows[0]):
            if cell.casefold() in {"prioridad", "http", "fecha", "tipo"}:
                weights[i] = .65
    widths = [WIDTH*w/sum(weights) for w in weights]
    data = [[para(cell, st["header"] if n==0 else st["cell"]) for cell in row] for n,row in enumerate(rows)]
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(styling)
    return [table, Spacer(1,5*mm)]


def body_flows(text: str, source: str, output: Path, revision: dict, st: dict) -> list:
    def para(value, style): return Paragraph(inline(value,source,output,revision), style)
    lines, story, index, figure = text.splitlines(), [], 0, 0
    while index < len(lines):
        raw = lines[index].strip()
        index += 1
        if not raw:
            continue
        if raw.startswith("```"):
            language, code = raw[3:].strip(), []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code.append(lines[index]); index += 1
            if index == len(lines):
                raise ValueError(f"Unclosed code fence: {source}")
            index += 1
            if language == "mermaid":
                figure += 1
                png = diagram_path("\n".join(code)).with_suffix(".png")
                with PILImage.open(png) as raster:
                    width, height = raster.size
                # Screenshot density is 3 pixels per CSS pixel.
                factor = min(WIDTH/(width/3), 205*mm/(height/3), 1.0)
                if factor < .20:
                    raise ValueError(f"Figure {figure} too dense; split it into views: {source}")
                drawing = Image(str(png), width=width/3*factor, height=height/3*factor)
                story.append(KeepTogether([drawing, Spacer(1,3*mm), para(f"Figura {figure} Diagrama de la sección",st["caption"])]))
            else:
                # Wrap long commands and JSON visually; preserve source unchanged.
                from textwrap import wrap
                for line in code:
                    wrapped = wrap(line, width=90, expand_tabs=False, replace_whitespace=False, drop_whitespace=False, break_long_words=True, break_on_hyphens=False) or [""]
                    for part in wrapped:
                        story.append(Paragraph(html.escape(part).replace(" ","&#160;"),st["code"]))
                story.append(Spacer(1,4*mm))
            continue
        if raw.startswith("|") and raw.endswith("|"):
            table = [raw]
            while index < len(lines) and lines[index].strip().startswith("|"):
                table.append(lines[index].strip()); index += 1
            story.extend(table_flows(table,st,para))
            continue
        heading = re.match(r"^(#{1,6})\s+(.*)$",raw)
        if heading:
            level=min(len(heading.group(1))-1,4)
            if level == 0: continue  # Main title is placed once by the builder.
            story.append(para(heading.group(2),st[f"h{level}"]))
            continue
        if raw == "---":
            story.append(Spacer(1,5*mm)); continue
        if re.match(r"^(?:[-*]\s|\d+[.)]\s)",raw):
            story.append(para(raw,st["list"])); continue
        if raw.startswith(">"):
            raw=raw[1:].strip()
        story.append(para(raw,st["body"]))
    return story


def build_pdf(entry: dict, revision: dict) -> tuple[Path, int]:
    source = entry["source"]
    text = (ROOT/source).read_text(encoding="utf-8")
    title = title_of(text,Path(source).stem)
    output = target_for(source,".pdf")
    output.parent.mkdir(parents=True,exist_ok=True)
    academic = entry["group"] == "academico" and Path(source).name.startswith("FD")
    st = styles(academic)
    document = DocumentTemplate(output,title,revision,academic)
    story = []
    if academic:
        story.extend([Spacer(1,12*mm),Paragraph("UNIVERSIDAD PRIVADA DE TACNA",st["cover"]),Paragraph("FACULTAD DE INGENIERÍA",st["cover"]),Paragraph("Escuela Profesional de Ingeniería de Sistemas",st["cover"]),Spacer(1,8*mm)])
        fields = academic_metadata(text)
        logo = ROOT/"docs/recursos/imagenes/upt-logo.png"
        with PILImage.open(logo) as original:
            ratio = original.width / original.height
        image=Image(str(logo),width=32*mm*ratio,height=32*mm);image.hAlign="CENTER";story.extend([image,Spacer(1,10*mm)])
        authors = fields.get("Integrantes", fields.get("Autores", ""))
        story.extend([Paragraph(title,st["cover"]),Paragraph("Pulse EPIS",st["cover"]),Paragraph("Dashboard de certificaciones tecnológicas verificadas",st["cover_meta"]),Spacer(1,5*mm),Paragraph("Curso: " + html.escape(fields["Curso"]),st["cover_meta"]),Paragraph("Docente: " + html.escape(fields["Docente"]),st["cover_meta"]),Paragraph("Integrantes:<br/>" + html.escape(authors).replace(" y Vincenzo", "<br/>Vincenzo"),st["cover_meta"]),Paragraph(f"{fields['Código']} · Versión {fields['Versión']} · {fields['Fecha']}",st["cover_meta"]),Spacer(1,6*mm),Paragraph("Tacna – Perú<br/>2026",st["cover_meta"]),PageBreak()])
        text = re.sub(r"^!\[Escudo institucional\].*\n", "", text, flags=re.M)
        # Keep all front matter and version history from the canonical source.
        marker=re.search(r"^## 1(?:\.| )",text,re.M)
        if not marker:
            marker=re.search(r"^## Resumen",text,re.M)
        if not marker: raise ValueError(f"Missing academic body start: {source}")
        front=text[:marker.start()]
        story.extend(body_flows(front,source,output,revision,st))
        story.append(PageBreak())
        text=text[marker.start():]
    else:
        story.append(Paragraph(html.escape(title),st["title"]))
    toc=TableOfContents()
    toc.levelStyles=[ParagraphStyle(f"TOC{i}",fontName=("Times-Bold" if i==0 else "Times-Roman") if academic else ("Helvetica-Bold" if i==0 else "Helvetica"),fontSize=8.5 if academic else (9 if i<2 else 8),leading=11 if academic else 13,leftIndent=12*i,spaceBefore=2 if academic else 3) for i in range(4)]
    if academic or len(text.splitlines())>65:
        story.extend([Paragraph("Contenido",st["toc_title"]),toc,PageBreak()])
    story.extend(body_flows(text,source,output,revision,st))
    document.multiBuild(story)
    pages=len(PdfReader(output).pages)
    return output,pages


def copy_resources() -> list[dict]:
    records=[]
    for source in sorted((DOCS/"recursos").rglob("*")):
        if not source.is_file() or source.suffix==".md": continue
        destination=OUTPUT/source.relative_to(DOCS)
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,destination)
        records.append({"source":source.relative_to(ROOT).as_posix(),"artifact":destination.relative_to(OUTPUT).as_posix(),"sha256":digest(destination)})
    return records


def build_openapi(revision: dict) -> list[dict]:
    sys.path.insert(0,str(ROOT))
    from backend.app.main import app
    specification=app.openapi()
    specification["info"]["x-source-commit"]=revision["source_commit"]
    directory=OUTPUT/"openapi";directory.mkdir(parents=True,exist_ok=True)
    target=directory/"openapi.json"
    target.write_text(json.dumps(specification,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    rows=[]
    for path,methods in specification["paths"].items():
        for method,operation in methods.items():
            if method not in {"get","post","put","patch","delete","head","options"}:continue
            rows.append(f"<tr><td>{method.upper()}</td><td>{html.escape(path)}</td><td>{html.escape(operation.get('summary',''))}</td></tr>")
    view=directory/"openapi.html"
    view.write_text(html_page("Contrato OpenAPI",'<h1>Contrato OpenAPI</h1><p><a href="openapi.json">Contrato JSON completo</a></p><table><tr><th>Método</th><th>Ruta</th><th>Operación</th></tr>'+''.join(rows)+"</table>",revision,view),encoding="utf-8")
    return [{"artifact":p.relative_to(OUTPUT).as_posix(),"sha256":digest(p)} for p in (target,view)]


def build_index(records: list[dict], revision: dict) -> None:
    sections=[]
    for group,title in (("academico","Documentación académica"),("proyecto","Documentación del proyecto"),("indice","Índices y recursos")):
        rows=[]
        for record in records:
            if record["group"]!=group:continue
            rows.append(f'<li>{html.escape(record["title"])}: <a href="{quote(record["html"],safe="/.-_")}">HTML</a> · <a href="{quote(record["pdf"],safe="/.-_")}">PDF</a></li>')
        sections.append(f"<h2>{title}</h2><ul>{''.join(rows)}</ul>")
    body="<h1>Documentación de Pulse EPIS</h1>"+''.join(sections)+'<h2>Contratos y trazabilidad</h2><p><a href="openapi/openapi.html">OpenAPI</a> · <a href="manifest.json">Manifiesto</a> · <a href="recursos/migracion.json">Migración de archivos</a></p>'
    target=OUTPUT/"index.html"
    target.write_text(html_page("Documentación Pulse EPIS",body,revision,target),encoding="utf-8")


def build(academic_only: bool=False) -> dict:
    subprocess.run([sys.executable,str(ROOT/"scripts/validate_docs.py")],cwd=ROOT,check=True)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    # Remove obsolete academic outputs from earlier builds, including source
    # copies, so a removed report cannot reappear in the distributed package.
    academic_sources = {Path(e["source"]).stem for e in catalog() if e["source"].startswith("docs/academico/")}
    for directory, extensions in ((OUTPUT/"academico", {".html", ".pdf"}), (OUTPUT/"sources/academico", {".md"})):
        for obsolete in directory.glob("*"):
            if obsolete.is_file() and obsolete.suffix in extensions and obsolete.stem not in academic_sources:
                obsolete.unlink()
    selected=[e for e in catalog() if not academic_only or (e["group"]=="academico" and Path(e["source"]).name.startswith("FD"))]
    previous=json.loads((OUTPUT/"manifest.json").read_text(encoding="utf-8")) if (OUTPUT/"manifest.json").exists() else {}
    revision=source_revision()
    diagrams=render_diagrams(selected)
    records=[]
    for index,entry in enumerate(selected,1):
        source=ROOT/entry["source"]
        web=build_html(entry,revision)
        pdf,pages=build_pdf(entry,revision)
        source_relative=Path(entry["source"]).relative_to("docs") if entry["source"].startswith("docs/") else Path("repositorio")/entry["source"]
        copied=OUTPUT/"sources"/source_relative
        copied.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,copied)
        record={**entry,"title":title_of(source.read_text(encoding="utf-8"),source.stem),"source_sha256":digest(source),"html":web.relative_to(OUTPUT).as_posix(),"pdf":pdf.relative_to(OUTPUT).as_posix(),"html_sha256":digest(web),"pdf_sha256":digest(pdf),"pages":pages,"diagram_count":len(MERMAID.findall(source.read_text(encoding="utf-8"))),"copied_source":copied.relative_to(OUTPUT).as_posix(),"built_revision":revision}
        records.append(record)
        print(f"Document {index}/{len(selected)}: {entry['source']} ({pages} pages)",flush=True)
    if academic_only:
        included={r["source"] for r in records}
        registered = {e["source"] for e in catalog()}
        records.extend(r for r in previous.get("documents",[]) if r["source"] not in included and r["source"] in registered)
        diagram_names={d["svg"] for d in diagrams}
        diagrams.extend(d for d in previous.get("diagrams",[]) if d["svg"] not in diagram_names)
    resources=copy_resources()
    contracts=build_openapi(revision)
    records.sort(key=lambda r:r["source"])
    build_index(records,revision)
    import importlib.metadata
    manifest={"project":"Pulse EPIS","schema_version":2,**revision,"generated_at":datetime.now(timezone.utc).isoformat(),"scope":"academic" if academic_only else "complete","documents":records,"diagrams":diagrams,"resources":resources,"contracts":contracts,"dependencies":{name:importlib.metadata.version(name) for name in ("Markdown","reportlab","Pillow","pypdf","fastapi","pydantic")}}
    (OUTPUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Built {len(selected)} documents in {OUTPUT}",flush=True)
    return manifest
