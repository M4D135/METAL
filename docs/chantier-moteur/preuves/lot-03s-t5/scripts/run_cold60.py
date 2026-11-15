from pathlib import Path
import os,subprocess,json,time,statistics
r=Path('/home/m4d135/metal-chantier/voies/sim2');e=r/'.relais/t5-production-930c199';node='/home/m4d135/.nvm/versions/node/v24.18.0/bin/node';rows=[]
for rep in range(5):
 for index in range(3):
  label=f'cold60-{rep}-{index}';out=e/(label+'.json');start=time.time()
  with (e/(label+'.log')).open('w') as f:x=subprocess.run([node,str(e/'cold60-production.mjs'),str(r),str(index),'60','skilled','0'],env={**os.environ,'GOD':'1','OUT':str(out)},stdout=f,stderr=subprocess.STDOUT)
  assert x.returncode==0;d=json.loads(out.read_text());assert d['sourceSha256']==d['loadedSha256'];q=d['firstBreak'];rows.append({'rep':rep,'species':index,'cpuMs':q['cpu'],'wallMs':q['wall'],'step':q['step'],'cpuBefore':q['cpuBefore'],'cpuAfter':q['cpuAfter'],'seconds':d['final']['simTime'],'snapshotSha256':d['finalSnapshotSha256'],'processWallSeconds':time.time()-start,'receipt':out.name});(e/'cold60-run.json').write_text(json.dumps(rows,indent=2));print(rep,index,q['cpu'],q['cpuBefore'],q['cpuAfter'],flush=True)
for i in range(3):
 rs=[x for x in rows if x['species']==i];assert len({x['snapshotSha256'] for x in rs})==1;print('species',i,'max',max(x['cpuMs'] for x in rs),'snapshot stable')
