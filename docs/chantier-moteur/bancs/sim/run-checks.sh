#!/bin/bash
# Runs the repo's simulation-related checks (read-only) against the original and the in-memory patched simulation.
# usage: bash run-checks.sh [full|all]
R=${METAL_ROOT:-$PWD}/checks
H=$(cd "$(dirname "$0")" && pwd)
FILES=(campaign-simulation boss-progression natural-spawn simulation progression brain destruction checkpoint armor actors motion first-person audio soundscape)
P=(); for f in "${FILES[@]}"; do P+=("$R/$f.test.mjs"); done
echo "=== original"; node --test "${P[@]}" 2>&1 | tail -9
echo "=== patched (${1:-full})"; SIMPATCH=${1:-full} NODE_OPTIONS="--import=$H/test-preload.mjs" node --test "${P[@]}" 2>&1 | tail -9
