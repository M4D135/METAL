#!/bin/bash
# Usage: runfresh.sh page.html profil  -> profil Chrome dedie (cache de shaders froid au premier lancement)
PAGE="$1"; PROF="$2"; DIR="$(cd "$(dirname "$0")" && pwd)"
timeout 120 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-background-networking --disable-component-update --disable-sync --no-first-run \
  --no-default-browser-check --disable-extensions --metrics-recording-only --disable-domain-reliability \
  --disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions \
  --user-data-dir="$DIR/$PROF" --use-angle=metal --ignore-gpu-blocklist \
  --allow-file-access-from-files --window-size=1280,800 --force-device-scale-factor=2 \
  --dump-dom "file://$DIR/$PAGE" 2>/dev/null | python3 -I "$DIR/../rgpu/extract.py"
