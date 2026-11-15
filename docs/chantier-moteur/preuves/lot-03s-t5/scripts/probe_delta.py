from pathlib import Path
import os,subprocess,json,time
r=Path('/home/m4d135/metal-chantier/voies/sim2');e=r/'.relais/t5-production-930c199';node='/home/m4d135/.nvm/versions/node/v24.18.0/bin/node';receipts=[]
def run(label,variant,index,trace=False):
 out=e/(label+'.json');cmd=[node,*(['--trace-opt','--trace-deopt','--trace-gc'] if trace else []),str(e/'cold-production.mjs'),str(e/'variants'/variant),str(index),'11','skilled','0'];start=time.time()
 with (e/(label+'.log')).open('w') as f:x=subprocess.run(cmd,env={**os.environ,'GOD':'1','OUT':str(out)},stdout=f,stderr=subprocess.STDOUT)
 receipts.append({'label':label,'variant':variant,'species':index,'trace':trace,'exit':x.returncode,'wallSeconds':time.time()-start});assert x.returncode==0
for variant in ['production','no-freeze-dirty','null-proto-dirty']:run('trace-'+variant,variant,1,True)
for rep in range(5):
 for index in [0,1]:
  for variant in (['production','null-proto-dirty'] if rep%2==0 else ['null-proto-dirty','production']):run(f'probe-{rep}-{index}-{variant}',variant,index)
(e/'delta-probe-run.json').write_text(json.dumps(receipts,indent=2));print('DONE',round(sum(x['wallSeconds'] for x in receipts),2))
for index in [0,1]:
 for variant in ['production','null-proto-dirty']:
  print(index,variant,[json.loads((e/f'probe-{rep}-{index}-{variant}.json').read_text())['firstBreak']['cpu'] for rep in range(5)])
