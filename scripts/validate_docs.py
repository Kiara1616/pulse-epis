"""Validate complete sources and optional generated documentation artifacts."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from documentation_validation import source_errors, artifact_errors, entries

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts", action="store_true")
    args = parser.parse_args()
    errors = source_errors()
    if args.artifacts:
        errors.extend(artifact_errors())
    if errors:
        print("\n".join("- " + error for error in errors))
        raise SystemExit(1)
    print(f"Validated {len(entries())} source documents, recursive links, migrations, requirements and contracts" + (" and generated artifacts." if args.artifacts else "."))
