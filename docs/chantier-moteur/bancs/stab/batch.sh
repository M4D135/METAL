#!/bin/bash
# Lance les 10 sessions du recensement pour un préfixe donné (A2, B2...), en parallèle, 180 s simulées à 60 Hz.
cd "$(dirname "$0")"; R="$1"; P="$2"; HZ="${3:-60}"
for w in c0 c1 c2 c9 c13 c17 l0 l2 boss:c5 boss:c14; do n=$(echo $w | tr ':' '-'); WALL_LIMIT=250 timeout 320 node census.mjs $R $w 180 $HZ out/$P-$n.json > out/$P-$n.log 2>&1 & done; wait
