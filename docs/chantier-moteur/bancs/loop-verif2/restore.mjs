// LOOP-01 (contre-vérif, domaine principal) : points de reprise pris joueur au sol, toutes les 3 s,
// rejoués dans un monde régénéré ET dans le même objet monde. node restore.mjs [s] [mondes] [motif]
import {loadFast,rep,mkWorld,INPUTS} from './fast.mjs';
const [secs='30',list='classic-0,campaign-0,campaign-9,campaign-10',pat='b']=process.argv.slice(2);
const W=loadFast({patch:(n,src)=>n!=='simulation'?src:rep(rep(src,"require=condition=>{if(!condition)throw new Error('Invalid checkpoint');};",
 "require=condition=>{if(!condition){const e=new Error('Invalid checkpoint');G.__failLine=((e.stack.split('\\n')[2]||'').match(/simulation\\.js:(\\d+)/)||[])[1];throw e;}};"),'G.FSimulation={create,','G.__debrisHalf=debrisHalf;G.FSimulation={create,')});
const {FSimulation,FBrain,FDestruction}=W,half=W.__debrisHalf,input=INPUTS[pat];
const ov=(q,h,b)=>q.x+h[0]>b.minX+.0002&&q.x-h[0]<b.maxX-.0002&&q.y+h[1]>b.minY+.0002&&q.y-h[1]<b.maxY-.0002&&q.z+h[2]>b.minZ+.0002&&q.z-h[2]<b.maxZ-.0002;
const mk=(w)=>FSimulation.create(w,{armorSystem:true,brain:FBrain.create({mode:'cpu'})});
const rows=[];
for(const label of list.split(',')){
  const world=mkWorld(W,label),sim=mk(world),s=sim.state;let t=0,tries=0,fails=0,same=0,first=null,rEmpty=0,rSoft=0,lines={},ovl=0,resting=0,maxD=0,noRubbleTries=0,noRubbleFails=0;
  while(t<+secs&&!s.dead&&!s.won){
    for(let i=0;(i<180||s.player.airborne)&&i<900;i++){sim.step(1/60,input(t));t+=1/60;s.player.hp=Math.max(s.player.hp,60);if(s.dead||s.won)break;}
    if(s.dead||s.won)break;tries++;const snap=JSON.parse(JSON.stringify(sim.snapshot()));
    if(!snap.state.rubble.length)noRubbleTries++;
    W.__failLine=null;const ok=mk(mkWorld(W,label)).restore(snap,{recover:true});const line=W.__failLine;
    if(!mk(world).restore(JSON.parse(JSON.stringify(snap)),{recover:true}))same++;
    if(!ok){fails++;first??=+t.toFixed(1);lines[line]=(lines[line]||0)+1;if(!snap.state.rubble.length)noRubbleFails++;
      const d=FDestruction.create(mkWorld(W,label));d.restore(snap.destruction,{exactRevision:true});
      for(const q of snap.state.rubble){if(!q.resting)continue;resting++;const h=half(q);for(const b of d.colliders)if(ov(q,h,b)){ovl++;maxD=Math.max(maxD,Math.min(q.x+h[0]-b.minX,b.maxX-(q.x-h[0]),q.y+h[1]-b.minY,b.maxY-(q.y-h[1]),q.z+h[2]-b.minZ,b.maxZ-(q.z-h[2])));break;}}
      const a=JSON.parse(JSON.stringify(snap));a.state.rubble=[];if(mk(mkWorld(W,label)).restore(a,{recover:true}))rEmpty++;
      const b=JSON.parse(JSON.stringify(snap));for(const q of b.state.rubble)if(q.resting)q.resting=false;if(mk(mkWorld(W,label)).restore(b,{recover:true}))rSoft++;}
  }
  rows.push({monde:label,motif:pat,essais:tries,refus:fails,refusMemeMonde:same,premier:first,lignes:JSON.stringify(lines),poses:resting,recouvr:ovl,profMax:+maxD.toFixed(3),sauvVide:rEmpty,sauvNonPoses:rSoft,rubble:s.debris.filter(q=>q.structural).length,rev:sim.destruction?.revision,t:+t.toFixed(1),mort:s.dead});
}
console.table(rows);
