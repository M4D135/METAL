// NATIF : une image fixe d'une variante, laissee a l'ecran pour --screenshot (comparaison visuelle A/B pour David).
(function(){
  'use strict';
  const C=window.__CFG,spec=C.variants[0];
  const W=window.FWorld.create(96,0,{campaign:true,campaignVersion:2});
  const sim=window.FSimulation.create(W,{armorSystem:true,brain:window.FBrain.create({mode:'cpu'})});
  const meshes=sim.destruction&&sim.destruction.meshes||W.meshes,lights=sim.destruction&&sim.destruction.lights||W.lights;
  const c=document.createElement('canvas');c.style.width='100vw';c.style.height='100vh';document.body.appendChild(c);
  const r=window.__V[spec.code].create(c);r.resize(spec.quality);r.setWorld(meshes,lights,W.environment);
  let f;
  if(C.inside){const a=C.inside;f={camera:{pos:[1.5+Math.cos(a*.5)*1.2,4.82,.5+Math.sin(a*.5)*1.2],yaw:a,pitch:-.08,roll:0,fov:78.5},dynamic:[],fx:{time:10,flash:0,lights:[],damage:0,pulse:0,shake:0,shadows:true,bloom:true,adaptive:false}};}
  else{const s=window.__SCENE[C.frame];f={camera:s.camera,dynamic:s.dynamic,fx:Object.assign({},s.fx,{adaptive:false,flash:0,damage:0,pulse:0})};}
  const go=()=>{r.actorFilter(f.camera,{shadows:true});r.draw(f.camera,f.dynamic,f.fx);};
  go();go();requestAnimationFrame(()=>{go();});
})();
