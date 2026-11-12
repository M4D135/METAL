// TACT (1) : suites de pointeurs à deux pouces dans le vrai game.js (harnais LOOP, horloge virtuelle).
// node touch.mjs <racine METAL ou copie prototype> [etiquette]
// Mesures : visée pendant le tir, demi-tour au glisser, vitesse de pointe, tirs perdus sur appui court,
// géométrie du manche, vol de la visée par un 2e doigt, zone morte du canvas.
import {boot,heal} from './lib.mjs';
const root=process.argv[2],label=process.argv[3]||'base';
const out={label};
const deg=r=>r*180/Math.PI;
const W=390,Hh=844;

// ---------- M1 : part du temps de tir pendant laquelle la visée bouge (pouce droit posé sur le bouton de tir, qui glisse) ----------
{
  const B=await boot(root);const p=B.sim.state.player;B.play(500);heal(B);
  const ev=[];
  ev.push({t:0,fn:t=>B.P.down(1,'move-zone',74,544,t)});ev.push({t:20,fn:t=>B.P.move(1,74,544-60,t)}); // pouce gauche : manche vers l'avant
  ev.push({t:1000,fn:t=>B.P.down(2,'fire-button',330,555,t)});          // pouce droit : appui sur le tir
  for(let k=1;k<=240;k++){const tt=1000+k*16.667;const x=330+60*Math.sin(k/240*Math.PI*4),y=555+25*Math.sin(k/240*Math.PI*2);ev.push({t:tt,fn:t=>B.P.move(2,x,y,t)});} // il glisse ±60 px en tirant
  ev.push({t:5000,fn:t=>B.P.up(2,t)});ev.push({t:5500,fn:t=>B.P.up(1,t)});
  B.record(true);const yaw0=p.yaw,pitch0=p.pitch;
  let yawAtFire=null;const shots0=B.sim.state.shots;
  B.play(6000,ev);
  const fire=B.rec.filter(r=>r.fire),aim=fire.filter(r=>r.lookX!==0||r.lookY!==0);
  out.M1={pasDeTir:fire.length,pasDeTirAvecVisee:aim.length,partVisee:+(100*aim.length/Math.max(1,fire.length)).toFixed(1),
    lacetPendantTirDeg:+deg(Math.abs(p.yaw-yaw0)).toFixed(2),tangageDeg:+deg(Math.abs(p.pitch-pitch0)).toFixed(2),tirs:B.sim.state.shots-shots0,
    glisserDuPoucePx:'±60 px horizontaux, ±25 px verticaux pendant 4 s'};
}

// ---------- M2 : durée d'un demi-tour (180°) au glisser, pouce droit sur le canvas ----------
async function halfTurn(speed,stroke=210,regrip=120,frameMs=16.667){
  const B=await boot(root);const p=B.sim.state.player;B.play(300);heal(B);
  const yaw0=p.yaw;const ev=[];let t=0,strokes=0;
  const x0=165,y=330; // zone de visée (x > 36 % de 390 = 140 px), au-dessus de la grappe de boutons
  while(t<6000){
    const dur=stroke/speed*1000,steps=Math.max(1,Math.round(dur/8.333)); // échantillonnage tactile 120 Hz
    ev.push({t,fn:tt=>B.P.down(2,'canvas',x0,y,tt)});
    for(let k=1;k<=steps;k++){const tt=t+dur*k/steps,x=x0+stroke*k/steps;ev.push({t:tt,fn:ttt=>B.P.move(2,x,y,ttt)});}
    ev.push({t:t+dur+1,fn:tt=>B.P.up(2,tt)});t+=dur+regrip;strokes++;
  }
  let done=null;const t0=B.H.now;const q=ev.slice();let i=0;
  for(let f=1;f<=Math.round(6000/frameMs)&&done===null;f++){const T=t0+f*frameMs;while(i<q.length&&t0+q[i].t<=T){B.H.now=t0+q[i].t;q[i].fn(t0+q[i].t);i++;}B.H.frame(T);heal(B);if(Math.abs(p.yaw-yaw0)>=Math.PI)done=T-t0;}
  return {vitessePxS:speed,coursePx:stroke,repriseMs:regrip,demiTourMs:done===null?null:Math.round(done),pxPour180:Math.round(Math.PI/(Math.abs(p.yaw-yaw0)/1)*0)||undefined};
}
out.M2=[];for(const v of [600,1200,2400])out.M2.push(await halfTurn(v));

// ---------- M3 : vitesse de pointe, manche à fond (tactile) contre clavier avec course ----------
{
  const B=await boot(root);B.play(300);heal(B);let vmax=0;
  B.P.down(1,'move-zone',74,544);B.P.move(1,74,544-60);
  for(let i=0;i<180;i++){B.play(16.667);heal(B);vmax=Math.max(vmax,B.sim.state.locomotion.speed);}
  B.P.up(1);
  const K=await boot(root,{touch:false});K.play(300);heal(K);let kmax=0;K.key('keydown','KeyW');K.key('keydown','ShiftLeft');
  for(let i=0;i<180;i++){K.play(16.667);heal(K);kmax=Math.max(kmax,K.sim.state.locomotion.speed);}
  // manche bien au-delà du bord (120 px) : y a-t-il une course automatique ?
  const B2=await boot(root);B2.play(300);heal(B2);let v2=0;B2.P.down(1,'move-zone',74,544);B2.P.move(1,74,544-120);
  B2.record(true);for(let i=0;i<180;i++){B2.play(16.667);heal(B2);v2=Math.max(v2,B2.sim.state.locomotion.speed);}
  out.M3={tactileManchePleinMs:+vmax.toFixed(2),clavierCourseMs:+kmax.toFixed(2),ecartPct:+(100*(1-vmax/kmax)).toFixed(1),tactileMancheAuDelaDuBordMs:+v2.toFixed(2),sprintVuParLaSim:B2.rec.some(r=>r.sprint)};
}

// ---------- M4 : tirs perdus sur appui court du bouton de tir (LOOP-06 au tactile) ----------
async function taps(frameMs,holdMs,n=150){
  const B=await boot(root);B.play(300);heal(B);const s=B.sim.state;
  let seed=4242;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const ev=[];let t=200;for(let k=0;k<n;k++){const d=t+rnd()*frameMs;ev.push({t:d,fn:tt=>B.P.down(2,'fire-button',330,555,tt)});ev.push({t:d+holdMs*(.8+.4*rnd()),fn:tt=>B.P.up(2,tt)});t+=420;}
  const shots0=s.shots;const t0=B.H.now;const q=ev.sort((a,b)=>a.t-b.t);let i=0;
  for(let f=1;f<=Math.round((t+400)/frameMs);f++){const T=t0+f*frameMs;while(i<q.length&&t0+q[i].t<=T){B.H.now=t0+q[i].t;q[i].fn(t0+q[i].t);i++;}B.H.frame(T);heal(B);}
  const shots=s.shots-shots0;return {imageMs:+frameMs.toFixed(1),appuiMs:holdMs,appuis:n,tirs:shots,perdusPct:+(100*(1-shots/n)).toFixed(1)};
}
out.M4=[];for(const [F,hold] of process.env.QUICK?[[16.667,30],[33.333,30],[33.333,60],[50,40]]:[[16.667,30],[16.667,60],[16.667,100],[33.333,30],[33.333,60],[33.333,100],[50,40],[50,60],[50,100]])out.M4.push(await taps(F,hold));

// ---------- M5 : géométrie du manche (centre fixe, 34 px, sans zone morte) ----------
{
  const B=await boot(root);B.play(300);heal(B);B.record(true);
  const probeDirect=(x,y)=>{B.P.down(1,'move-zone',x,y);B.play(16.667);const r=B.rec.at(-1);B.P.up(1);B.play(16.667);return {x:r.moveX,y:r.moveY,m:Math.hypot(r.moveX,r.moveY)};};
  const probe=(x,y)=>{B.P.down(1,'move-zone',74,544);B.P.move(1,x,y);B.play(16.667);const r=B.rec.at(-1);B.P.up(1);B.play(16.667);return {x:r.moveX,y:r.moveY,m:Math.hypot(r.moveX,r.moveY)};};
  const c={x:74,y:544};
  const edge=probeDirect(23+4,544);            // doigt posé au bord gauche de la zone (4 px à l'intérieur)
  const jitter=probe(c.x+3,c.y-2);       // tremblement de 3,6 px autour du centre
  const half=probe(c.x,c.y-17),half28=probe(c.x,c.y-28);          // mi-course
  const full=[];for(const [dx,dy] of [[0,-50],[35,-35],[50,0],[13,-47],[-29,41]])full.push(probe(c.x+dx,c.y+dy));
  out.M5={appuiAuBordDeLaZone:{moveX:+edge.x.toFixed(3),amplitude:+edge.m.toFixed(3)},tremblement3px:{amplitude:+jitter.m.toFixed(3),vitesseMs:+(jitter.m*5.4).toFixed(2)},deplace17px:+half.m.toFixed(3),deplace28px:+half28.m.toFixed(3),
    pleineCourse:full.map(f=>({moveX:f.x,moveY:f.y,amplitude:f.m,exact1:f.m===1}))};
}

// ---------- M6 : un 2e doigt sur le canvas vole la visée ----------
{
  const B=await boot(root);const p=B.sim.state.player;B.play(300);heal(B);const yaw0=p.yaw;
  B.P.down(2,'canvas',200,330);B.P.move(2,230,330);B.play(33);const a=p.yaw-yaw0;      // 30 px -> 0,12 rad
  B.P.down(3,'canvas',300,250);B.play(16.667);                                             // 2e doigt (index, paume, raté d'un bouton)
  B.P.move(2,290,330);B.play(33);const b=p.yaw-yaw0;                                      // le 1er doigt continue : 60 px de plus
  B.P.up(3);B.play(16.667);B.P.move(2,350,330);B.play(33);const c=p.yaw-yaw0;             // 2e doigt levé, le 1er glisse encore 60 px
  out.M6={apres30pxDeg:+deg(a).toFixed(2),apres2eDoigtPuis60pxDeg:+deg(b).toFixed(2),apresLeverDu2eDoigtPuis60pxDeg:+deg(c).toFixed(2),attenduSansVolDeg:+deg(150*.004).toFixed(2)};
}

// ---------- M7 : appui à gauche de 36 % hors de la zone du manche : ni déplacement ni visée ----------
{
  const B=await boot(root);const p=B.sim.state.player;B.play(300);heal(B);B.record(true);const yaw0=p.yaw;
  B.P.down(1,'canvas',70,380);B.P.move(1,70,330);B.P.move(1,120,330);B.play(100);
  const moved=B.rec.some(r=>r.moveX||r.moveY),looked=p.yaw!==yaw0;B.P.up(1);
  const zone=102*102,left=.36*W*Hh;
  out.M7={deplacement:moved,visee:looked,partDeLaBandeGaucheUtilePct:+(100*zone/left).toFixed(1)};
}
console.log(JSON.stringify(out,null,1));
