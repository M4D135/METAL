import {loadFast} from '../sim/fast.mjs';
const ctx=loadFast(),{FWorld}=ctx.window;const w=FWorld.create(96,0,{campaign:true}),cats={},shapes={};
for(const g of w.destructibles)if(g.kind==='prop'&&g.colliders.length===1){const c=w.colliders[g.colliders[0]],m=w.meshes[c.mesh],sx=c.maxX-c.minX,sy=c.maxY-c.minY,sz=c.maxZ-c.minZ;if(Math.max(sx,sy,sz)<=1.8&&Math.min(sx,sy,sz)>=.3){const k=(m.category||'none')+'/'+(m.shape||'box')+'/mat'+m.mat;cats[k]=(cats[k]||[]);cats[k].push([sx,sy,sz].map(v=>+v.toFixed(2)).join('x'));}}
for(const [k,v] of Object.entries(cats))console.log(k,v.length,v.slice(0,4).join(' '));
