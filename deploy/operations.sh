#!/usr/bin/env bash
# Run on the Linux deployment host; never source the secret .env as shell code.
set -Eeuo pipefail
umask 077
action=${1:?Expected backup, verify-backup or rollback}
root=${2:?Expected absolute deployment directory}
project=${PULSE_COMPOSE_PROJECT:-pulse-epis}
[[ "$root" = /* && "$root" != / ]] || { echo 'Invalid deployment directory' >&2; exit 1; }
cd "$root"
root=$(pwd -P)
exec 9>"$root/.operations.lock"
flock -w 300 9
compose() { docker compose --project-name "$project" --env-file "$root/.env" -f "$root/current/compose.yaml" --profile staging "$@"; }

case "$action" in
  backup)
    mkdir -p backups
    name="pulse-$(date -u +%Y%m%dT%H%M%SZ)-$$"
    tmp=$(mktemp -d "$root/backups/.partial-XXXXXX")
    trap 'rm -rf -- "$tmp"' EXIT
    compose exec -T database sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$tmp/database.dump"
    # Include private uploaded files; no payload is printed to the Actions log.
    compose exec -T backend python -c 'import sys,tarfile; t=tarfile.open(fileobj=sys.stdout.buffer,mode="w|gz"); t.add("/app/.data/evidence",arcname="evidence"); t.close()' > "$tmp/evidence.tar.gz"
    test -s "$tmp/database.dump"
    gzip -t "$tmp/evidence.tar.gz"
    (cd "$tmp"; sha256sum database.dump evidence.tar.gz > SHA256SUMS)
    mv "$tmp" "$root/backups/$name"
    trap - EXIT
    echo "$name"
    # A backup is retained until it is at least 30 days old.
    find "$root/backups" -mindepth 1 -maxdepth 1 -type d -name 'pulse-*' -mtime +30 -exec rm -rf -- {} +
    ;;
  verify-backup)
    name=${3:?Expected backup directory name}
    [[ "$name" =~ ^pulse-[0-9]{8}T[0-9]{6}Z-[0-9]+$ ]] || exit 1
    backup="$root/backups/$name"
    (cd "$backup"; sha256sum -c -s SHA256SUMS)
    gzip -t "$backup/evidence.tar.gz"
    compose exec -T backend python -c 'import hashlib,sys,tarfile,tempfile,pathlib; t=tarfile.open(fileobj=sys.stdin.buffer,mode="r|gz"); temp=tempfile.TemporaryDirectory(); root=pathlib.Path(temp.name); count=0
for member in t:
 if not (member.isdir() or member.isfile()): raise SystemExit("Unsupported backup member")
 if member.isfile():
  tarfile.data_filter(member,str(root)); data=t.extractfile(member).read(); target=root/member.name; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data); assert hashlib.sha256(data).digest() == hashlib.sha256(target.read_bytes()).digest(); count+=1
 else: t.extract(member,path=root,filter="data")
print("Restored private evidence files:",count)' < "$backup/evidence.tar.gz"
    scratch="pulse_restore_check_$$"
    # Restore into an isolated database; leave the live database untouched.
    compose exec -T database sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$scratch"
    cleanup() { compose exec -T database sh -c 'dropdb --if-exists -U "$POSTGRES_USER" "$1"' sh "$scratch"; }
    trap cleanup EXIT
    compose exec -T database sh -c 'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$1"' sh "$scratch" < "$backup/database.dump"
    compose exec -T database sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -c "SELECT version_num FROM alembic_version; SELECT count(*) FROM users; SELECT count(*) FROM certifications;"' sh "$scratch"
    echo 'Backup integrity and isolated PostgreSQL restoration succeeded.'
    ;;
  rollback)
    release=${3:?Expected release directory name}
    [[ "$release" =~ ^previous-[0-9]{14}$ ]] || { echo 'Invalid rollback release' >&2; exit 1; }
    test -d "$root/releases/$release"
    test ! -L "$root/releases/$release"
    candidate="$root/releases/$release/compose.yaml"
    docker compose --project-name "$project" --env-file "$root/.env" -f "$candidate" --profile staging config --quiet
    # Rebuild the selected revision: shared latest image tags are not a rollback.
    docker compose --project-name "$project" --env-file "$root/.env" -f "$candidate" --profile staging build backend frontend
    old="failed-$(date -u +%Y%m%d%H%M%S)"
    mv "$root/current" "$root/releases/$old"
    cp -a "$root/releases/$release" "$root/current"
    if ! compose up -d --wait --wait-timeout 180 --remove-orphans; then
      mv "$root/current" "$root/releases/rollback-attempt-$(date -u +%Y%m%d%H%M%S)"
      mv "$root/releases/$old" "$root/current"
      compose up -d --build --wait --wait-timeout 180 --remove-orphans
      exit 1
    fi
    ;;
  *) echo 'Unsupported operation' >&2; exit 1 ;;
esac
