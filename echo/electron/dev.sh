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

# Stops a process and everything under it, deepest first. Vite runs as pnpm's grandchild
# (pnpm, then the script's shell, then node), and killing pnpm and its direct children left it
# serving on the port, so the next run failed with the port in use.
kill_tree() {
	local child
	for child in $(pgrep -P "$1" 2>/dev/null); do
		kill_tree "$child"
	done
	kill "$1" 2>/dev/null || true
}

VITE_PID=""
ELECTRON_PID=""
cleanup() {
	[[ -z "$ELECTRON_PID" ]] || kill_tree "$ELECTRON_PID"
	[[ -z "$VITE_PID" ]] || kill_tree "$VITE_PID"
}
trap cleanup EXIT

echo "==> Starting Vite on port $PORT"
pnpm --dir "$REPO_ROOT" dev --port "$PORT" --strictPort &
VITE_PID=$!

# Up to 20 minutes: `pnpm dev` builds the wasm core before Vite listens, and a cold build of
# it has taken over 5 minutes.
for _ in $(seq 1 2400); do
	curl -sf -o /dev/null "http://localhost:$PORT/" && break
	kill -0 "$VITE_PID" 2>/dev/null || die "Vite exited"
	sleep 0.5
done
curl -sf -o /dev/null "http://localhost:$PORT/" || die "Vite did not answer on port $PORT"

echo "==> Starting Electron"
# In the background and waited on, so a signal to this script is handled at once rather than
# after Electron exits.
SABLE_DEV_URL="http://localhost:$PORT" pnpm --dir "$REPO_ROOT/electron" exec electron . &
ELECTRON_PID=$!
wait "$ELECTRON_PID"
