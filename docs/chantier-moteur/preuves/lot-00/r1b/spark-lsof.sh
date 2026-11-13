#!/bin/bash
# Lot 00 / R1b on the Spark: Internet sockets held by the Chrome processes of one run.
# Every 0.1 s: browser processes (command line carrying a metal-render- profile), their process
# groups (Chrome is started in its own group), then lsof -i on every member. One Chrome at a time.
B=$HOME/metal-tests/lot00-r1b
export LC_NUMERIC=C
export NVM_DIR=$HOME/.nvm; . "$NVM_DIR/nvm.sh" >/dev/null; nvm use 24 >/dev/null
name=$1; shift
envs=(); while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift
tmp=$B/tmp/$name; rm -rf "$tmp"; mkdir -p "$tmp"
out=$B/out/$name; : > "$out.lsof.txt"; : > "$out.pids.txt"
( cd "$B/apres" && env TMPDIR="$tmp" "${envs[@]}" timeout 900 node "$@" > "$out.json" 2> "$out.err" ) &
runner=$!
samples=0
while kill -0 $runner 2>/dev/null; do
  browsers=$(pgrep -u "$USER" -f -- '--user-data-dir=[^ ]*metal-render-' | paste -sd' ')
  if [ -n "$browsers" ]; then
    members=$(for b in $browsers; do g=$(ps -o pgid= -p "$b" | tr -d ' '); [ -n "$g" ] && pgrep -g "$g"; done | sort -u | paste -sd,)
    if [ -n "$members" ]; then
      samples=$((samples+1)); echo "$members" | tr ',' '\n' >> "$out.pids.txt"
      lsof -nP -a -i -p "$members" 2>/dev/null | grep -v '^COMMAND' >> "$out.lsof.txt"
    fi
  fi
  sleep 0.1
done
wait $runner; code=$?
pids=$(sort -u "$out.pids.txt" | wc -l)
printf '== %s (%s) code=%s ; échantillons avec Chrome : %s ; processus Chrome vus : %s ; sockets Internet : %s ; restes dans TMPDIR : %s\n' \
  "$name" "${envs[*]}" "$code" "$samples" "$pids" "$(wc -l < "$out.lsof.txt")" "$(ls -A "$tmp" | wc -l)"
grep -E '^(Chrome|GPU|Contrôles)' "$out.err" | cut -c1-200 | sed 's/^/   /'
