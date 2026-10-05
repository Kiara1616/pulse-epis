"""Exercise backup, isolated restore and rollback against disposable Docker data."""
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'pulse-ops-verification'
IMAGE = 'pulse-epis-completion:verify'


def main():
    with tempfile.TemporaryDirectory(prefix='pulse-ops-') as temp:
        directory = Path(temp)
        current = directory / 'current'
        current.mkdir()
        (directory / '.env').write_text('')
        (current / 'compose.yaml').write_text(f'''services:
  database:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: pulse
      POSTGRES_PASSWORD: synthetic-only
      POSTGRES_DB: pulse
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "pulse"]
      interval: 2s
      retries: 30
  backend:
    image: {IMAGE}
    command: ["python", "-c", "import pathlib,time; p=pathlib.Path('/app/.data/evidence'); p.mkdir(parents=True,exist_ok=True); (p/'synthetic.txt').write_text('synthetic private evidence'); time.sleep(3600)"]
    environment:
      PULSE_DATABASE_URL: postgresql+psycopg://pulse:synthetic-only@database/pulse
      REVISION: current
  frontend:
    image: {IMAGE}
    command: ["python", "-c", "import time; time.sleep(3600)"]
''')
        compose = ['docker', 'compose', '--project-name', PROJECT, '-f', str(current / 'compose.yaml')]
        def run(arguments):
            result = subprocess.run(arguments, capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(result.stdout + '\n' + result.stderr)
            return result.stdout.strip()
        helper = ['docker', 'run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', f'{directory}:/ops', '-v', f'{ROOT / "deploy"}:/scripts:ro', '-e', f'PULSE_COMPOSE_PROJECT={PROJECT}', 'docker:29-cli', 'sh', '-c']
        try:
            run(compose + ['up', '-d', '--wait', '--wait-timeout', '90'])
            run(compose + ['exec', '-T', 'backend', 'alembic', '-c', '/app/backend/alembic.ini', 'upgrade', 'head'])
            run(compose + ['exec', '-T', 'database', 'psql', '-U', 'pulse', '-d', 'pulse', '-c', "INSERT INTO users (id,email,role,is_active) VALUES ('00000000-0000-0000-0000-000000000001','synthetic@pilot.test','ADMIN',true)"])
            output = run(helper + ['apk add --no-cache bash util-linux >/dev/null && bash /scripts/operations.sh backup /ops'])
            backup = output.splitlines()[-1]
            print(run(helper + [f'apk add --no-cache bash util-linux >/dev/null && bash /scripts/operations.sh verify-backup /ops {backup}']))
            previous = directory / 'releases/previous-20260101000000'
            shutil.copytree(current, previous)
            file = previous / 'compose.yaml'
            file.write_text(file.read_text().replace('REVISION: current', 'REVISION: previous'))
            run(helper + ['apk add --no-cache bash util-linux >/dev/null && bash /scripts/operations.sh rollback /ops previous-20260101000000'])
            assert run(compose + ['exec', '-T', 'backend', 'printenv', 'REVISION']) == 'previous'
            live_count = run(compose + ['exec', '-T', 'database', 'psql', '-U', 'pulse', '-d', 'pulse', '-tAc', 'SELECT count(*) FROM users'])
            assert live_count == '1'
            print('Rollback selected the previous revision and preserved live data.')
            dump = directory / 'backups' / backup / 'database.dump'
            dump.write_bytes(b'corrupted backup')
            result = subprocess.run(helper + [f'apk add --no-cache bash util-linux >/dev/null && bash /scripts/operations.sh verify-backup /ops {backup}'], capture_output=True)
            assert result.returncode != 0
            print('Corrupted backup rejected before restoration.')
        finally:
            subprocess.run(compose + ['down', '--volumes', '--remove-orphans'], check=False, capture_output=True)


if __name__ == '__main__':
    main()
