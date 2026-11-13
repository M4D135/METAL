// Cadence obtenue par le limiteur game.js:676 `if(prefs.fpsLimit&&now-last<1000/prefs.fpsLimit-.5)return;`
// (last=now après chaque image retenue) comparée à un limiteur à échéance cumulée.
// Horodatages rAF = vsync arrondis à 0,1 ms (précision réduite des navigateurs), 20 s simulées.
const displays=[60,75,90,100,120,144,165,240];
const limits=[30,60,120];
function run(hz,limit,algo){
  let last=0,due=0,shown=0,lastShown=null;const gaps=[];
  for(let k=1;k<=hz*20;k++){
    const now=Math.round(k*1000/hz*10)/10;
    if(algo==='actuel'){if(now-last<1000/limit-.5)continue;last=now;}
    else{const half=500/hz;// demi-période d'affichage estimée (moyenne glissante des écarts rAF en pratique)
      if(now<due-half)continue;due=Math.max(due+1000/limit,now-1000/limit);}
    if(lastShown!==null)gaps.push(now-lastShown);lastShown=now;shown++;
  }
  const g=gaps.sort((a,b)=>a-b),distinct=[...new Set(g.map(v=>Math.round(v)))];
  return {fps:+(shown/20).toFixed(1),gapsMs:distinct.join('/')};
}
const rows=[];
for(const hz of displays)for(const limit of limits){if(limit>=hz)continue;const a=run(hz,limit,'actuel'),b=run(hz,limit,'echeance');rows.push({affichage:hz+' Hz',limite:limit,'fps actuel':a.fps,'écarts actuels (ms)':a.gapsMs,'fps échéance':b.fps,'écarts échéance (ms)':b.gapsMs});}
console.table(rows);
