#!/bin/zsh
# usage: runall.sh <mode> <parallel> <limit seconds> [worlds...]
cd ${METAL_BANCS:-$PWD/docs/chantier-moteur/bancs}/saut
mode=$1; par=$2; lim=$3; shift 3
worlds=("$@"); if [ ${#worlds[@]} -eq 0 ]; then worlds=(v2-00 v2-01 v2-02 v2-03 v2-04 v2-05 v2-06 v2-07 v2-08 v2-09 v2-10 v2-11 v2-12 v2-13 v2-14 v2-15 v2-16 v2-17 legacy-0 legacy-1 legacy-2); fi
printf '%s\n' "${worlds[@]}" | xargs -P $par -I{} sh -c "node explore.mjs {} $mode limit=$lim > out/log-{}-$mode.txt 2>&1"
echo done $mode
