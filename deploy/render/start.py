"""Single-origin Render deployment; stop the service if any child exits."""
from __future__ import annotations

import os
from pathlib import Path
import signal
import subprocess
import time


def configure_environment(environ: dict[str, str]) -> None:
    url = environ.get('PULSE_DATABASE_URL', '')
    for prefix in ('postgres://', 'postgresql://'):
        if url.startswith(prefix):
            environ['PULSE_DATABASE_URL'] = 'postgresql+psycopg://' + url[len(prefix):]
            break
    public_url = environ.get('RENDER_EXTERNAL_URL', '').rstrip('/')
    if public_url:
        environ['PULSE_GOOGLE_REDIRECT_URI'] = public_url + '/api/v1/auth/google/callback'
        environ['PULSE_AUTH_SUCCESS_REDIRECT'] = public_url + '/'
        environ['PULSE_CORS_ALLOWED_ORIGINS'] = public_url


def main() -> int:
    configure_environment(os.environ)
    port = int(os.environ.get('PORT', '10000'))
    if not 1024 <= port <= 65535:
        raise SystemExit('PORT must be between 1024 and 65535')
    evidence = Path(os.environ.get('PULSE_EVIDENCE_STORAGE_PATH', '/var/data/evidence'))
    evidence.mkdir(parents=True, exist_ok=True)
    if os.getuid() == 0:
        os.chown(evidence, 1000, 1000)
        os.setgid(1000)
        os.setuid(1000)
    config = Path('/tmp/pulse-nginx.conf')
    config.write_text(Path('/app/deploy/render/nginx.conf').read_text().replace('__PORT__', str(port)))
    subprocess.run(['alembic', '-c', '/app/backend/alembic.ini', 'upgrade', 'head'], check=True)
    children: list[subprocess.Popen] = []
    stopping = False

    def stop(*_args):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        children.append(subprocess.Popen(['uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8000', '--no-access-log']))
        children.append(subprocess.Popen(['node', 'server.js'], cwd='/app/frontend', env={**os.environ, 'PORT': '3000', 'HOSTNAME': '127.0.0.1'}))
        children.append(subprocess.Popen(['nginx', '-c', str(config), '-g', 'daemon off;']))
        while not stopping:
            if any(child.poll() is not None for child in children):
                return 1
            time.sleep(0.5)
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == '__main__':
    raise SystemExit(main())
