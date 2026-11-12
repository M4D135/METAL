import {vload} from './vload.mjs';
const root=process.argv[2];const W=vload(root,['renderer','world','destruction','economy','brain','simulation']);
const w=W.FWorld.create(96,0,{campaign:true,campaignVersion:2});
console.log('collider keys',Object.keys(w.colliders[0]),JSON.stringify(w.colliders[0]).slice(0,200));
const boss=w.enemies.find(e=>e.boss);console.log('boss',JSON.stringify({x:boss.x,z:boss.z,arena:boss.arena,kind:boss.bossKind}));
