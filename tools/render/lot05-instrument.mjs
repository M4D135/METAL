// Instrumentation de src/renderer.js pour les sondes du lot 05 (rendu, coût processeur).
// Les sondes ne dupliquent pas le moteur : elles y insèrent des compteurs à des ancres
// exactes et échouent bruyamment si le code a bougé, plutôt que de mesurer du vide.
// usage : import {instrument} from './lot05-instrument.mjs';
//         const src = instrument(readFileSync(root + '/src/renderer.js', 'utf8'), 'phases');
import {readFileSync} from 'node:fs';

const OPERATIONS = {
  // Répartition du temps de draw() par étape (rapport, section « Au-delà de la fiche »).
  phases: [
    {op: 'after', anchor: ['      cacheStats.marginDistance=+guardMargin.distance.toFixed(2);cacheStats.marginAngle=+(guardMargin.tilt*180/Math.PI).toFixed(2);'],
      insert: ["      const __cpu=(typeof process!=='undefined'&&process.cpuUsage)?process.cpuUsage():null;",
        '      const __t=()=>{if(!__cpu)return 0;const d=process.cpuUsage(__cpu);return (d.user+d.system)/1000;};',
        '      const __ph=globalThis.__ph||(globalThis.__ph={});let __b=__t();']},
    {op: 'after', anchor: ['      shown.gen=viewHash;shown.count=shown.length;'],
      insert: ['      __ph.vue=(__ph.vue||0)+__t()-__b;__b=__t();']},
    {op: 'after', anchor: ['      const dynamicBatch=pack(ordinary,environment,true,dynamicRows);'],
      insert: ['      __ph.dynamique=(__ph.dynamique||0)+__t()-__b;__b=__t();']},
    {op: 'after', anchor: ['      if(dynamicBatch.values.length){gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);uploadRows(dynamicBuffer,dynamicBatch.values);}'],
      insert: ['      __ph.lumieres=(__ph.lumieres||0)+__t()-__b;__b=__t();']},
    {op: 'after', anchor: ['      gl.bindFramebuffer(gl.FRAMEBUFFER,stats.bloom?post.scene.framebuffer:null);gl.viewport(0,0,canvas.width,canvas.height);'],
      insert: ['      __ph.ombres=(__ph.ombres||0)+__t()-__b;__b=__t();']},
    {op: 'after', anchor: ['      renderBatch(dynamicBatch,dynamicBuffer,false);'],
      insert: ['      __ph.statique=(__ph.statique||0)+__t()-__b;__b=__t();']},
    {op: 'after', anchor: ['        if(overlayParticles.length)renderEffects(overlayParticles,eye,t);', '      }'],
      insert: ['      __ph.effets=(__ph.effets||0)+__t()-__b;__b=__t();']},
    {op: 'after', anchor: ['      if(stats.bloom)postPass();'],
      insert: ['      __ph.post=(__ph.post||0)+__t()-__b;']},
  ],
  // Compteurs de la requête de vue par cellule (T19) : cellules testées, rejetées, entrées touchées.
  't19-sonde': [
    {op: 'replace', anchor: ['            if(!visibleSphere(x*8+4,cy,z*8+4,5.656854249492381+half+maxRadius[level],eye,frustum.axes,frustum.horizontal,frustum.vertical,frustum.far))continue;'],
      with: ['            const C=globalThis.__t19;if(C){C.cellsTested++;C.entriesTouched+=count;}',
        '            if(!visibleSphere(x*8+4,cy,z*8+4,5.656854249492381+half+maxRadius[level],eye,frustum.axes,frustum.horizontal,frustum.vertical,frustum.far)){if(C){C.cellsSkipped++;C.entriesSkipped+=count;}continue;}']},
  ],
  // Variante T16 (abandonnée) : un seul vertexAttribPointer au lieu de quatre par dessin.
  't16-sonde': [
    {op: 'replace', anchor: ['        for(let i=2;i<6;i++) gl.vertexAttribPointer(i,4,gl.FLOAT,false,64,group.offset+(i-2)*16);'],
      with: ['        gl.vertexAttribPointer(2,4,gl.FLOAT,false,64,group.offset);']},
  ],
};

function indexOfAnchor(lines, anchor, where) {
  const hits = [];
  for (let i = 0; i + anchor.length <= lines.length; i++) {
    let ok = true;
    for (let k = 0; k < anchor.length; k++) if (lines[i + k] !== anchor[k]) { ok = false; break; }
    if (ok) hits.push(i);
  }
  if (hits.length === 0) throw new Error('ancre absente du renderer (' + where + ') : ' + JSON.stringify(anchor[0]));
  if (hits.length > 1) throw new Error('ancre ambigue (' + hits.length + ' fois, ' + where + ') : ' + JSON.stringify(anchor[0]));
  return hits[0];
}

export function instrument(source, variant) {
  const ops = OPERATIONS[variant];
  if (!ops) throw new Error('sonde inconnue : ' + variant + ' (possibles : ' + Object.keys(OPERATIONS).join(', ') + ')');
  const lines = source.split('\n');
  for (const op of ops) {
    const i = indexOfAnchor(lines, op.anchor, variant);
    if (op.op === 'after') lines.splice(i + op.anchor.length, 0, ...op.insert);
    else if (op.op === 'replace') lines.splice(i, op.anchor.length, ...op.with);
    else throw new Error('operation inconnue : ' + op.op);
  }
  return lines.join('\n');
}

export function instrumentFile(root, variant, file = 'src/renderer.js') {
  return instrument(readFileSync(root + '/' + file, 'utf8'), variant);
}
