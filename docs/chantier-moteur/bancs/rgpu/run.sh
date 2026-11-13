#!/bin/bash
# Usage: run.sh page.html [window WxH] [dpr] [virtual-budget-ms]
# Headless Chrome, file:// only, no remote debugging port, no network services.
PAGE="$1"; WIN="${2:-1440,932}"; DPR="${3:-1}"; BUDGET="${4:-}"
DIR="$(cd "$(dirname "$0")" && pwd)"
timeout 300 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-background-networking --disable-component-update --disable-sync --no-first-run \
  --no-default-browser-check --disable-extensions --metrics-recording-only --disable-domain-reliability \
  --disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions \
  --user-data-dir="$DIR/chrome-profile" --use-angle=metal --ignore-gpu-blocklist \
  --allow-file-access-from-files --window-size="$WIN" --force-device-scale-factor="$DPR" \
  ${BUDGET:+--virtual-time-budget=$BUDGET} --dump-dom "file://$DIR/$PAGE" 2>/dev/null \
  | python3 -I "$DIR/extract.py"
