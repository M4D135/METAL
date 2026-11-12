import json,sys,statistics as st
ALL={};tot_long=0;tot_frames=0;rev_long=0;rev_all=0
agg={}
for w in sys.argv[1:]:
    A=json.load(open(f'A2-{w}.bin.json')); B=json.load(open(f'B2-{w}.bin.json'))
    n=min(A['f'],B['f']); K=A['K']; names=A['names']; steps=A['steps']
    pick=[A if A['total'][i]<=B['total'][i] else B for i in range(n)]
    tot=[pick[i]['total'][i] for i in range(n)]
    # local median by step count (control for 1 vs 2 substeps)
    med={k:st.median([tot[i] for i in range(n) if steps[i]==k]) for k in set(steps[:n]) if sum(1 for i in range(n) if steps[i]==k)>50}
    gmed=st.median(tot)
    pm=[st.median([pick[i]['exc'][i*K+k] for i in range(0,n,7)]) for k in range(len(names))]
    longG=[i for i in range(n) if tot[i]>3*gmed]
    longL=[i for i in range(n) if tot[i]>3*med.get(steps[i],gmed)]
    revs=[i for i in range(n) if A['rev'][i]>0]
    c={}
    for i in longL:
        ex=[(pick[i]['exc'][i*K+k]-pm[k],names[k]) for k in range(len(names))]
        ex.sort(reverse=True); c[ex[0][1]]=c.get(ex[0][1],0)+1; agg[ex[0][1]]=agg.get(ex[0][1],0)+1
    rl=sum(1 for i in revs if tot[i]>3*med.get(steps[i],gmed))
    print(w,'n',n,'med',{k:round(v,2) for k,v in med.items()},'gmed',round(gmed,2),'long(global)',len(longG),'long(local-by-steps)',len(longL),'revs',len(revs),'rev long',rl, dict(sorted(c.items(),key=lambda x:-x[1])[:6]))
    tot_long+=len(longL);tot_frames+=n;rev_long+=rl;rev_all+=len(revs)
    # revision frames: mean excess by probe
    if revs:
        m=sorted(((sum(pick[i]['exc'][i*K+k]-pm[k] for i in revs)/len(revs),names[k]) for k in range(len(names))),reverse=True)[:6]
        print('   rev frames mean excess:',[(nm,round(v,2)) for v,nm in m])
print('TOTAL frames',tot_frames,'long',tot_long,'rev',rev_all,'rev long',rev_long, dict(sorted(agg.items(),key=lambda x:-x[1])))
