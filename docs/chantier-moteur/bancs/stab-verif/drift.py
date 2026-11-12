import json,sys,statistics as st
for w in sys.argv[1:]:
    A=json.load(open(f'A2-{w}.bin.json')); B=json.load(open(f'B2-{w}.bin.json'))
    n=min(A['f'],B['f']); K=A['K']; names=A['names']
    tot=[min(A['total'][i],B['total'][i]) for i in range(n)]
    steps=A['steps']; simT=A['simT']
    iD=names.index('sim:updateDebris')
    deb=[min(A['exc'][i*K+iD],B['exc'][i*K+iD]) for i in range(n)]
    # first frame with 2 steps
    first2=next((i for i in range(n) if steps[i]==2),None)
    print(w,'frames',n,'first 2-step frame',first2,'simT',simT[first2] if first2 is not None else None, 'frac2 after', sum(1 for i in range(first2,n) if steps[i]==2)/(n-first2) if first2 else None)
    # per 10 s bins: median total, median per-step total, share 2 steps, debris per frame and per step
    b=0
    while True:
        idx=[i for i in range(n) if b*10<=simT[i]<(b+1)*10]
        if not idx: break
        m=st.median(tot[i] for i in idx); s2=sum(1 for i in idx if steps[i]==2)/len(idx)
        d=sum(deb[i] for i in idx)/len(idx); dps=sum(deb[i] for i in idx)/sum(steps[i] for i in idx)
        m1=[tot[i] for i in idx if steps[i]==1]; m2=[tot[i] for i in idx if steps[i]==2]
        print(f"  t{b*10:3d} med {m:5.2f} 2step {s2:4.2f} med1 {st.median(m1) if m1 else 0:5.2f} med2 {st.median(m2) if m2 else 0:5.2f} debris/frame {d:5.2f} debris/step {dps:5.2f} alloc/frame {sum(A['alloc'][i] for i in idx if A['alloc'][i]>0)/len(idx)/1e6:5.2f}Mo")
        b+=1
