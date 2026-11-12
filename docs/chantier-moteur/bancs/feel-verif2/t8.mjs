// Low solids: are 0.07..0.42 m solids steps or walls? Flat-world test + count in real worlds + floor steps.
import {load,flat} from './L.mjs';
const W=load();const S=W.FSimulation;
for(const h of [.05,.1,.25,.4]){const sim=S.create(flat({colliders:[{minX:-2,maxX:2,minZ:-8,maxZ:-4,minY:0,maxY:h}]}),{equipment:{right:0,left:null,shieldEnergy:100}});const p=sim.state.player;for(let i=0;i<120;i++)sim.step(1/60,{moveY:1,sprint:true});console.log(`solide de ${h} m sur sol plat: z final ${p.z.toFixed(2)} y ${p.y.toFixed(2)} ->`,p.z>-3.8?'BLOQUE (mur)':p.y>0?'gravi':'traverse');}
// floor step 0.25 / 0.40 between two walkable rects
for(const h of [.25,.4]){const sim=S.create(flat({walkable:[{x:0,y:0,z:5,w:100,d:20},{x:0,y:h,z:-25,w:100,d:40}]}),{equipment:{right:0,left:null,shieldEnergy:100}});const p=sim.state.player;let prev=p.y,mx=0;for(let i=0;i<120;i++){sim.step(1/60,{moveY:1,sprint:true});mx=Math.max(mx,Math.abs(p.y-prev));prev=p.y;}console.log(`marche de sol ${h} m: y final ${p.y.toFixed(2)}, saut max de p.y en une image ${mx.toFixed(2)} m`);}
for(const idx of [0,5,17]){const w=W.FWorld.create(96,idx,{campaign:true,campaignVersion:2});const sim=S.create(w,{});let n=0;const hs={};
  for(const q of w.colliders){const cx=(q.minX+q.maxX)/2,cz=(q.minZ+q.maxZ)/2;let g=-Infinity;for(const [ox,oz] of [[q.minX-.35,cz],[q.maxX+.35,cz],[cx,q.minZ-.35],[cx,q.maxZ+.35]]){const y=sim.ground(ox,oz);if(Number.isFinite(y))g=Math.max(g,y);}
    if(!Number.isFinite(g)||q.minY>g+.5)continue;const h=q.maxY-g;if(h>.06&&h<=.43){n++;const k=h.toFixed(2);hs[k]=(hs[k]||0)+1;}}
  // walkable height steps between overlapping/adjacent flats
  const f=w.walkable;let steps=0;const ds={};for(let i=0;i<f.length;i++)for(let j=i+1;j<f.length;j++){const a=f[i],c=f[j];if(a.slopeX||a.slopeZ||c.slopeX||c.slopeZ)continue;const dy=Math.abs((a.y||0)-(c.y||0));if(dy<.02||dy>.43)continue;const ox=Math.min(a.x+a.w/2,c.x+c.w/2)-Math.max(a.x-a.w/2,c.x-c.w/2),oz=Math.min(a.z+a.d/2,c.z+c.d/2)-Math.max(a.z-a.d/2,c.z-c.d/2);if(ox>=-.01&&oz>=-.01&&(ox>.3||oz>.3)){steps++;const k=dy.toFixed(2);ds[k]=(ds[k]||0)+1;}}
  console.log('monde',idx,'solides bas (0.06..0.43 m) =',n,JSON.stringify(hs),'| paires de sols a marche <=0.43 m:',steps,JSON.stringify(ds));}
