// TACT : pilote de pointeurs tactiles au-dessus du harnais LOOP (vrai game.js, DOM factice, horloge virtuelle).
// Rien n'est écrit dans le dépôt METAL : tout est en mémoire. Les événements imitent le navigateur :
// capture implicite du pointeur tactile par la cible du pointerdown, remontée jusqu'à window, lostpointercapture.
import {createHarness} from '../loop/harness.mjs';

export const FNV=()=>{let h=0x811c9dc5;const f=new Float64Array(1),b=new Uint8Array(f.buffer);return {num(x){f[0]=x;for(let i=0;i<8;i++){h^=b[i];h=Math.imul(h,0x01000193)>>>0;}},str(s){for(let i=0;i<s.length;i++){h^=s.charCodeAt(i)&255;h=Math.imul(h,0x01000193)>>>0;}},get value(){return h.toString(16).padStart(8,'0');}};};
export function stateHash(sim){const s=sim.state,h=FNV(),p=s.player;
  for(const k of ['x','y','z','yaw','pitch','hp','heat','dash','airVY'])h.num(+p[k]||0);
  h.num(s.time);h.num(s.shots||0);h.num(s.hits||0);h.num(s.kills||0);h.num(s.score||0);
  for(const e of s.enemies||[]){h.num(e.x);h.num(e.y);h.num(e.z);h.num(e.hp);h.num(e.yaw||0);}
  for(const q of s.projectiles||[]){h.num(q.x);h.num(q.y);h.num(q.z);}
  return h.value;}

// Rectangles réels relevés dans Chrome (390×844, body.touch, voir layout.mjs) : utilisés par getBoundingClientRect du DOM factice.
export const RECTS={
  '390x844':{'move-zone':[23,493,102,102],'fire-button':[291,517,77,77],'left-fire-button':[229,541,49,49],'dash-button':[231,489,40,40],'pulse-button':[314,465,40,40],'melee-button':[304,422,62,30]},
};

export async function boot(root,{width=390,height=844,dpr=3,touch=true,rects=RECTS['390x844'],fps=60}={}){
  const winLs={},rec=[];let recording=false;
  const H=createHarness(root,{search:touch?'?touch=1':'',width,height,dpr,beforeGame(ctx){
    const add=ctx.addEventListener;ctx.addEventListener=(t,f,o)=>{(winLs[t]??=[]).push(f);add(t,f,o);};
    const create=ctx.FSimulation.create;ctx.FSimulation.create=(...a)=>{const sim=create(...a),step=sim.step;
      sim.step=(dt,input)=>{if(recording)rec.push({dt,moveX:input.moveX,moveY:input.moveY,lookX:input.lookX,lookY:input.lookY,fire:!!input.fire,fireLeft:!!input.fireLeft,dash:!!input.dash,pulse:!!input.pulse,melee:!!input.melee,interact:!!input.interact,weapon:input.weapon,sprint:!!input.sprint,assist:!!input.assist,jump:!!input.jump,bash:!!input.bash});return step(dt,input);};return sim;};
  }});
  const el=id=>H.doc.getElementById(id);
  for(const id in rects){const [l,t,w,h]=rects[id];el(id).getBoundingClientRect=()=>({left:l,top:t,width:w,height:h,right:l+w,bottom:t+h});}
  await H.startGame();
  const cap=new Map();
  const ev=(type,id,x,y,t)=>({type,pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,timeStamp:t,isPrimary:id===1});
  const win=(type,e)=>{for(const f of winLs[type]||[])f({preventDefault(){},stopPropagation(){},target:e.target,...e});};
  const P={
    down(id,target,x,y,t=H.now){const node=target==='canvas'?H.canvas:el(target);cap.set(id,{node,x,y});const e=ev('pointerdown',id,x,y,t);node.dispatch('pointerdown',e);win('pointerdown',{...e,target:node});},
    move(id,x,y,t=H.now){const c=cap.get(id);if(!c)return;c.x=x;c.y=y;const e=ev('pointermove',id,x,y,t);c.node.dispatch('pointermove',e);win('pointermove',{...e,target:c.node});},
    up(id,t=H.now){const c=cap.get(id);if(!c)return;cap.delete(id);const e=ev('pointerup',id,c.x,c.y,t);c.node.dispatch('pointerup',e);win('pointerup',{...e,target:c.node});c.node.dispatch('lostpointercapture',ev('lostpointercapture',id,c.x,c.y,t));},
  };
  const F=1000/fps;
  // Exécute `ms` de jeu ; `events` = [{t (ms relatif), fn}] déclenchés avant la première image dont l'heure >= t.
  function play(ms,events=[],frameMs=F){const t0=H.now;const q=events.slice().sort((a,b)=>a.t-b.t);let i=0;const n=Math.round(ms/frameMs);
    for(let f=1;f<=n;f++){const T=t0+f*frameMs;while(i<q.length&&t0+q[i].t<=T){H.now=t0+q[i].t;q[i].fn(t0+q[i].t);i++;}H.frame(T);}
    while(i<q.length){q[i].fn(t0+q[i].t);i++;}}
  return {H,P,el,play,rec,record(on){recording=on;if(on)rec.length=0;},get sim(){return H.G.sim;},key:H.key,mouse:H.mouse,F};
}
// Mode dieu léger : remet la vie au maximum à chaque appel (les scénarios mesurent les commandes, pas le combat).
export const heal=B=>{const p=B.sim.state.player;p.hp=B.sim.state.maxHp||100;};
