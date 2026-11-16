#!/usr/bin/env python3
"""Build a self-contained, offline-capable game. Python standard library only."""
from pathlib import Path
import gzip, hashlib, json
ROOT=Path(__file__).resolve().parents[1]
import subprocess,sys
subprocess.run([sys.executable,str(ROOT/'tools/check-ferro-lock.py'),str(ROOT)],check=True)
modules=['ferro/engine.js','ferro/physx-runtime.js','ferro/physx.js','fmath.js','passages.js','surface.js','skies.js','gpu-profile.js','reflections.js','renderer.js','profiles.js','world.js','destruction.js','physics-geometry.js','physics.js','metal-physics.js','music.js','imuse.js','music-director.js','audio.js','audio-recipes.js','soundscape.js','economy.js','brain.js','simulation.js','motion.js','actors.js','effects.js','options.js','input.js','controls.js','loop.js','schedule.js','touch.js','jobs.js','tasks.js','host.js','demo.js','pilot.js','demo-metal.js','replay-metal.js','game.js']
sim_hash=hashlib.sha256(b''.join((ROOT/'src'/n).read_bytes() for n in json.loads((ROOT/'tools/simulation-modules.json').read_text()))).hexdigest()
css=(ROOT/'src/style.css').read_text()
code='\n;\n'.join((ROOT/'src'/name).read_text() for name in modules)
shared={'fmath.js','passages.js','renderer.js','profiles.js','world.js','destruction.js','physics-geometry.js','physics.js','metal-physics.js','music.js','imuse.js','audio.js','audio-recipes.js','economy.js','brain.js','simulation.js','jobs.js','tasks.js'}
def module_source(name):
    source=(ROOT/'src'/name).read_text()
    return 'FERRO.initPhysics().then(function(){\n'+source+"\n}).catch(function(error){console.error('FERRO physics initialization failed',error);const notice=document.createElement('p');notice.setAttribute('role','alert');notice.textContent='Impossible de démarrer le jeu. Rechargez la page.';document.body.appendChild(notice);});" if name=='game.js' else source
scripts='\n'.join('<script data-module="'+name+'" data-role="'+('shared' if name in shared else 'page')+'"'+(' data-worker' if name in shared else '')+'>'+module_source(name)+'</script>' for name in modules)
html=(ROOT/'src/index.html').read_text().replace('/*__STYLE__*/',css).replace('<script>/*__CODE__*/</script>',scripts).replace('__GAME_VERSION__',json.loads((ROOT/'package.json').read_text())['version']).replace('__SIM_HASH__',sim_hash)
assert '</script' not in code.lower(), 'Inline script contains a closing script tag'
data=html.encode('utf-8')
(ROOT/'dist').mkdir(exist_ok=True)
(ROOT/'dist/index.html').write_bytes(data)
report={'version':json.loads((ROOT/'package.json').read_text())['version'],'html_bytes':len(data),'html_decimal_kb':round(len(data)/1000,2),'html_kib':round(len(data)/1024,2),'gzip_bytes':len(gzip.compress(data,mtime=0)),'sha256':hashlib.sha256(data).hexdigest(),'external_assets':0,'runtime':'Web browser; WebGL 2 preferred, Canvas 2D software fallback, optional Web Audio; browser size excluded','source_bytes':{name:(ROOT/'src'/name).stat().st_size for name in modules}}
(ROOT/'SIZE.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
