# CIEL : extrait le JSON rendu par --dump-dom, écrit les PNG (base64) et affiche le reste.
import sys,json,base64,os,re,html
data=sys.stdin.read()
m=re.search(r'@@JSON@@(.*?)@@END@@',data,re.S)
if not m:
    print('NO JSON; dom bytes',len(data));print(data[-1500:]);sys.exit(1)
d=json.loads(html.unescape(m.group(1)))
outdir=sys.argv[1]
os.makedirs(outdir,exist_ok=True)
for name,url in (d.get('shots') or {}).items():
    raw=base64.b64decode(url.split(',',1)[1])
    open(os.path.join(outdir,name+'.png'),'wb').write(raw)
    print('png',name,len(raw))
d.pop('shots',None)
if len(sys.argv)>2:
    json.dump(d,open(sys.argv[2],'w'),ensure_ascii=False,indent=1)
print(json.dumps(d,ensure_ascii=False)[:6000])
