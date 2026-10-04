#!/usr/bin/env bash
# Deploy the Dune Tournament Docker stack (web + api + Postgres) over SSH.
#
#   ./deploy/deploy.sh dev            # Orange Pi test server (default 192.168.2.22)
#   ./deploy/deploy.sh prod           # production server (set PROD_HOST)
#   ./deploy/deploy.sh dev status|logs [service]|stop|backup|token
#
# Settings (environment variables):
#   SSH_USER   default root
#   SSH_KEY    default ~/.ssh/id_rsa_dunerank
#   DEV_HOST   default 192.168.2.22      DEV_PORT   default 8090
#   PROD_HOST  required for prod        PROD_PORT  default 8080
#
# The first deploy creates <remote dir>/.env with a random database password
# and organizer token. It is never overwritten; edit it on the server.

set -euo pipefail

ENVIRONMENT="${1:-}"
COMMAND="${2:-deploy}"
SSH_USER="${SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa_dunerank}"

case "$ENVIRONMENT" in
  dev)
    HOST="${DEV_HOST:-192.168.2.22}"
    PORT="${DEV_PORT:-8090}"
    REMOTE_DIR="/opt/dune-tournament-dev"
    PROJECT="dune-tournament-dev"
    ;;
  prod)
    HOST="${PROD_HOST:?Set PROD_HOST to the production server address}"
    PORT="${PROD_PORT:-8080}"
    REMOTE_DIR="/opt/dune-tournament"
    PROJECT="dune-tournament"
    ;;
  *)
    sed -n '2,15p' "$0"
    exit 1
    ;;
esac

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

remote() {
  ssh "${SSH_OPTS[@]}" "$SSH_USER@$HOST" "$@"
}

compose() {
  remote "cd $REMOTE_DIR && docker compose -p $PROJECT --env-file .env $*"
}

sync_files() {
  echo -e "${BLUE}Syncing files to $SSH_USER@$HOST:$REMOTE_DIR ...${NC}"
  remote "mkdir -p $REMOTE_DIR"
  rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
    --exclude '.git' --exclude 'node_modules' --exclude 'dist' --exclude 'test-results' \
    --exclude '*.png' --exclude '.env' --exclude 'backups' \
    "$REPO_ROOT/" "$SSH_USER@$HOST:$REMOTE_DIR/"
}

ensure_env() {
  # Create .env once with random secrets; keep it on later deploys
  remote "cd $REMOTE_DIR && if [ ! -f .env ]; then
    printf 'WEB_PORT=%s\nPOSTGRES_DB=dune_tournament\nPOSTGRES_USER=dune\nPOSTGRES_PASSWORD=%s\nADMIN_TOKEN=%s\n' \
      '$PORT' \"\$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')\" \"\$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')\" > .env
    chmod 600 .env
    echo 'Created .env with new secrets.'
  fi"
}

case "$COMMAND" in
  deploy)
    sync_files
    ensure_env
    echo -e "${GREEN}Building and starting $PROJECT on $HOST ...${NC}"
    compose "up -d --build --remove-orphans"
    echo -e "${BLUE}Waiting for the API ...${NC}"
    for i in $(seq 1 30); do
      if remote "wget -qO- http://localhost:$PORT/api/health >/dev/null 2>&1 || curl -fsS http://localhost:$PORT/api/health >/dev/null 2>&1"; then
        echo -e "${GREEN}Up: http://$HOST:$PORT${NC}"
        echo -e "${YELLOW}Organizer token: ./deploy/deploy.sh $ENVIRONMENT token${NC}"
        exit 0
      fi
      sleep 3
    done
    echo -e "${YELLOW}API did not answer yet. Check: ./deploy/deploy.sh $ENVIRONMENT logs api${NC}"
    exit 1
    ;;
  status)
    compose "ps"
    ;;
  logs)
    compose "logs -f --tail=200 ${3:-}"
    ;;
  stop)
    compose "stop"
    ;;
  token)
    remote "grep '^ADMIN_TOKEN=' $REMOTE_DIR/.env | cut -d= -f2-"
    ;;
  backup)
    mkdir -p "$REPO_ROOT/backups"
    FILE="$REPO_ROOT/backups/${PROJECT}-$(date +%Y%m%d-%H%M%S).sql.gz"
    remote "cd $REMOTE_DIR && docker compose -p $PROJECT --env-file .env exec -T db sh -c 'pg_dump -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\"' | gzip" > "$FILE"
    echo -e "${GREEN}Backup written to $FILE${NC}"
    ;;
  *)
    echo "Unknown command: $COMMAND"
    exit 1
    ;;
esac
