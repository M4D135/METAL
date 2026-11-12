#!/bin/zsh
cd ${METAL_BANCS:-$PWD/docs/chantier-moteur/bancs}/saut
printf '%s\n' "v2-01 JC" "v2-02 JC" "v2-00 J" "v2-01 W" "v2-02 W" "v2-00 W" "v2-01 J" "v2-02 J" | xargs -P 5 -L 1 sh -c 'node explore.mjs $0 $1 limit=285 fast=1 tag=full > out/full-$0-$1.txt 2>&1'
echo done
