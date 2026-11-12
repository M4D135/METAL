# NATIF : cout de chaque passe (ecart apparie base - variante sans la passe) a 3 resolutions, et pente en ms par megapixel.
import json, statistics as st
runs = [('out/P-1080.json', 2.074), ('out/P-mac.json', 5.939), ('out/P-4k.json', 8.294)]
D = [(json.load(open(p)), m) for p, m in runs]
labels = {'nosky': 'ciel', 'noshadow': 'ombres (rendu + lecture)', 'shskip': 'ombres : rendu des 3 vues', 'nobloom': 'post complet (cible + bloom + copie)', 'postcopy': 'bloom seul (extraction, flous)', 'l0': 'boucle des 12 lumieres', 'nofx': 'particules', 'noweapon': 'arme + particules', 'static': 'tout le dynamique'}
def med(d, sn, v):
    data = d['thr'][sn]; R = {(r[0], r[1]): r[2] for r in data['base']}
    return st.median(R[(r[0], r[1])] - r[2] for r in data[v])
def fit(xs, ys):
    n = len(xs); mx = sum(xs)/n; my = sum(ys)/n; b = sum((x-mx)*(y-my) for x, y in zip(xs, ys))/sum((x-mx)**2 for x in xs); return b, my-b*mx
for sn in D[0][0]['thr']:
    base = [st.median(r[2] for r in d['thr'][sn]['base']) for d, _ in D]
    b, a = fit([m for _, m in D], base)
    print(f"== {sn}: image complete {base[0]:.2f} / {base[1]:.2f} / {base[2]:.2f} ms a 2,07 / 5,94 / 8,29 MPix -> {b:.2f} ms/MPix + {a:.2f} ms fixes")
    for v, lab in labels.items():
        c = [med(d, sn, v) for d, _ in D]; b, a = fit([m for _, m in D], c)
        print(f"   {lab:38s} {c[0]:+5.2f} {c[1]:+5.2f} {c[2]:+5.2f} ms  -> {b:+.3f} ms/MPix, fixe {a:+.2f} ms ; part a 5,94 MPix {100*c[1]/base[1]:4.1f} %")
