// Le chef d'orchestre du jeu : une décision musicale par image, déterministe,
// sans horloge ni aléa. Il ne joue rien : il demande à l'hôte.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/music-director.js',import.meta.url),'utf8');
function director(options){
  const scope={};scope.window=scope;
  vm.createContext(scope);
  vm.runInContext(source,scope,{filename:'music-director.js'});
  const calls=[],released=[];
  return Object.assign(scope.FMusicDirector.create({host:{
    request:(cue,meta)=>{calls.push({cue,...meta});return true;},
    release:()=>{released.push(true);return true;}
  }}),{calls,released,scope});
}

test('une secteur calme ne demande aucune pièce',()=>{
  const d=director();
  for(let i=0;i<600;i++)d.update({threat:0,director:{pressure:0}},1/60);
  assert.equal(d.cue(),'');assert.deepEqual(d.calls,[]);assert.equal(d.released.length,0);
});
test('le combat est demandé dès que lalerte monte, sans attendre',()=>{
  const d=director();
  assert.equal(d.update({threat:.62,director:{pressure:0}},1/60),true);
  assert.equal(d.cue(),'combat');
  assert.deepEqual(d.calls,[{cue:'combat',key:'combat-1',urgent:true,from:''}]);
  // la même situation ne redemande rien, image après image
  for(let i=0;i<600;i++)assert.equal(d.update({threat:.62,director:{pressure:0}},1/60),false);
  assert.equal(d.calls.length,1);
});
test('lalerte qui oscille autour du seuil ne fait pas claquer la musique',()=>{
  const d=director();
  d.update({threat:.6,director:{pressure:0}},1/60);
  assert.equal(d.cue(),'combat');
  // entre la sortie (.18) et lentrée (.5) : la pièce en cours garde la main
  for(let i=0;i<600;i++)d.update({threat:.3,director:{pressure:.2}},1/60);
  assert.equal(d.cue(),'combat');assert.equal(d.calls.length,1);
  // le retour au calme demande un vrai calme prolongé
  for(let i=0;i<600;i++)d.update({threat:.05,director:{pressure:0}},1/60);
  assert.equal(d.cue(),'combat','au bout de dix secondes seulement, on est encore en combat');
  for(let i=0;i<1500;i++)d.update({threat:.05,director:{pressure:0}},1/60);
  assert.equal(d.cue(),'calm','après vingt-cinq secondes sans alerte, la veille basse prend le relais');
  assert.deepEqual(d.calls[1],{cue:'calm',key:'calm-2',urgent:false,from:'combat'});
});
test('le colosse et la victoire sont urgents et ne respectent pas le temps de séjour',()=>{
  const d=director();
  d.update({threat:.6,director:{pressure:0}},1/60);assert.equal(d.cue(),'combat');
  assert.equal(d.update({threat:.4,bossAlive:true,director:{pressure:0}},1/60),true,'le colosse prend la main immédiatement');
  assert.equal(d.cue(),'boss');assert.deepEqual(d.calls[1],{cue:'boss',key:'boss-2',urgent:true,from:'combat'});
  assert.equal(d.victory(),true);assert.equal(d.cue(),'victory');
  assert.deepEqual(d.calls[2],{cue:'victory',key:'victory-3',urgent:true});
  assert.equal(d.victory(),false,'la victoire nest pas redemandée');
});
test('un changement trop rapide est refusé puis accepté, sans horloge interne',()=>{
  const d=director({dwell:6});
  d.update({threat:.6,director:{pressure:0}},1/60);assert.equal(d.cue(),'combat');
  for(let i=0;i<1600;i++)d.update({threat:.05,director:{pressure:0}},1/60);
  assert.equal(d.cue(),'calm');
  const since=d.state().since;
  d.update({threat:.4,director:{pressure:0}},1/60);
  assert.equal(d.cue(),'calm','le thème du secteur attend la fin du temps de séjour');
  assert.equal(d.state().blocked,1,'le refus est compté');
  assert.equal(d.released.length,0,'et aucune pièce na été rendue pendant ce refus');
  for(let i=0;i<400;i++)d.update({threat:.4,director:{pressure:0}},1/60);
  assert.equal(d.cue(),'','passé le temps de séjour, la décision est prise');
  assert.equal(d.released.length,1);
  assert(d.state().since>since);
});
test('la mort rend le thème du secteur et la reprise du secteur repart à zéro',()=>{
  const d=director();
  d.update({threat:.7,director:{pressure:0}},1/60);assert.equal(d.cue(),'combat');
  assert.equal(d.update({threat:.7,dead:true,director:{pressure:0}},1/60),true);
  assert.equal(d.cue(),'');assert.equal(d.released.length,1,'la pièce est rendue, pas coupée');
  d.update({threat:.7,director:{pressure:0}},1/60);assert.equal(d.cue(),'combat');
  d.reset();assert.equal(d.cue(),'','un nouveau secteur repart sur le thème du secteur');
  d.update({threat:.7,director:{pressure:0}},1/60);
  assert.equal(d.calls.at(-1).key,'combat-3','les clés ne se répètent jamais');
});
test('la pression du directeur déclenche le combat même sans ennemi visible',()=>{
  const d=director();
  assert.equal(d.update({threat:0,director:{pressure:.8}},1/60),true);
  assert.equal(d.cue(),'combat');
});
test('la même suite détats donne exactement les mêmes demandes',()=>{
  const script=[];
  for(let i=0;i<400;i++)script.push({threat:i<120?0:i<260?.8:.05,director:{pressure:i<260?.7:0},bossAlive:i>200&&i<300});
  const run=()=>{const d=director();for(const s of script)d.update(s,1/60);return JSON.stringify(d.calls);};
  assert.equal(run(),run());
  assert(run().includes('"cue":"boss"'));
});
test('aucune horloge, aucun aléa, aucun audio dans le chef dorchestre',()=>{
  for(const banned of ['setTimeout','setInterval','Date.now','Math.random','AudioContext','FMusic\b','FAudio'])
    assert(!new RegExp(banned).test(source),'le module doit rester une décision pure, sans '+banned);
  const d=director();
  assert.equal(d.update(undefined,NaN),false,'un état vide et un pas invalide ne cassent rien');
  assert.equal(d.update({threat:'x',director:null},1/60),false);
  assert.equal(d.cue(),'');
});
