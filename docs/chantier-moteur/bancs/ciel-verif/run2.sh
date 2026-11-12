#!/bin/bash
# Usage: run2.sh 'page.html#mode,args' outdir [json] ; sans temps virtuel (mesures réelles), file:// seulement, aucun port.
PAGE="$1"; OUT="$2"; JSON="${3:-}"; WIN="${4:-1600,900}"
DIR="$(cd "$(dirname "$0")" && pwd)"
timeout 270 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-background-networking --disable-component-update --disable-sync --no-first-run \
  --no-default-browser-check --disable-extensions --metrics-recording-only --disable-domain-reliability \
  --disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions \
  --user-data-dir="$DIR/chrome-profile" --use-angle=metal --ignore-gpu-blocklist \
  --allow-file-access-from-files --window-size="$WIN" --force-device-scale-factor=1 \
  --dump-dom "file://$DIR/$PAGE" 2>/dev/null \
  | python3 -I "$DIR/extract.py" "$OUT" $JSON
