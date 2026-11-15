from pathlib import Path
import subprocess,os,json,time
import argparse
p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--candidate',required=True);p.add_argument('--out',required=True);p.add_argument('--node',required=True);a=p.parse_args()
root=Path(a.candidate).resolve();base=Path(a.base).resolve();e=Path(a.out).resolve();node=a.node;e.mkdir(parents=True,exist_ok=True);os.chdir(root)
receipt=[]
def run(label,args,extra={},allow=()):
 env={**os.environ,**extra};start=time.time()
 with (e/(label+'.log')).open('w') as f:r=subprocess.run(args,env=env,stdout=f,stderr=subprocess.STDOUT)
 receipt.append({'label':label,'args':args,'env':extra,'exit':r.returncode,'seconds':time.time()-start});(e/'bench-run-thread.json').write_text(json.dumps(receipt,indent=2));print(label,r.returncode,round(time.time()-start,2),flush=True)
 if r.returncode not in (0,*allow):raise SystemExit(r.returncode)
run('revision-cost-thread',[node,'tools/proof/lot03s/revision-cost.mjs',str(base),str(root),str(e/'revision-cost-thread.json')])
for rep in range(6):
 for index in range(3):
  for side,path in ([('a',base),('b',root)] if rep%2==0 else [('b',root),('a',base)]):
   label=f'fight-{rep}-{index}-{side}'
   run(label,[node,'tools/proof/lot03s/fight.mjs',str(path),str(index),'60','skilled','0'],{'GOD':'1','OUT':str(e/(label+'.json'))})
# Diagnostic bounded-A* and phase timing are excluded from production acceptance.
for index in range(3):
 for bounded in [False,True]:
  label=f'phases-{index}-'+('bounded' if bounded else 'production')
  run(label,[node,'tools/proof/lot03s/fight.mjs',str(root),str(index),'60','skilled','0'],{'GOD':'1','PHASES':'1','OUT':str(e/(label+'.json')),**({'BOUNDED':'1'} if bounded else {})})
label='no-sleep-2'
run(label,[node,'tools/proof/lot03s/fight.mjs',str(root),'2','60','skilled','0'],{'GOD':'1','NO_SLEEP':'1','OUT':str(e/(label+'.json'))})
