// RCPU: trace of the scripted run (where the player is, what is around) to check the scenario is representative.
import {scene} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||1800),[kind,idx]=(process.argv[4]||'camp:6').split(':'),mode=process.argv[5]||'tour';
const S=scene(root,{world:[kind,+idx]});const s=S.sim.state;
for(let i=0;i<frames;i++){
  const r=S.frame(1/60,{tour:mode==='tour'});
  if(i%150===0){const p=s.player;const near=s.enemies.filter(e=>e.hp>0&&e.deployed!==false&&Math.hypot(e.x-p.x,e.z-p.z)<40).length;
    console.log(i,'pos',p.x.toFixed(1),p.z.toFixed(1),'hp',Math.round(p.hp),'alive',s.enemies.filter(e=>e.hp>0&&e.deployed!==false).length,'near40',near,'expl',(s.explosions||[]).length,'debris',(s.debris||[]).length,'struct',(s.debris||[]).filter(d=>d.structural).length,'parts',(s.particles||[]).length,'bul',(s.bullets||[]).length,'proj',(s.projectiles||[]).length,'dyn',r.dynamic,'vis',S.renderer.stats.staticVisible,'draw',r.drawMs.toFixed(2),'rev',s.destructionRevision,'weapon',s.weapon);}
}
