#!/bin/bash
# Headless Chrome, file:// only, no remote debugging port, own throw-away profile in this folder.
PAGE="$1"; WIN="${2:-1440,932}"
DIR="$(cd "$(dirname "$0")" && pwd)"
timeout 400 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-background-networking --disable-component-update --disable-sync --no-first-run \
  --no-default-browser-check --disable-extensions --metrics-recording-only --disable-domain-reliability \
  --disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions \
  --user-data-dir="$DIR/chrome-profile" --use-angle=metal --ignore-gpu-blocklist \
  --allow-file-access-from-files --window-size="$WIN" --force-device-scale-factor=1 \
  --dump-dom "file://$DIR/$PAGE" 2>/dev/null | python3 -I "$DIR/../rgpu/extract.py"
