import json,sys
for f in sys.argv[1:]:
    try: d=json.load(open(f))
    except Exception as e: print(f,'ERR',e); continue
    ft=d['fight']
    print(f, d['kind'], d['policy'], 'shield' if d['shield'] else 'dash', 'seed',d['seed'], 'sim',d['simSeconds'],'| perf',d['perf'])
    print('   spikes', [(s['t'],s['ms'],[(r['e'],r['found'],r['explored'],r['ms'],r.get('tactic'),r.get('caller')) for r in s['routes']]) for s in d['topSpikes'][:3]])
    print('   attacks',ft['attacks'],'hits',ft['hitsTaken'],'dmg',ft['damageTaken'],'absorbed',ft['shieldAbsorbed'],'deadAt',ft['playerDeadAt'],'bossDeath',ft['deathAt'],'bossHp',ft['bossHpLeft'],'/',ft['bossMaxHp'],'php',ft['playerHp'],'armor',ft.get('armor'),'ammo',ft['ammo'],'open',ft['openTime'],'out',ft['outOfCircle'],'moves',ft['bossMoves'],'weak',ft['dmgWeak'],'body',ft['dmgBody'],'nav',ft['nav']['revisions'],ft['nav']['pumpSteps'])
