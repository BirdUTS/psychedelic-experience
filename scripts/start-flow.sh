#!/bin/bash
# Flow with Mind — one click: start the local server (loopback, no gate; the JEV key comes from TYPESAFE_API_KEY
# or the AI Lab .env) and open the app in Chrome. Ctrl+C (or closing the window) stops the server.
# The hosted copy with the same server lives at https://flow.birdview.hk (docs/hosting.md).
cd "$(dirname "$0")/.." || exit 1
PORT=${1:-8766}
URL() { echo "http://127.0.0.1:$1/immersive/"; }
# Reuse a Flow server that is already running; skip ports taken by anything else.
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  if [ "$(curl -s -m 2 -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/decide")" = "400" ]; then
    echo "Flow is already running → $(URL $PORT)"
    open -a "Google Chrome" "$(URL $PORT)" 2>/dev/null || open "$(URL $PORT)"
    exit 0
  fi
  PORT=$((PORT + 1))
done
python3 scripts/serve_worlds.py --port "$PORT" &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT TERM
for _ in $(seq 1 40); do curl -s -m 1 -o /dev/null "$(URL $PORT)" && break; sleep 0.25; done
python3 -c "import sys; sys.path.insert(0, 'scripts'); import serve_worlds as s; print('JEV key:', 'found' if s.load_key() else 'MISSING — set TYPESAFE_API_KEY, the app still runs locally')"
echo "Flow with Mind → $(URL $PORT)   (Ctrl+C to stop)"
echo "In the app: ⚙ → JEV: on · Room mic: on · Talk: on"
open -a "Google Chrome" "$(URL $PORT)" 2>/dev/null || open "$(URL $PORT)"
wait $SERVER
