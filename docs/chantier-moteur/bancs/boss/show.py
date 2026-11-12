import json,sys
d=json.load(sys.stdin);f=d['fight']
print(d['index'],d['kind'],d['policy'],'shield',d['shield'],'sim',d['simSeconds'],'s',d['perf'])
print({k:f.get(k) for k in ['attacks','hitsTaken','damageTaken','shieldAbsorbed','dmgBody','dmgWeak','openTime','phaseAt','playerDeadAt','deathAt','bossHpLeft','bossMaxHp','shots','outOfCircle','bossMoves','hpMin','ammo']})
print('  nav',f.get('nav'))
for h in f.get('hitLog',[])[:int(sys.argv[1]) if len(sys.argv)>1 else 6]: print('  ',h)
for sp in d.get('topSpikes',[])[:4]: print('  SPIKE',sp)
