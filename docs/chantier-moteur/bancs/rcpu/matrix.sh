#!/bin/sh
# RCPU: run bench-draw.mjs (instrumented, tour) over several worlds/qualities and print a compact summary.
ROOT="$1"; FRAMES="${2:-3000}"; B="$(dirname "$0")"
for spec in "camp:6 auto" "camp:6 high" "camp:12 auto" "camp:17 auto" "camp:17 high" "legacy:2 auto"; do
  set -- $spec
  node "$B/bench-draw.mjs" "$ROOT" "$FRAMES" "$1" "$2" 1 tour | python3 -c "
import json,sys
d=json.load(sys.stdin)
L=d['lines'];I=d['inner']
g=lambda k:L.get(k,'0 us')
print('%-9s %-4s meshes=%d draw mean=%.3f p99=%.3f max=%.3f | models mean=%.3f p99=%.3f | sim mean=%.3f | dyn=%d vis=%d(p95 %d) inst=%d upKB=%.0f(p95 %.0f) bufData=%.1f gl=%d draws=%d | updWorld max=%.2f n=%d' % (d['world'],d['quality'],d['meshes'],d['drawMs']['mean'],d['drawMs']['p99'],d['drawMs']['max'],d['modelsMs']['mean'],d['modelsMs']['p99'],d['simMs']['mean'],d['dynamicMeshes']['mean'],d['staticVisible']['mean'],d['staticVisible']['p95'],d['instances']['mean'],d['uploadKB']['mean'],d['uploadKB']['p95'],d['bufferDataPerFrame']['mean'],d['glCalls']['mean'],d['drawCalls']['mean'],d['updateWorldMs']['max'],d['destructionUpdates']))
print('   query=%s visible=%s packDyn=%s shadows=%s mainStatic=%s split=%s overlay=%s | %s' % (g('1545'),g('1546'),g('1556'),g('1564'),g('1576'),g('1555'),g('1581'),' '.join('%s=%s'%(k,v) for k,v in I.items() if float(v.split()[0])>2)))
print('   slots', ' '.join('%s:rate=%.2f n=%d' % (s['slot'].split('(')[0],s['repackRate'],s['avgEntries']) for s in d['slots']), '| timers', ' '.join('%s=%.3f' % (k,v['msPerFrame']) for k,v in d['timersPerFrame'].items()))
"
done
