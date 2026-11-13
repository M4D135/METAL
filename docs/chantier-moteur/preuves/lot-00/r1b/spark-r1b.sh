#!/bin/bash
# Lot 00 / R1b on the Spark: one Chrome at a time, everything under ~/metal-tests/lot00-r1b.
# avant/ = tools/render of 3ca8016 (R1), apres/ = tools/render of the R1b working tree.
# Each run gets its own TMPDIR: Node puts the throw-away profiles there and, under Linux,
# Chrome its single-instance folder (com.google.Chrome.XXXXXX); what is left is listed.
B=$HOME/metal-tests/lot00-r1b
export LC_NUMERIC=C
export NVM_DIR=$HOME/.nvm; . "$NVM_DIR/nvm.sh" >/dev/null; nvm use 24 >/dev/null
OUT=$B/out; mkdir -p "$OUT"
echo "node $(node --version) ; $(google-chrome --version) ; $(uname -srm) ; charge $(cut -d' ' -f1-3 /proc/loadavg)"
run() { # name tree [VAR=value ...] -- script args...
  local name=$1 tree=$2; shift 2
  local envs=()
  while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift
  local tmp=$B/tmp/$name; rm -rf "$tmp"; mkdir -p "$tmp"
  local t0 t1 code
  t0=$(date +%s.%N)
  ( cd "$B/$tree" && env TMPDIR="$tmp" "${envs[@]}" timeout 900 node "$@" > "$OUT/$name.json" 2> "$OUT/$name.err" ); code=$?
  t1=$(date +%s.%N)
  ls -A "$tmp" > "$OUT/$name.tmp-left.txt"
  printf '== %s (%s %s) code=%s %.1f s ; restes dans TMPDIR : %s\n' "$name" "$tree" "${envs[*]}" "$code" "$(echo "$t1 - $t0" | bc)" "$(wc -l < "$OUT/$name.tmp-left.txt")"
  grep -E '^(Chrome|Drapeaux|GPU|Contrôles|ÉCHEC)' "$OUT/$name.err" | cut -c1-220 | sed 's/^/   /'
}
case "${1:-all}" in
  avant|all)
    run avant-ss avant -- tools/render/self-check.mjs
    run avant-envvk avant METAL_RENDER_ANGLE=vulkan -- tools/render/self-check.mjs
    run avant-optvk avant -- tools/render/self-check.mjs --angle vulkan
    ;;&
  apres|all)
    run apres-ss-a apres -- tools/render/self-check.mjs
    run apres-ss-b apres -- tools/render/self-check.mjs --compare "$OUT/apres-ss-a.json"
    run apres-envvk-a apres METAL_RENDER_ANGLE=vulkan -- tools/render/self-check.mjs
    run apres-envvk-b apres METAL_RENDER_ANGLE=vulkan -- tools/render/self-check.mjs --compare "$OUT/apres-envvk-a.json"
    run apres-optvk-a apres -- tools/render/self-check.mjs --angle vulkan --compare "$OUT/apres-envvk-a.json"
    run apres-optvk-b apres -- tools/render/self-check.mjs --angle vulkan --compare "$OUT/apres-optvk-a.json"
    ;;&
  apres|all|crp)
    run crp-ss apres -- tools/render/check-run-page.mjs --self-check "$OUT/apres-ss-a.json"
    run crp-envvk apres METAL_RENDER_ANGLE=vulkan -- tools/render/check-run-page.mjs --self-check "$OUT/apres-envvk-a.json"
    ;;
esac
echo "fin ; Chrome encore lancés par moi : $(pgrep -u "$USER" -fc 'chrome.*metal-render-' || true)"
