import json,math,sys
ROUND={'#move-zone','#fire-button','#left-fire-button','#dash-button','#pulse-button','#melee-button','#jump-button'}
def summ(path,roundIds):
    d=json.load(open(path))
    for name,m in d.items():
        T=m['targets'];S=m['safeArea'];W,H=m['viewport']['w'],m['viewport']['h']
        real=[o for o in m['overlaps'] if '#supply-hint' not in (o['a'],o['b'])]
        # chevauchement réel : les boutons ronds se testent en cercles
        def circ(t): return (t['x']+t['w']/2,t['y']+t['h']/2,min(t['w'],t['h'])/2)
        tt=[];byid={t['id']:t for t in T}
        for o in real:
            if o['kind']=='cible/cible' and o['a'] in roundIds and o['b'] in roundIds:
                a,b=circ(byid[o['a']]),circ(byid[o['b']]);gap=math.hypot(a[0]-b[0],a[1]-b[1])-a[2]-b[2]
                if gap>=0: continue
            tt.append((o['a'],o['b'],o['px2']))
        gaps=[]
        rs=[t for t in T if t['id'] in roundIds and t['id']!='#move-zone']
        for i in range(len(rs)):
            for j in range(i+1,len(rs)):
                a,b=circ(rs[i]),circ(rs[j]);gaps.append((round(math.hypot(a[0]-b[0],a[1]-b[1])-a[2]-b[2],1),rs[i]['id'],rs[j]['id']))
        unsafe=[]
        for t in T:
            e=t['edge'];v=[]
            if e['left']<S['left']-.5:v.append('G %d<%d'%(e['left'],S['left']))
            if e['right']<S['right']-.5:v.append('D %d<%d'%(e['right'],S['right']))
            if e['bottom']<S['bottom']-.5:v.append('B %d<%d'%(e['bottom'],S['bottom']))
            if e['top']<S['top']-.5:v.append('H %d<%d'%(e['top'],S['top']))
            if v:unsafe.append(t['id']+' '+' '.join(v))
        fire=byid['#fire-button'];stick=byid['#move-zone']
        small=sum(1 for t in T if t['min']<48)
        h=m['textHist'];n=m['textCount'];lt8=h.get('<6',0)+h.get('6-8',0);lt10=lt8+h.get('8-10',0)
        print(f"{name:8s} cibles={len(T)} min={min(t['min'] for t in T):.0f}px <48px={small} chevauchements={len(tt)} {tt} | écart min entre boutons ronds={min(gaps)[0] if gaps else None} | hors zone sûre={unsafe} | centre du tir à {H-(fire['y']+fire['h']/2):.0f}px du bas ({100*(H-(fire['y']+fire['h']/2))/H:.0f} %), manche à {H-(stick['y']+stick['h']/2):.0f}px | textes={n} <8px={lt8} <10px={lt10} min={m['smallest'][0]['px'] if m['smallest'][0]['px']>0 else m['smallest'][1]['px']}px")
print('--- actuel');summ('out/layout.json',ROUND-{'#melee-button','#jump-button'})
print('--- proposé');summ('out/layout-prop.json',ROUND)
