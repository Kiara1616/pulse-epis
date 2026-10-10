"""Check recursive source coverage, requirements, links, contracts and builds."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUTPUT = ROOT / "artifacts/docs"
LINK = re.compile(r"\]\(([^)]+)\)")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entries() -> list[dict]:
    return json.loads((DOCS / "catalogo.json").read_text(encoding="utf-8"))["documents"]


def source_errors() -> list[str]:
    errors = []
    records = entries()
    registered = [e["source"] for e in records]
    discovered = {p.relative_to(ROOT).as_posix() for p in DOCS.rglob("*.md") if "node_modules" not in p.parts and "tooling" not in p.parts}
    if len(registered) != len(set(registered)):
        errors.append("Duplicate source in documentation catalog")
    for missing in sorted(discovered - set(registered)):
        errors.append(f"Source omitted from catalog: {missing}")
    for record in records:
        if record["group"] not in {"academico", "proyecto", "indice"}:
            errors.append(f"Unknown document group: {record}")
        if not (ROOT / record["source"]).is_file():
            errors.append(f"Missing catalog source: {record['source']}")
    # Include root and pilot Markdown even when not part of a selected build.
    sources = {ROOT / p for p in registered} | {p for p in ROOT.glob("*.md")} | set((ROOT / "pilot").rglob("*.md"))
    for path in sorted(sources):
        if not path.exists(): continue
        text = path.read_text(encoding="utf-8")
        if len(re.findall(r"^```", text, re.M)) % 2:
            errors.append(f"Unclosed code fence: {path.relative_to(ROOT)}")
        text = re.sub(r"```.*?```", "", text, flags=re.S)
        for target in LINK.findall(text):
            target = target.strip().strip("<>")
            if urlsplit(target).scheme or target.startswith("#"): continue
            base = target.split("#", 1)[0]
            resolved = (path.parent / unquote(base)).resolve()
            if not resolved.is_relative_to(ROOT):
                errors.append(f"Link escapes repository: {path.relative_to(ROOT)} -> {target}")
            elif not resolved.exists():
                errors.append(f"Broken link: {path.relative_to(ROOT)} -> {target}")
    # Migration integrity is checked against the immutable PR commit, while
    # new files may be extended after their move. No byte-for-byte claim is made.
    migration = json.loads((DOCS / "recursos/migracion.json").read_text(encoding="utf-8"))
    for item in migration["archivos"]:
        original = subprocess.check_output(["git", "show", f"{migration['base']}:{item['anterior']}"], cwd=ROOT)
        if hashlib.sha256(original).hexdigest() != item["sha256_original"]:
            # Git checkout can use CRLF; the registry stores checkout bytes.
            crlf = original.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
            if hashlib.sha256(crlf).hexdigest() != item["sha256_original"]:
                errors.append(f"Original migration hash mismatch: {item['anterior']}")
        if not (ROOT / item["actual"]).is_file():
            errors.append(f"Lost migrated source: {item['actual']}")
    from backend.app.analytics.schemas import AnalyticsOverview
    stored = json.loads((DOCS / "recursos/schemas/dashboard-spec.json").read_text(encoding="utf-8"))
    if stored != AnalyticsOverview.model_json_schema():
        errors.append("Dashboard schema differs from AnalyticsOverview; regenerate and review")
    srs = (DOCS / "academico/FD03-Especificacion-Requerimientos.md").read_text(encoding="utf-8")
    for prefix, count in (("RF",18), ("RNF",10)):
        for n in range(1,count+1):
            if not re.search(rf"^\| {prefix}-{n:02d} \|",srs,re.M):
                errors.append(f"Missing structured requirement: {prefix}-{n:02d}")
    scenarios = re.findall(
        r"^##### 5\.2\.3\.\d+\. CU-(\d{2}) [^\n]+\n(.*?)(?=^##### |^#### |^### |^## |\Z)",
        srs, flags=re.M | re.S,
    )
    if [number for number, _ in scenarios] != [f"{n:02d}" for n in range(1, 16)]:
        errors.append("Expected fifteen complete use-case scenarios in order (CU-01 to CU-15)")
    for number, block in scenarios:
        for field in ("Actor principal", "Precondiciones", "Disparador", "Flujo principal", "Flujos alternativos", "Excepciones y errores", "Postcondiciones", "Verificación"):
            if not re.search(rf"^\| {re.escape(field)} \|\s*\S", block, re.M):
                errors.append(f"CU-{number} lacks {field}")
    fd01 = (DOCS / "academico/FD01-Informe-Factibilidad.md").read_text(encoding="utf-8")
    required_index = [
        "1. DESCRIPCIÓN DEL PROYECTO", "1.1. NOMBRE DEL PROYECTO",
        "1.2. DURACIÓN DEL PROYECTO", "1.3. DESCRIPCIÓN", "1.4. OBJETIVOS",
        "1.4.1. OBJETIVO GENERAL", "1.4.2. OBJETIVOS ESPECÍFICOS",
        "2. RIESGOS", "3. ANÁLISIS DE LA SITUACIÓN ACTUAL",
        "3.1. PLANTEAMIENTO DEL PROBLEMA", "3.2. CONSIDERACIONES DE HARDWARE Y SOFTWARE",
        "4. ESTUDIO DE FACTIBILIDAD", "4.1. FACTIBILIDAD TÉCNICA",
        "4.2. FACTIBILIDAD ECONÓMICA", "4.3. FACTIBILIDAD OPERATIVA",
        "4.4. FACTIBILIDAD LEGAL", "4.5. FACTIBILIDAD SOCIAL",
        "4.6. FACTIBILIDAD AMBIENTAL", "5. ANÁLISIS FINANCIERO",
        "5.1. JUSTIFICACIÓN DE LA INVERSIÓN", "5.2. BENEFICIOS DEL PROYECTO",
        "5.2.1. BENEFICIOS TANGIBLES", "5.2.2. BENEFICIOS INTANGIBLES",
        "5.3. TABLA DE EGRESOS OPERATIVOS ANUALES", "5.4. TABLA DE INGRESOS ANUALES",
        "5.5. MATRIZ DEL FLUJO DE CAJA NETO", "5.6. CRITERIOS DE INVERSIÓN",
        "5.6.1. VALOR ACTUAL NETO (VAN)", "5.6.2. TASA INTERNA DE RETORNO",
        "5.6.3. RELACIÓN BENEFICIO/COSTO (B/C)", "6. CONCLUSIONES",
    ]
    headings = list(re.finditer(r"^#{2,4} (.+)$", fd01, re.M))
    actual = [h.group(1) for h in headings if h.group(1) in required_index]
    if actual != required_index:
        errors.append("FD01: required academic index is missing, duplicated or out of order")
    for i, heading in enumerate(headings):
        if heading.group(1) in required_index:
            depth = len(heading.group(0).split(" ", 1)[0])
            end = next((h.start() for h in headings[i+1:]
                        if len(h.group(0).split(" ", 1)[0]) <= depth), len(fd01))
            content = re.sub(r"^#{2,4} .+$", "", fd01[heading.end():end], flags=re.M)
            if not content.strip():
                errors.append(f"FD01: empty section {heading.group(1)}")
    financial = json.loads((ROOT / "scripts/documentation-finance.json").read_text(encoding="utf-8"))
    net = financial["annual_benefit"]-financial["annual_cost"]
    initial, years, rate = financial["initial_investment"],financial["years"],financial["discount_rate"]
    npv = lambda r: -initial+sum(net/(1+r)**n for n in range(1,years+1))
    low,high=-.99,10
    for _ in range(150):
        middle=(low+high)/2
        if npv(middle)>0: low=middle
        else: high=middle
    factor=sum(1/(1+rate)**n for n in range(1,years+1))
    result={"expected_npv":round(npv(rate),2),"expected_irr_percent":round((low+high)/2*100,2),"expected_benefit_cost":round(financial["annual_benefit"]*factor/(initial+financial["annual_cost"]*factor),4)}
    if any(financial[key]!=value for key,value in result.items()):
        errors.append("Financial scenario calculations do not reconcile")
    for file in ("FD01-Informe-Factibilidad.md","FD05-Informe-Final.md"):
        text=(DOCS/"academico"/file).read_text(encoding="utf-8")
        # Accept Spanish decimal commas and grouped amounts, retaining sign and precision.
        text = re.sub(r"(?<=\d)[ \u00a0\u202f](?=\d)", "", text).replace(",", ".")
        for value in (f"{result['expected_npv']:.2f}",f"{result['expected_irr_percent']:.2f}%",f"{result['expected_benefit_cost']:.4f}"):
            if value not in text: errors.append(f"{file}: missing or stale financial result {value}")
    return errors


class HtmlReferences(HTMLParser):
    def __init__(self):
        super().__init__(); self.targets=[]; self.ids=set()
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if "id" in attrs: self.ids.add(attrs["id"])
        for key in ("href","src"):
            if key in attrs: self.targets.append(attrs[key])


def artifact_errors() -> list[str]:
    errors=[]
    manifest_path=OUTPUT/"manifest.json"
    if not manifest_path.exists(): return ["No manifest; run python scripts/build_docs.py"]
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    expected={e["source"] for e in entries()}
    actual={e["source"] for e in manifest["documents"]}
    if expected!=actual:
        errors.append(f"Artifact coverage differs: missing={sorted(expected-actual)}, unexpected={sorted(actual-expected)}")
    from pypdf import PdfReader
    for record in manifest["documents"]:
        source=ROOT/record["source"]
        if record["source_sha256"]!=sha(source): errors.append(f"Stale source in artifact: {record['source']}")
        copied=OUTPUT/record["copied_source"]
        if not copied.exists() or sha(copied)!=record["source_sha256"]: errors.append(f"Missing or changed source copy: {record['source']}")
        for kind in ("html","pdf"):
            path=OUTPUT/record[kind]
            if not path.exists() or sha(path)!=record[f"{kind}_sha256"]:
                errors.append(f"Missing or modified {kind}: {record['source']}")
        pdf=OUTPUT/record["pdf"]
        if pdf.exists():
            pages=PdfReader(pdf).pages
            if len(pages)!=record["pages"] or len(pages)==0: errors.append(f"PDF page mismatch: {pdf}")
            if any(not (page.extract_text() or "").strip() for page in pages): errors.append(f"Empty PDF page: {pdf}")
        text=source.read_text(encoding="utf-8")
        count=len(re.findall(r"```mermaid\s*\n",text))
        if record["diagram_count"]!=count: errors.append(f"Lost figure count: {record['source']}")
    for item in manifest["diagrams"]:
        path=OUTPUT/item["svg"]
        if not path.exists() or sha(path)!=item["sha256"]: errors.append(f"Missing or changed figure: {path}")
        png = OUTPUT/item["png"]
        if not png.exists() or sha(png)!=item["png_sha256"]: errors.append(f"Missing or changed PDF figure: {png}")
    for item in manifest["resources"]+manifest["contracts"]:
        path=OUTPUT/item["artifact"]
        if not path.exists() or sha(path)!=item["sha256"]: errors.append(f"Missing or changed resource: {path}")
    for path in OUTPUT.rglob("*.html"):
        parser=HtmlReferences();parser.feed(path.read_text(encoding="utf-8"))
        for target in parser.targets:
            parsed=urlsplit(target)
            if parsed.scheme or parsed.netloc:continue
            resolved=(path.parent/unquote(parsed.path)).resolve() if parsed.path else path
            if not resolved.is_relative_to(OUTPUT): errors.append(f"Generated link escapes artifact package: {path} -> {target}")
            elif not resolved.exists(): errors.append(f"Broken generated link: {path} -> {target}")
            elif parsed.fragment and resolved.suffix==".html":
                destination=HtmlReferences();destination.feed(resolved.read_text(encoding="utf-8"))
                if unquote(parsed.fragment) not in destination.ids: errors.append(f"Broken generated anchor: {path} -> {target}")
    return errors
