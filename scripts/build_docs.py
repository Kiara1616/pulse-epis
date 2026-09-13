"""Build versioned Pulse EPIS documentation artifacts with one command."""

from __future__ import annotations

import html
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from markdown import markdown
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUTPUT = ROOT / "artifacts" / "docs"
MANUALS = OUTPUT / "manuals"
DIAGRAMS = OUTPUT / "diagrams"
OPENAPI = OUTPUT / "openapi"
MERMAID_PATTERN = re.compile(r"```mermaid\s*\n(.*?)```", re.DOTALL)
MANUAL_SOURCES = (
    ROOT / "README.md",
    DOCS / "FD01-Informe-Factibilidad.md",
    DOCS / "FD02-Informe-Vision.md",
    DOCS / "FD03-EPIS-Informe Especificación Requerimientos.md",
    DOCS / "FD04-EPIS-Informe Arquitectura de Software.md",
    DOCS / "07-Certificaciones-evidencias.md",
    DOCS / "08-Validacion-certificaciones.md",
    DOCS / "10-Manual-de-usuario.md",
)
PDF_SOURCES = MANUAL_SOURCES[1:5]


def _commit() -> str:
    configured = os.getenv("GITHUB_SHA")
    if configured:
        return configured[:12]
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short=12", "HEAD"], cwd=ROOT, text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _prepare() -> None:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    for directory in (MANUALS, DIAGRAMS, OPENAPI):
        directory.mkdir(parents=True, exist_ok=True)


def _html_document(title: str, body: str, commit: str) -> str:
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>{html.escape(title)}</title><style>
body{{font:16px/1.55 system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 24px;color:#172033}}
h1,h2,h3{{color:#0b4a8b}} table{{border-collapse:collapse;width:100%}} th,td{{border:1px solid #ccd5e0;padding:8px;text-align:left}}
code,pre{{background:#f2f5f8}} pre{{padding:14px;overflow:auto}} footer{{margin-top:48px;border-top:1px solid #ccd5e0;padding-top:12px;color:#596579}}
</style></head><body>{body}<footer>Pulse EPIS · commit {commit}</footer></body></html>"""


def _build_html(commit: str) -> list[str]:
    outputs: list[str] = []
    for source in MANUAL_SOURCES:
        text = source.read_text(encoding="utf-8")
        title = next((line[2:].strip() for line in text.splitlines() if line.startswith("# ")), source.stem)
        rendered = markdown(text, extensions=["tables", "fenced_code", "toc"])
        target = MANUALS / f"{source.stem}.html"
        target.write_text(_html_document(title, rendered, commit), encoding="utf-8")
        outputs.append(str(target.relative_to(ROOT)))
    return outputs


def _pdf_footer(canvas, document, commit: str) -> None:
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#596579"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18 * mm, 12 * mm, f"Pulse EPIS · commit {commit}")
    canvas.drawRightString(192 * mm, 12 * mm, f"Página {document.page}")
    canvas.restoreState()


def _build_pdf(source: Path, commit: str) -> str:
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="PulseTitle", parent=styles["Title"], textColor=colors.HexColor("#0b4a8b"), alignment=TA_CENTER, spaceAfter=16))
    styles.add(ParagraphStyle(name="PulseH1", parent=styles["Heading1"], textColor=colors.HexColor("#0b4a8b"), spaceBefore=12, spaceAfter=8))
    styles.add(ParagraphStyle(name="PulseH2", parent=styles["Heading2"], textColor=colors.HexColor("#1769aa"), spaceBefore=10, spaceAfter=6))
    target = MANUALS / f"{source.stem}.pdf"
    document = SimpleDocTemplate(str(target), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=18 * mm, bottomMargin=20 * mm, title=source.stem, author="Equipo Pulse EPIS")
    story = []
    in_code = False
    lines = source.read_text(encoding="utf-8").splitlines()
    index = 0
    while index < len(lines):
        raw_line = lines[index]
        line = raw_line.strip()
        index += 1
        if line.startswith("```"):
            in_code = not in_code
            continue
        if not line:
            story.append(Spacer(1, 3 * mm))
        elif line.startswith("# "):
            story.append(Paragraph(html.escape(line[2:]), styles["PulseTitle"]))
        elif line.startswith("## "):
            story.append(Paragraph(html.escape(line[3:]), styles["PulseH1"]))
        elif line.startswith("### "):
            story.append(Paragraph(html.escape(line[4:]), styles["PulseH2"]))
        elif line == "---":
            story.append(PageBreak())
        elif line.startswith("|") and line.endswith("|"):
            table_lines = [line]
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            rows = [
                [cell.strip() for cell in row.strip("|").split("|")]
                for row in table_lines
                if not re.fullmatch(r"\|?[\s:|-]+\|?", row)
            ]
            if rows:
                width = 174 * mm / max(len(rows[0]), 1)
                table = Table(
                    [[Paragraph(html.escape(cell.replace("**", "").replace("`", "")), styles["BodyText"]) for cell in row] for row in rows],
                    colWidths=[width] * len(rows[0]),
                    repeatRows=1,
                )
                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dceafb")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0b4a8b")),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9aa9bb")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                story.extend((table, Spacer(1, 3 * mm)))
        elif in_code:
            story.append(Paragraph(f"<font name='Courier' size='7'>{html.escape(line)}</font>", styles["Code"]))
        else:
            cleaned = re.sub(r"\[([^]]+)]\([^)]+\)", r"\1", line)
            cleaned = cleaned.lstrip("> ").replace("**", "").replace("`", "")
            cleaned = html.escape(cleaned).replace("&lt;br&gt;", "<br/>")
            prefix = "• " if cleaned.startswith(("- ", "* ")) else ""
            if prefix:
                cleaned = cleaned[2:]
            story.append(Paragraph(prefix + cleaned, styles["BodyText"]))
    footer = lambda canvas, doc: _pdf_footer(canvas, doc, commit)
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return str(target.relative_to(ROOT))


def _mermaid_command() -> Path:
    name = "mmdc.cmd" if os.name == "nt" else "mmdc"
    command = DOCS / "tooling" / "node_modules" / ".bin" / name
    if not command.exists():
        raise RuntimeError("Mermaid CLI no está instalado; ejecuta npm ci --prefix docs/tooling")
    return command


def _build_diagrams() -> list[str]:
    tracked = [
        item.decode("utf-8")
        for item in subprocess.check_output(
            ["git", "ls-files", "-z", "README.md", "docs/*.md"], cwd=ROOT
        ).split(b"\0")
        if item
    ]
    sources = tuple(ROOT / path for path in tracked)
    diagrams: list[tuple[Path, int, str]] = []
    for source in sources:
        for index, diagram in enumerate(MERMAID_PATTERN.findall(source.read_text(encoding="utf-8")), start=1):
            diagrams.append((source, index, diagram.strip()))
    command = _mermaid_command()
    outputs: list[str] = []
    for source, index, diagram in diagrams:
        stem = re.sub(r"[^a-z0-9]+", "-", source.stem.casefold()).strip("-")
        input_path = DIAGRAMS / f"{stem}-{index}.mmd"
        output_path = DIAGRAMS / f"{stem}-{index}.svg"
        input_path.write_text(diagram + "\n", encoding="utf-8")
        subprocess.run([str(command), "-i", str(input_path), "-o", str(output_path), "-b", "transparent"], cwd=ROOT, check=True)
        outputs.append(str(output_path.relative_to(ROOT)))
    return outputs


def _build_openapi(commit: str) -> list[str]:
    sys.path.insert(0, str(ROOT))
    from backend.app.main import app

    specification = app.openapi()
    specification["info"]["x-source-commit"] = commit
    json_target = OPENAPI / "openapi.json"
    json_target.write_text(json.dumps(specification, ensure_ascii=False, indent=2), encoding="utf-8")
    body = f"<h1>Pulse EPIS OpenAPI</h1><p>Commit <code>{commit}</code></p><pre>{html.escape(json.dumps(specification, ensure_ascii=False, indent=2))}</pre>"
    html_target = OPENAPI / "openapi.html"
    html_target.write_text(_html_document("Pulse EPIS OpenAPI", body, commit), encoding="utf-8")
    return [str(json_target.relative_to(ROOT)), str(html_target.relative_to(ROOT))]


def main() -> int:
    _prepare()
    commit = _commit()
    outputs = _build_html(commit)
    outputs.extend(_build_pdf(source, commit) for source in PDF_SOURCES)
    outputs.extend(_build_diagrams())
    outputs.extend(_build_openapi(commit))
    manifest = {"project": "Pulse EPIS", "source_commit": commit, "generated_at": datetime.now(timezone.utc).isoformat(), "artifacts": sorted(outputs)}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {len(outputs)} artifacts in {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
