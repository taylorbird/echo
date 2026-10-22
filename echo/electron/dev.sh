#!/usr/bin/env bash
#
# Runs echo on Electron against the Vite dev server, with live reload of the web app.
#
# Usage: echo/electron/dev.sh [--identifier ID] [--port PORT]
#
#   --identifier  default dev.tbird.echo.dev, the dev builds' data folder; never use an installed
#                 echo's identifier here.
#   --port        Vite's port, default 3000 ($ECHO_DEV_PORT).
#
# The main process is rebuilt each run (debug core); restart this script after changing
# electron/ or echo/electron/.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

die() {
	echo "error: $*" >&2
	exit 1
}

IDENTIFIER="dev.tbird.echo.dev"
PORT="${ECHO_DEV_PORT:-3000}"
while [[ $# -gt 0 ]]; do
	case "$1" in
	--identifier)
		IDENTIFIER="${2:?--identifier needs a value}"
		shift 2
		;;
	--port)
		PORT="${2:?--port needs a value}"
		shift 2
		;;
	*) die "unknown argument: $1" ;;
	esac
done
[[ "$IDENTIFIER" == dev.tbird.echo.* ]] || die "dev runs need a dev.tbird.echo.* identifier, not $IDENTIFIER"

unset SABLE_BUILD_FLAVOR
export SABLE_IDENTIFIER="$IDENTIFIER"

echo "==> Building the main process ($IDENTIFIER)"
pnpm --dir "$REPO_ROOT/electron" run build

# A server already on the port would answer the readiness check below in place of
# ours, and the window would load whatever that older server has (it doesn't
# watch echo/, see vite.config.ts), so refuse rather than reuse it.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
	die "port $PORT is already in use; stop that server (lsof -nP -iTCP:$PORT -sTCP:LISTEN) or pass --port"
fi

echo "==> Starting Vite on port $PORT"
pnpm --dir "$REPO_ROOT" dev --port "$PORT" --strictPort &
VITE_PID=$!
# pnpm runs Vite as a child; stopping only pnpm left Vite serving on the port.
trap 'pkill -P "$VITE_PID" 2>/dev/null; kill "$VITE_PID" 2>/dev/null || true' EXIT

# Up to 20 minutes: `pnpm dev` builds the wasm core before Vite listens, and a cold build of
# it has taken over 5 minutes.
for _ in $(seq 1 2400); do
	curl -sf -o /dev/null "http://localhost:$PORT/" && break
	kill -0 "$VITE_PID" 2>/dev/null || die "Vite exited"
	sleep 0.5
done
curl -sf -o /dev/null "http://localhost:$PORT/" || die "Vite did not answer on port $PORT"

echo "==> Starting Electron"
SABLE_DEV_URL="http://localhost:$PORT" pnpm --dir "$REPO_ROOT/electron" exec electron .
