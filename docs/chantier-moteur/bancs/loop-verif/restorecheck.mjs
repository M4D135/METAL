// Contre-vérification LOOP-01 : un point de reprise pris en jeu (joueur au sol) est-il accepté
// par restore() dans une simulation neuve (monde régénéré, comme après un rechargement) ?
// node restorecheck.mjs <ferro> [secondes] [mondes séparés par des virgules]
import {load} from './load.mjs';
const [root,secs='30',list='classic-0,campaign-0,campaign-9,campaign-10']=process.argv.slice(2);
const W=load(root,{patch:src=>src.replace("require=condition=>{if(!condition)throw new Error('Invalid checkpoint');};",
  "require=condition=>{if(!condition){const e=new Error('Invalid checkpoint');G.__failLine=((e.stack.split('\\n')[2]||'').match(/simulation\\.js:(\\d+)/)||[])[1];throw e;}};")});
const {FWorld,FSimulation,FBrain,FDestruction}=W;
const half=W.__debrisHalf;
function makeWorld(label){const [kind,i]=label.split('-');return kind==='classic'?FWorld.create(96,+i):FWorld.create(96,+i,{campaign:true,campaignVersion:2});}
function overlaps(q,h,box){return q.x+h[0]>box.minX+.0002&&q.x-h[0]<box.maxX-.0002&&q.y+h[1]>box.minY+.0002&&q.y-h[1]<box.maxY-.0002&&q.z+h[2]>box.minZ+.0002&&q.z-h[2]<box.maxZ-.0002;}
const rows=[];
for(const label of list.split(',')){
  const world=makeWorld(label),opts={armorSystem:true};
  const sim=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})}),s=sim.state;
  let t=0,tries=0,fails=0,sameWorldFails=0,first=null,rescueEmpty=0,rescueSoft=0,lines={},overl=0,maxDepth=0,restingAtFail=0;
  const input=t=>({moveX:Math.sign(Math.sin(t*.9)),moveY:1,lookX:.012,lookY:Math.sin(t*.5)*.002,fire:true,fireLeft:false,dash:(t%2.5)<1/60,sprint:(t%4)<2,weapon:Math.floor(t/5)%5});
  while(t<+secs&&!s.dead&&!s.won){
    for(let i=0;i<180||s.player.airborne;i++){sim.step(1/60,input(t));t+=1/60;s.player.hp=Math.max(s.player.hp,60);if(s.dead||s.won)break;if(i>900)break;}
    if(s.dead||s.won)break;
    tries++;const snap=JSON.parse(JSON.stringify(sim.snapshot()));
    // Monde régénéré (rechargement de page) puis même objet monde (mort dans la session, cachedWorld).
    W.__failLine=null;const fresh=FSimulation.create(makeWorld(label),{...opts,brain:FBrain.create({mode:'cpu'})});
    const ok=fresh.restore(snap,{recover:true});
    const same=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})}).restore(JSON.parse(JSON.stringify(snap)),{recover:true});
    if(!same)sameWorldFails++;
    if(!ok){fails++;first??=+t.toFixed(1);lines[W.__failLine]=(lines[W.__failLine]||0)+1;
      // Recalcul indépendant : débris posés qui recouvrent un collider du monde restauré.
      const d=FDestruction.create(makeWorld(label));d.restore(snap.destruction,{exactRevision:true});
      for(const q of snap.state.rubble){if(!q.resting)continue;restingAtFail++;const h=half(q);for(const box of d.colliders)if(overlaps(q,h,box)){overl++;const depth=Math.min(q.x+h[0]-box.minX,box.maxX-(q.x-h[0]),q.y+h[1]-box.minY,box.maxY-(q.y-h[1]),q.z+h[2]-box.minZ,box.maxZ-(q.z-h[2]));maxDepth=Math.max(maxDepth,depth);break;}}
      const a=JSON.parse(JSON.stringify(snap));a.state.rubble=[];if(FSimulation.create(makeWorld(label),{...opts,brain:FBrain.create({mode:'cpu'})}).restore(a,{recover:true}))rescueEmpty++;
      const b=JSON.parse(JSON.stringify(snap));for(const q of b.state.rubble)if(q.resting)q.resting=false;if(FSimulation.create(makeWorld(label),{...opts,brain:FBrain.create({mode:'cpu'})}).restore(b,{recover:true}))rescueSoft++;
    }
  }
  rows.push({monde:label,essais:tries,refus:fails,refusMêmeMonde:sameWorldFails,premier:first,lignes:JSON.stringify(lines),recouvrements:overl,profMax:+maxDepth.toFixed(3),sauvésVide:rescueEmpty,sauvésNonPosés:rescueSoft,rubble:s.debris.filter(q=>q.structural).length,revision:sim.destruction?.revision,t:+t.toFixed(1),mort:s.dead});
}
console.table(rows);
