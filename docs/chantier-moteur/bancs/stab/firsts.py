# STAB — coûts de première fois, à partir des recensements : première occurrence d'un événement contre les suivantes,
# premières images de jeu, et évolution par fenêtre de 10 s de chaque système (dérive en session longue).
import json,sys,statistics as st
def load(n):
    d=json.load(open(n));K=d['K'];names=d['names'];f=d['f'];return d,K,names,f
for path in sys.argv[1:]:
    d,K,names,f=load(path);tot=d['total'];med=st.median(tot);EV=d['EV'];exc=d['exc']
    print('==',path,'median',round(med,2))
    # premières images
    for i in range(0,4):
        parts=sorted(((exc[i*K+k],names[k]) for k in range(len(names))),reverse=True)[:5]
        print('  image',i,'%.1f ms (x%.1f)'%(tot[i],tot[i]/med),' '.join('%s=%.1f'%(n,v) for v,n in parts if v>.3))
    # première occurrence contre les suivantes
    for b,name in enumerate(EV):
        idx=[i for i in range(f) if d['flags'][i]&(1<<b)]
        if len(idx)<4:continue
        first=tot[idx[0]];later=[tot[i] for i in idx[1:]]
        print('  %-14s n=%3d première %.1f ms ; suivantes médiane %.1f (min %.1f max %.1f) ; rapport x%.1f'%(name,len(idx),first,st.median(later),min(later),max(later),first/st.median(later)))
    # dérive par système
    w=600
    def series(k):
        return [round(st.median(exc[i*K+k] for i in range(s,min(f,s+w))),2) for s in range(0,f-w+1,w)]
    for nm in ['sim:updateDebris','render.draw','game.models','sim:updateEnemies','fx.build']:
        if nm in names:print('  dérive',nm,series(names.index(nm)))
    al=d['alloc'];print('  alloc Ko/image par 10 s',[round(st.median([a for a in al[s:s+w] if a>0])/1024) for s in range(0,f-w+1,w)])
