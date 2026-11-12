import re,sys
pat=re.compile(sys.argv[1]);ctx=int(sys.argv[2]);lim=int(sys.argv[3])
n=0
for f in sys.argv[4:]:
    try: lines=open(f,encoding='utf8',errors='replace').read().split('\n')
    except Exception as e: print('ERR',f,e);continue
    for i,l in enumerate(lines,1):
        for m in pat.finditer(l):
            a=max(0,m.start()-ctx);print(f"{f.split('/')[-1]}:{i}:{m.start()}: {l[a:m.end()+ctx]}");n+=1
            if n>=lim: sys.exit()
