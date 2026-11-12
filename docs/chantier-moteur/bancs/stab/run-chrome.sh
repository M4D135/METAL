#!/bin/bash
# Usage: run-chrome.sh page.html profil   — Chrome sans interface, file:// seulement, aucun port, aucun réseau.
DIR="$(cd "$(dirname "$0")" && pwd)"; PAGE="$1"; PROFILE="$DIR/${2:-chrome-profile}"
timeout 120 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-background-networking --disable-component-update --disable-sync --no-first-run \
  --no-default-browser-check --disable-extensions --metrics-recording-only --disable-domain-reliability \
  --disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions \
  --user-data-dir="$PROFILE" --use-angle=metal --ignore-gpu-blocklist \
  --allow-file-access-from-files --window-size=1440,932 --force-device-scale-factor=2 \
  --dump-dom "file://$DIR/$PAGE" 2>/dev/null \
  | python3 -I -c "import sys,html;s=sys.stdin.read();i=s.rfind('<pre id=\"out\">');j=s.find('>',i)+1;k=s.find('</pre>',j);sys.stdout.write(html.unescape(s[j:k]) if i>=0 else 'no output marker')"
