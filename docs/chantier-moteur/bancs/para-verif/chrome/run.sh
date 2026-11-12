#!/bin/bash
# Usage : run.sh page.html [attente_s=60]   (Chrome sans interface, file:// seulement, aucun port, aucun serveur)
# La page se termine par <script src="gate.js"> : gate.js est un tube nomme (FIFO) qui retient la fin du chargement,
# donc --dump-dom, jusqu'a ce que ce script y ecrive. Resultat : <page>.out (le JSON est dans <pre id="out">).
PAGE="$1"; WAIT="${2:-60}"; DIR="$(cd "$(dirname "$0")" && pwd)"
rm -f "$DIR/gate.js"; mkfifo "$DIR/gate.js"
( timeout $((WAIT+90)) "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-background-networking --disable-component-update --disable-sync --no-first-run --no-default-browser-check \
  --disable-extensions --metrics-recording-only --disable-domain-reliability \
  --disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions \
  --user-data-dir="$DIR/profile" --use-angle=metal --ignore-gpu-blocklist --window-size=800,600 \
  --dump-dom "file://$DIR/$PAGE" > "$DIR/${PAGE%.html}.out" 2> "$DIR/${PAGE%.html}.err" ) &
sleep "$WAIT"; ( echo "document.body.dataset.gate='open';" > "$DIR/gate.js" ) & W=$!
sleep 8; timeout 3 cat "$DIR/gate.js" > /dev/null 2>&1; kill $W 2>/dev/null; wait 2>/dev/null; rm -f "$DIR/gate.js"
python3 -I -c "
import re,json,html,sys
t=open(sys.argv[1]).read();m=re.search(r'<pre id=\"out\">(.*?)</pre>',t,re.S);print(html.unescape(m.group(1)) if m else 'pas de sortie')" "$DIR/${PAGE%.html}.out"
