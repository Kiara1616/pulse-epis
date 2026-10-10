"""Regression checks for financial and use-case documentation validation."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("documentation_validation", ROOT / "scripts/documentation_validation.py")
validation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validation)


def replace_document(monkeypatch, relative, old, new):
    original = Path.read_text
    target = ROOT / relative

    def read(path, *args, **kwargs):
        text = original(path, *args, **kwargs)
        return text.replace(old, new) if path == target else text

    monkeypatch.setattr(Path, "read_text", read)


def test_current_docs_reconcile_spanish_finance_and_fifteen_scenarios():
    assert validation.source_errors() == []


def test_incorrect_financial_value_is_rejected(monkeypatch):
    replace_document(monkeypatch, "docs/academico/FD05-Informe-Final.md", "-8 754,12", "-8 754,13")
    assert any("FD05-Informe-Final.md: missing or stale financial result -8754.12" in error
               for error in validation.source_errors())


def test_missing_use_case_is_rejected(monkeypatch):
    replace_document(monkeypatch, "docs/academico/FD03-Especificacion-Requerimientos.md",
                     "##### 5.2.3.15. CU-15", "##### 5.2.3.15. Removed")
    assert any("Expected fifteen complete use-case scenarios" in error
               for error in validation.source_errors())


def test_html_covers_use_current_version_and_date():
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    from documentation import academic_metadata
    for path in (ROOT / "docs/academico").glob("FD*.md"):
        fields = academic_metadata(path.read_text(encoding="utf-8"))
        assert fields["Código"] == path.name.split("-")[0]
        assert fields["Curso"] == "Inteligencia de Negocios"
        assert "2026" in fields["Fecha"]
        assert "2023077087" in fields["Integrantes"]
