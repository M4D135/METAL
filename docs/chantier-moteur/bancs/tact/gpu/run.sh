#!/bin/bash
# Usage: run.sh page.html WxH  -- Chrome sans interface, file:// seulement, aucun port, profil jetable dans bench/tact.
PAGE="$1"; WIN="${2:-390,844}"
DIR="$(cd "$(dirname "$0")" && pwd)"
timeout 280 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-background-networking --disable-component-update --disable-sync --no-first-run \
  --no-default-browser-check --disable-extensions --metrics-recording-only --disable-domain-reliability \
  --disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions \
  --host-resolver-rules="MAP * ~NOTFOUND" \
  --user-data-dir="$DIR/chrome-profile" --use-angle=metal --ignore-gpu-blocklist \
  --allow-file-access-from-files --window-size="$WIN" --force-device-scale-factor=1 \
  --dump-dom "file://$DIR/$PAGE" 2>/dev/null | python3 -I "$DIR/../../rgpu/extract.py"
