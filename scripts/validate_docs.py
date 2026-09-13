"""Validate relative Markdown links used by the repository documentation."""

from pathlib import Path
import re
import sys
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_FILES = [ROOT / "README.md", ROOT / "CONTRIBUTING.md"] + sorted(
    (ROOT / "docs").glob("*.md")
)
LINK_PATTERN = re.compile(r"\]\(([^)]+)\)")


def validate_links() -> list[str]:
    errors: list[str] = []
    for markdown_file in MARKDOWN_FILES:
        content = markdown_file.read_text(encoding="utf-8")
        for target in LINK_PATTERN.findall(content):
            target = target.split("#", 1)[0].strip()
            if not target or target.startswith(("http://", "https://", "mailto:")):
                continue

            target = unquote(target).strip("<>")
            resolved = (markdown_file.parent / target).resolve()
            if not resolved.exists():
                errors.append(f"{markdown_file.relative_to(ROOT)} -> {target}")
    return errors


def main() -> int:
    errors = validate_links()
    if errors:
        print("Broken local Markdown links:")
        print("\n".join(f"- {error}" for error in errors))
        return 1

    print(f"Validated {len(MARKDOWN_FILES)} Markdown files and all local links.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
