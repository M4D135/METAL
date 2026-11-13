# Lot 02 / T4 : mutations de src/game.js pour vérifier que les tests LOAD-03 détectent chaque régression.
# Chaque faute est injectée dans une copie de src/ (dossier temporaire), avec checks/checkpoint.test.mjs.
# python3 -I mutations.py <arbre> <dossier temporaire>
import sys, shutil, subprocess, pathlib, re
repo=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2])
src=(repo/'src/game.js').read_text()
M={
 'sync-write (code d avant)':[("    queueSave(savedRun);\n","    try{preserveRefusedSave();localStorage.setItem(SAVE_KEY,JSON.stringify(savedRun));saveAvailable=true;}catch{saveAvailable=false;}\n    $('checkpoint-status').textContent='Reprise au dernier point enregistré.'+(saveAvailable?' Sauvegarde locale active.':' Reprise disponible pendant cette session.');\n")],
 'clearSave sans annulation':[("savedRun=pendingSave=null;try{preserveRefusedSave();localStorage.removeItem","savedRun=null;try{preserveRefusedSave();localStorage.removeItem")],
 'sans pagehide':[("addEventListener('pagehide',writeSave);","")],
 'sans visibilitychange':[("document.addEventListener('visibilitychange',()=>{if(document.hidden)writeSave();});","")],
 'resumeSaved sans vidage':[("  function resumeSaved(v){\n    writeSave();\n","  function resumeSaved(v){\n")],
 'sans preserveRefusedSave dans l ecriture':[("try{preserveRefusedSave();localStorage.setItem(SAVE_KEY,JSON.stringify(run));","try{localStorage.setItem(SAVE_KEY,JSON.stringify(run));")],
 'une ecriture par appel (pas de fusion)':[("    pendingSave=run;if(saveQueued)return;saveQueued=true;\n    const later=()=>{saveQueued=false;writeSave();};","    const later=()=>{pendingSave=run;writeSave();};")],
 'echec ignore (saveAvailable reste vrai)':[("JSON.stringify(run));saveAvailable=true;}catch{saveAvailable=false;}","JSON.stringify(run));saveAvailable=true;}catch{}")],
 'instantane differe':[("    checkpoint=sim.snapshot();\n    savedRun=","    const prise=()=>{checkpoint=sim.snapshot();savedRun=")],
 'setTimeout seul':[("if(typeof requestIdleCallback==='function')requestIdleCallback(later,{timeout:500});else setTimeout(later,0);","setTimeout(later,0);")],
 'timeout absent':[("requestIdleCallback(later,{timeout:500})","requestIdleCallback(later)")],
}
# 'instantane differe' : la prise et l'enveloppe partent dans la tache differee.
for name,subs in M.items():
  s=src
  for a,b in subs:
    assert s.count(a)==1,(name,a); s=s.replace(a,b)
  if name=='instantane differe':
    a="    queueSave(savedRun);\n"; assert s.count(a)==1
    s=re.sub(r"(const prise=\(\)=>\{checkpoint=sim\.snapshot\(\);savedRun=\{.*?checkpoint\});\n    queueSave\(savedRun\);\n", lambda m: m.group(1)+";queueSave(savedRun);};requestIdleCallback(prise,{timeout:500});\n", s, flags=re.S)
  d=out/re.sub(r'[^a-z]+','-',name)
  if d.exists(): shutil.rmtree(d)
  (d/'src').mkdir(parents=True); (d/'checks').mkdir()
  for f in (repo/'src').iterdir(): shutil.copy(f, d/'src'/f.name)
  (d/'src/game.js').write_text(s)
  shutil.copy(repo/'checks/checkpoint.test.mjs', d/'checks/checkpoint.test.mjs')
  r=subprocess.run(['node','--test','--test-reporter=tap',str(d/'checks/checkpoint.test.mjs')],capture_output=True,text=True)
  fails=[l.split(' - ',1)[1] for l in r.stdout.splitlines() if l.startswith('not ok')]
  print(f"{name}: {len(fails)} échec(s)"); [print('   -',f[:110]) for f in fails]
