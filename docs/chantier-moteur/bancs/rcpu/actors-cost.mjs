// RCPU: FActors.build cost and primitive count per type / LOD / quality / boss scale.
import {loadModules} from './harness.mjs';
const root=process.argv[2];
const W=loadModules(root,{names:['actors','renderer']});const {FActors}=W;
const HEIGHT=[1.35,1.05,1.6,1.8];
const actor=(type,extra={})=>({id:7,type,x:0,z:0,baseY:0,y:HEIGHT[type],yaw:.7,hp:10,moveSpeed:2,awareness:'engage',attackState:'aim',windup:.3,windupMax:.8,aimX:2,aimY:6,aimZ:-4,...extra});
const cases=[];
for(const type of [0,1,2,3])for(const distance of [5,20,50])cases.push([`type${type}`,actor(type),distance]);
for(const kind of ['colossus','siegebreaker','custodian'])for(const scale of [3,6,9])for(const distance of [20,60,120])cases.push([`boss:${kind}x${scale}`,actor(3,{bossScale:scale,bossKind:kind,bossAwake:true}),distance]);
for(const quality of ['auto','low']){
  console.log('quality',quality);
  for(const [label,e,distance] of cases){
    const opt={time:2.5,phase:1.1,blend:1,distance,quality,backend:'webgl2'};
    let out=FActors.build(e,opt);for(let i=0;i<2000;i++)FActors.build(e,{...opt,time:2.5+i*.016});
    const N=4000,t=performance.now();for(let i=0;i<N;i++)out=FActors.build(e,{...opt,time:2.5+i*.016});const us=(performance.now()-t)/N*1000;
    const lod=out[0]?.actorLod,shapes={};for(const m of out)shapes[m.shape]=(shapes[m.shape]||0)+1;
    console.log(' ',label.padEnd(22),'d='+String(distance).padEnd(4),'lod',lod,'meshes',String(out.length).padStart(3),'build',us.toFixed(2).padStart(6),'us',(us/out.length*1000).toFixed(0).padStart(4),'ns/mesh',JSON.stringify(shapes));
  }
}
