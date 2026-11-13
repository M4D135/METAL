# RGPU-verif : différences appariées (même bloc / même image) entre variantes, IC95 bootstrap de la médiane.
# Usage : python3 -I analyze.py out/v1.json
import json, sys, random, statistics as st
d = json.load(open(sys.argv[1]))
random.seed(3)
def ci(xs):
    meds = sorted(st.median([random.choice(xs) for _ in xs]) for _ in range(400))
    return meds[10], meds[389]
def table(title, data, refs):
    print('==', title)
    for ref, members in refs:
        if ref not in data: continue
        R = {(r[0], r[1]): r for r in data[ref]}
        print(f"  réf {ref}: médiane {st.median(r[2] for r in data[ref]):.2f} ms/image (CPU d'émission {st.median(r[3] for r in data[ref]):.2f})")
        for v in members:
            if v not in data: continue
            rows = [(r[2] - R[(r[0], r[1])][2], r[3] - R[(r[0], r[1])][3]) for r in data[v] if (r[0], r[1]) in R]
            dt = [x[0] for x in rows]; dc = [x[1] for x in rows]
            lo, hi = ci(dt); m = st.median(dt)
            base = st.median(r[2] for r in data[ref])
            print(f"   {v:10s} médiane {st.median(r[2] for r in data[v]):6.2f}  Δ {m:+6.2f} ms [{lo:+6.2f},{hi:+6.2f}]  {100*m/base:+6.1f} %   ΔCPU {st.median(dc):+6.2f}  n={len(dt)}")
auto = ['spec4', 'notorch', 'nolamp', 'suncache', 'noisetex', 'combo7', 'high']
refs = [('base', auto), ('high', ['hicap'])]
for sn, data in d['thr'].items(): table('débit pipeliné (blocs de 10 images) — scène ' + sn, data, refs)
for sn, data in d['lat'].items(): table('latence (synchro par image) — scène ' + sn, data, refs)
