# NATIF : cout par passe a 2 resolutions DANS LE MEME PROCESSUS (ecarts apparies par bloc), pente en ms/MPix.
import json, statistics as st, random
d = json.load(open('out/PS.json')); random.seed(5)
print('erreurs', d['errors'], 'duree', d['info'].get('ms'))
M = {'1080': 2.074, '4k': 8.294}
def ci(xs):
    meds = sorted(st.median([random.choice(xs) for _ in xs]) for _ in range(400)); return meds[10], meds[389]
tot = {}
for sn, data in d['thr'].items():
    key = lambda v: {(r[0], r[1]): r[2] for r in data[v]}
    b1, b4 = key('base@1080'), key('base@4k')
    m1, m4 = st.median(b1.values()), st.median(b4.values())
    sl = [(b4[k]-b1[k])/(M['4k']-M['1080']) for k in b1]; lo, hi = ci(sl); s = st.median(sl)
    print(f"== {sn}: base {m1:.2f} ms a 2,07 MPix, {m4:.2f} ms a 8,29 MPix -> {s:.2f} ms/MPix [{lo:.2f},{hi:.2f}], part fixe {m1-s*M['1080']:.2f} ms")
    tot.setdefault('base', []).extend(sl)
    for p in ['l0', 'noshadow', 'nosky', 'nobloom', 'noweapon']:
        c1 = [b1[k]-v for k, v in key(p+'@1080').items()]; c4 = [b4[k]-v for k, v in key(p+'@4k').items()]
        k1, k4 = key(p+'@1080'), key(p+'@4k')
        sl = [((b4[k]-k4[k])-(b1[k]-k1[k]))/(M['4k']-M['1080']) for k in b1]; lo, hi = ci(sl)
        tot.setdefault(p, []).extend(sl)
        print(f"   sans {p:9s}: cout {st.median(c1):+5.2f} ms a 2,07 MPix ({100*st.median(c1)/m1:4.1f} %), {st.median(c4):+5.2f} ms a 8,29 MPix ({100*st.median(c4)/m4:4.1f} %) -> {st.median(sl):+.3f} ms/MPix [{lo:+.3f},{hi:+.3f}]")
print('== toutes scenes : pente mediane en ms/MPix')
for p, sl in tot.items():
    lo, hi = ci(sl); print(f"   {p:9s} {st.median(sl):+.3f} [{lo:+.3f},{hi:+.3f}] n={len(sl)}")
