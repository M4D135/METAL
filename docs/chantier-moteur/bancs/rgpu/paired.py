# Différences appariées par image (même image, chaque variante), min de N répétitions.
# Colonnes : total (CPU d'émission + GPU/pilote sérialisés), gpu (= total - CPU d'émission), cpu (émission JS).
import json,sys,random,statistics as st
d=json.load(open(sys.argv[1])); ref=sys.argv[2] if len(sys.argv)>2 else 'base'
only=sys.argv[3].split(',') if len(sys.argv)>3 else None
pf=d['perFrame']; ids=list(pf[0]['m'].keys())
random.seed(1)
def ci(xs):
    meds=sorted(st.median([random.choice(xs) for _ in xs]) for _ in range(300))
    return meds[7],meds[292]
def col(key,i): return [f[key][i]-f[key][ref] for f in pf if i in f[key] and ref in f[key]]
print(f"{'variante':14s} {'total':>6s} {'Δtotal':>7s} {'gpu':>6s} {'Δgpu':>7s} {'IC95 Δgpu':>16s} {'Δgpu%':>6s} {'cpu':>5s} {'Δcpu':>6s}")
bg=st.median(f['g'][ref] for f in pf)
for i in ids:
    if only and i not in only and i!=ref: continue
    dt=st.median(col('m',i)); dg=col('g',i); lo,hi=ci(dg); dgm=st.median(dg); dc=st.median(col('mc',i))
    print(f"{i:14s} {st.median(f['m'][i] for f in pf):6.2f} {dt:+7.2f} {st.median(f['g'][i] for f in pf):6.2f} {dgm:+7.2f} [{lo:+6.2f},{hi:+6.2f}] {100*dgm/bg:+5.1f}% {st.median(f['mc'][i] for f in pf):5.2f} {dc:+6.2f}")
