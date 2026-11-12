#!/bin/sh
# Interleaved A/B runs (base vs prototype flags) to resist machine noise from
# concurrent benchmarks. usage: abrun.sh <repo> <flags> <driver> <steps> <reps> [filter]
B=${METAL_BANCS:-$PWD/docs/chantier-moteur/bancs}/ia
REPO=$1; FLAGS=$2; DRIVER=$3; STEPS=$4; REPS=$5; FILTER=$6
OUT=$B/ab-$DRIVER-$(echo $FLAGS | tr ',' '_' | cut -c1-40).jsonl
: > $OUT
i=0
while [ $i -lt $REPS ]; do
  node $B/variant.mjs $REPO base $DRIVER $STEPS $FILTER >> $OUT
  node $B/variant.mjs $REPO $FLAGS $DRIVER $STEPS $FILTER >> $OUT
  i=$((i+1))
done
node -e '
const fs=require("fs");const rows=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse);
const by={};for(const r of rows){const k=r.label+"|"+(r.flags==="base"?"base":"proto");(by[k]=by[k]||[]).push(r);}
const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const labels=[...new Set(rows.map(r=>r.label))];
console.log("scenario       variant  runs  avg_ms  p99_ms  p999_ms  max_ms(med/worst)  >4ms  >8ms  A*searches  labelRej  hold%  move%  hashes");
for(const l of labels)for(const v of ["base","proto"]){const a=by[l+"|"+v]||[];if(!a.length)continue;
  console.log(l.padEnd(14),v.padEnd(7),String(a.length).padStart(4),med(a.map(r=>r.avg)).toFixed(3).padStart(7),med(a.map(r=>r.p99)).toFixed(2).padStart(7),med(a.map(r=>r.p999)).toFixed(2).padStart(8),(med(a.map(r=>r.max)).toFixed(1)+"/"+Math.max(...a.map(r=>r.max)).toFixed(1)).padStart(18),String(med(a.map(r=>r.over4))).padStart(5),String(med(a.map(r=>r.over8))).padStart(5),String(med(a.map(r=>r.searches))).padStart(11),String(med(a.map(r=>r.labelRejects))).padStart(9),med(a.map(r=>r.holdPct)).toFixed(1).padStart(6),med(a.map(r=>r.movePct)).toFixed(1).padStart(6),"  "+[...new Set(a.map(r=>r.hash))].join(","));}
' $OUT
