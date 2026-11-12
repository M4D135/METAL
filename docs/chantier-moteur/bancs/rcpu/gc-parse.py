#!/usr/bin/env python3
# Summarise node --trace-gc output between '### START' and '### END'.
import re, sys
on = False; sc = []; mc = []; end = ''
for line in sys.stdin:
    if '### START' in line: on = True; continue
    if '### END' in line: end = line.strip(); on = False; continue
    if not on: continue
    m = re.search(r'(Scavenge|Mark-Compact|Mark-sweep|Minor Mark-Sweep|Mark-Compact \(reduce\))[^,]*?([\d.]+) \(([\d.]+)\) -> ([\d.]+) \(([\d.]+)\) MB, (?:pooled: [\d.]+ MB, )?([\d.]+) / ([\d.]+) ms', line)
    if not m: continue
    kind = m.group(1); before = float(m.group(2)); after = float(m.group(4)); ms = float(m.group(6))
    (sc if 'Scavenge' in kind or 'Minor' in kind else mc).append((before, after, ms))
def s(v):
    if not v: return 'n=0'
    ms = sorted(x[2] for x in v); freed = sum(x[0]-x[1] for x in v)
    return 'n=%d total=%.1fms mean=%.2fms max=%.2fms p95=%.2fms freedMB=%.0f' % (len(v), sum(ms), sum(ms)/len(ms), ms[-1], ms[int(len(ms)*.95)-1 if len(ms)>1 else 0], freed)
print(end)
print('  scavenge   ', s(sc))
print('  mark-compact', s(mc))
