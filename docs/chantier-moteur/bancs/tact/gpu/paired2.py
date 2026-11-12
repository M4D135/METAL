# Différences appariées par image contre la référence ; min de N répétitions ; IC95 bootstrap de la médiane.
import json,sys,random,statistics as st
d=json.load(open(sys.argv[1])); ref=sys.argv[2] if len(sys.argv)>2 else 'base'
pf=d['perFrame']; ids=list(pf[0]['m'].keys()); random.seed(1)
def ci(xs):
    meds=sorted(st.median([random.choice(xs) for _ in xs]) for _ in range(300)); return meds[7],meds[292]
def col(key,i): return [f[key][i]-f[key][ref] for f in pf if i in f[key] and ref in f[key]]
V=d['variants']
print(f"{'variante':8s} {'res':>10s} {'MPix':>5s} {'inst':>5s} {'total':>6s} {'gpu':>6s} {'dgpu':>7s} {'IC95 dgpu':>16s} {'dgpu%':>6s} {'cpu':>5s} {'dcpu':>6s} {'dtotal':>7s}")
bg=st.median(f['g'][ref] for f in pf)
for i in ids:
    dg=col('g',i); lo,hi=ci(dg); dgm=st.median(dg); dc=st.median(col('mc',i)); dt=st.median(col('m',i)); s=V[i].get('stats') or {}
    w,h=s.get('width',0),s.get('height',0)
    print(f"{i:8s} {str(w)+'x'+str(h):>10s} {w*h/1e6:5.2f} {V[i].get('instancesMedian'):5.0f} {st.median(f['m'][i] for f in pf):6.2f} {st.median(f['g'][i] for f in pf):6.2f} {dgm:+7.2f} [{lo:+6.2f},{hi:+6.2f}] {100*dgm/bg:+5.1f}% {st.median(f['mc'][i] for f in pf):5.2f} {dc:+6.2f} {dt:+7.2f}")
