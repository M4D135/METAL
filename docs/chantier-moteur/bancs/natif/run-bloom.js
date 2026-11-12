// NATIF : le halo du bloom depend-il de la resolution ? Pour chaque image, on rend avec et sans bloom et on mesure
// l'empreinte du halo (part des pixels modifies d'au moins 2 puis 8 niveaux) et son apport moyen.
(function(){
  'use strict';
  const C=window.__CFG,out=document.createElement('pre');out.id='vout';document.body.appendChild(out);
  const R={name:C.name,errors:[],res:{}};
  let fakeDpr=2;Object.defineProperty(window,'devicePixelRatio',{get:()=>fakeDpr,configurable:true});
  try{
    const W=window.FWorld.create(96,0,{campaign:true,campaignVersion:2});
    const sim=window.FSimulation.create(W,{armorSystem:true,brain:window.FBrain.create({mode:'cpu'})});
    const meshes=sim.destruction&&sim.destruction.meshes||W.meshes,lights=sim.destruction&&sim.destruction.lights||W.lights;
    for(const spec of C.variants){
      const c=document.createElement('canvas');c.style.width=spec.cssW+'px';c.style.height=spec.cssH+'px';document.body.appendChild(c);
      const r=window.__V[spec.code].create(c);r.resize(spec.quality);r.setWorld(meshes,lights,W.environment);const gl=c.getContext('webgl2');
      const read=()=>{const b=new Uint8Array(c.width*c.height*4);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;};
      const L=[];
      for(const i of C.frames){const f=window.__SCENE[i];
        const go=bloom=>{r.actorFilter(f.camera,{shadows:true});r.draw(f.camera,f.dynamic,Object.assign({},f.fx,{adaptive:false,bloom}));return read();};
        go(true);const on=go(true),off=go(false);let n2=0,n8=0,sum=0,src=0;const px=on.length/4;
        for(let k=0;k<on.length;k+=4){const d=Math.max(on[k]-off[k],on[k+1]-off[k+1],on[k+2]-off[k+2]);if(d>=2)n2++;if(d>=8)n8++;sum+=d;if(Math.max(off[k],off[k+1],off[k+2])>=.56*255)src++;}
        L.push({i,ge2:+(100*n2/px).toFixed(3),ge8:+(100*n8/px).toFixed(3),mean:+(sum/px).toFixed(4),sources:+(100*src/px).toFixed(3)});}
      R.res[spec.id]={w:c.width,h:c.height,frames:L};
    }
  }catch(e){R.errors.push(String(e&&e.stack||e));}
  out.textContent=JSON.stringify(R);
})();
