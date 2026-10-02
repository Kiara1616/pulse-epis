"""Generate FD01-FD05 using the same complete documentation engine."""
from documentation import build

if __name__ == "__main__":
    build(academic_only=True)
