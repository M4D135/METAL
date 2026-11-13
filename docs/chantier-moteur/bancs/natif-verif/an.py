# NATIF : differences appariees (meme scene, meme bloc, meme tour) par rapport a une reference ; IC95 bootstrap de la mediane.
# Usage : python3 -I an.py out/X.json [ref=base]
import json, sys, random, statistics as st
d = json.load(open(sys.argv[1])); ref = sys.argv[2] if len(sys.argv) > 2 else 'base'
random.seed(7)
def ci(xs):
    if len(xs) < 4: return (float('nan'), float('nan'))
    meds = sorted(st.median([random.choice(xs) for _ in xs]) for _ in range(400))
    return meds[10], meds[389]
print('erreurs', d['errors'], '|', d['info'].get('renderer'), '| duree', d['info'].get('ms'), 'ms')
allrows = {}
for sn, data in d['thr'].items():
    s = d['stats'][sn]; R = {(r[0], r[1]): r for r in data[ref]}
    b = st.median(r[2] for r in data[ref])
    print(f"== {sn} ({d['scenes'][sn]['biome']}, {s[ref]['w']}x{s[ref]['h']} = {s[ref]['mpix']} MPix, {s[ref]['drawCalls']} appels, {s[ref]['triangles']:.0f} triangles) ref {ref}: {b:.2f} ms/image, CPU emission {st.median(r[3] for r in data[ref]):.2f}")
    for v, rows in data.items():
        if v == ref: continue
        dt = [r[2] - R[(r[0], r[1])][2] for r in rows if (r[0], r[1]) in R]
        dc = [r[3] - R[(r[0], r[1])][3] for r in rows if (r[0], r[1]) in R]
        lo, hi = ci(dt); m = st.median(dt)
        allrows.setdefault(v, []).extend((x, b) for x in dt)
        df = d.get('diffs', {}).get(sn, {}).get(v)
        dtxt = f"  image: max {df['max']}, identiques {df['identical']}/{df['n']}, px diff {df['nonzeroPx']} (>1: {df['gt1Px']}, >3: {df['gt3Px']}, >10: {df['gt10Px']}) MAD {df['mad']}" if df else ''
        print(f"   {v:11s} {s[v]['mpix']:6.3f} MPix  med {st.median(r[2] for r in rows):6.2f}  d {m:+6.2f} ms [{lo:+6.2f},{hi:+6.2f}] {100*m/b:+6.1f} %  dCPU {st.median(dc):+5.2f}{dtxt}")
print('== toutes scenes confondues (mediane des ecarts apparies, ms et % de la reference de chaque scene)')
for v, L in allrows.items():
    xs = [x for x, _ in L]; lo, hi = ci(xs); pc = st.median(100 * x / b for x, b in L)
    print(f"   {v:11s} d {st.median(xs):+6.2f} ms [{lo:+6.2f},{hi:+6.2f}]  {pc:+6.1f} %  n={len(xs)}")
