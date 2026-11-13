// DRAW : variantes du renderer de FERRO v0.2 (248043a), appliquees EN MEMOIRE sur une copie. Chaque ancre doit
// exister exactement une fois, sinon la variante echoue (pas de patch silencieux).
export function rep(code,find,replace,label){
  const n=code.split(find).length-1;
  if(n!==1)throw new Error(`patch ${label}: ancre trouvee ${n} fois: ${find.slice(0,90)}`);
  return code.replace(find,()=>replace);
}
const P={};
P.base=c=>c;

// Sommets partages : un sommet par couple (position, normale) au lieu de 3 par triangle. Memes triangles.
P.vdedup=c=>rep(c,"function vertex(p,n) {const i=data.length/6;data.push(...p,...n);return i;}",
  "const seen=new Map();function vertex(p,n) {const key=p[0]+','+p[1]+','+p[2]+'|'+n[0]+','+n[1]+','+n[2];let i=seen.get(key);if(i===undefined){i=data.length/6;data.push(...p,...n);seen.set(key,i);}return i;}",'vdedup');

// invalidateFramebuffer : la profondeur de la scene n'est plus lue apres la passe ; les cibles du bloom et le
// tampon du canvas sont entierement recouverts (inutile de recharger leur ancien contenu sur GPU a tuiles).
P.inv=c=>{
  c=rep(c,"      if(msaa){\n        gl.bindFramebuffer(gl.READ_FRAMEBUFFER,msaa.framebuffer);","      if(stats.bloom&&!msaa)gl.invalidateFramebuffer(gl.FRAMEBUFFER,[gl.DEPTH_ATTACHMENT]);\n      if(msaa){\n        gl.bindFramebuffer(gl.READ_FRAMEBUFFER,msaa.framebuffer);",'inv-depth');
  c=rep(c,"gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.viewport(0,0,post.a.width,post.a.height);","gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.invalidateFramebuffer(gl.FRAMEBUFFER,[gl.COLOR_ATTACHMENT0]);gl.viewport(0,0,post.a.width,post.a.height);",'inv-a');
  c=rep(c,"gl.bindFramebuffer(gl.FRAMEBUFFER,post.b.framebuffer);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);","gl.bindFramebuffer(gl.FRAMEBUFFER,post.b.framebuffer);gl.invalidateFramebuffer(gl.FRAMEBUFFER,[gl.COLOR_ATTACHMENT0]);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);",'inv-b');
  return c;
};

// Arme d'abord : l'arme (overlay) est dessinee AVANT le monde dans la tranche de profondeur [0, 0.1] ; le monde
// occupe [0.1, 1]. Plus de gl.clear(DEPTH) en milieu de passe, et les pixels du monde caches par l'arme ne sont
// plus ombres puis ecrases.
P.wfirst=c=>{
  const plain="selected.forEach(({light},i)=>{const c=light.color||[1,1,1],power=light.power===undefined?1:light.power;lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});gl.uniform3fv(uniforms.uLightColor,lightColors);";
  const dark="selected.forEach(({light},i)=>{const c=light.color||[1,1,1],power=(light.power===undefined?1:light.power)*(blackout.get(light)??1);lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});gl.uniform3fv(uniforms.uLightColor,lightColors);";
  c=rep(c,"      renderStatic(shown,0);\n      // BITUME : chaussée",
    "      if(overlay.length){if(blackout){"+plain+"}gl.depthRange(0,.1);renderBatch(pack(overlay,environment,true),overlayBuffer,true);if(blackout){"+dark+"}}\n      gl.depthRange(overlay.length||overlayParticles.length?.1:0,1);\n      renderStatic(shown,0);\n      // BITUME : chaussée",'wf-a');
  c=rep(c,"        gl.clear(gl.DEPTH_BUFFER_BIT);if(overlay.length)renderBatch(pack(overlay,environment,true),overlayBuffer,true);\n        if(overlayParticles.length)renderEffects(overlayParticles,eye,t);\n      }",
    "        gl.depthRange(0,.1);if(overlayParticles.length)renderEffects(overlayParticles,eye,t);\n      }\n      gl.depthRange(0,1);",'wf-b');
  c=rep(c,"        if(blackout){selected.forEach(({light},i)=>{const c=light.color||[1,1,1],power=light.power===undefined?1:light.power;lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});gl.uniform3fv(uniforms.uLightColor,lightColors);}\n","",'wf-c');
  return c;
};

// Projeteurs du soleil limites a ceux dont l'ombre peut atteindre le champ de vision : capsule (sphere balayee le
// long des rayons du soleil jusqu'au fond du volume) contre les 4 plans lateraux et le plan de l'oeil. Marge 0,6 m
// (noyau PCF de 1,25 texel, pente du plan receveur, decalage de normale).
P.suncull=c=>rep(c,"      const casters=camera.allStatic?worldIndex.entries:worldIndex.query(center,[extent+24,26,0]).filter(inside);",
  `      const __t=Math.tan(Math.max(FOV_MIN,Math.min(110,camera.fov||75))*Math.PI/360),__h=__t*canvas.width/canvas.height,__sh=Math.sqrt(1+__h*__h),__sv=Math.sqrt(1+__t*__t),__R=axes.right,__U=axes.up,__F=axes.forward;
      const reach=e=>{
        const R=e.radius+.6,ax=e.p[0]-eye[0],ay=e.p[1]-eye[1],az=e.p[2]-eye[2];
        const zc=(e.p[0]-p[0])*fw[0]+(e.p[1]-p[1])*fw[1]+(e.p[2]-p[2])*fw[2],L=Math.max(0,far-zc);
        const bx=ax+fw[0]*L,by=ay+fw[1]*L,bz=az+fw[2]*L;
        const xa=ax*__R[0]+ay*__R[1]+az*__R[2],ya=ax*__U[0]+ay*__U[1]+az*__U[2],za=ax*__F[0]+ay*__F[1]+az*__F[2];
        const xb=bx*__R[0]+by*__R[1]+bz*__R[2],yb=bx*__U[0]+by*__U[1]+bz*__U[2],zb=bx*__F[0]+by*__F[1]+bz*__F[2];
        if(za<-R&&zb<-R)return false;
        if(xa-za*__h>R*__sh&&xb-zb*__h>R*__sh)return false;
        if(-xa-za*__h>R*__sh&&-xb-zb*__h>R*__sh)return false;
        if(ya-za*__t>R*__sv&&yb-zb*__t>R*__sv)return false;
        if(-ya-za*__t>R*__sv&&-yb-zb*__t>R*__sv)return false;
        return true;
      };
      const casters=camera.allStatic?worldIndex.entries:worldIndex.query(center,[extent+24,26,0]).filter(e=>inside(e)&&reach(e));`,'suncull');

// textureLod sur l'atlas d'ombre (pas de mip : meme texel), pour ne plus avoir de gradient implicite en branche.
P.texlod=c=>rep(c,"texture(uShadowMap,tap).r","textureLod(uShadowMap,tap,0.).r",'texlod');

// Pre-passe de profondeur (programme de profondeur existant), puis couleur sans ecriture de profondeur.
P.prepass=c=>{
  c=rep(c,"  out vec3 vWorld;\n  out vec3 vNormal;\n  out vec3 vSurface;\n  out vec3 vLocal;\n  out vec3 vSurfaceNormal;","  invariant gl_Position;\n  out vec3 vWorld;\n  out vec3 vNormal;\n  out vec3 vSurface;\n  out vec3 vLocal;\n  out vec3 vSurfaceNormal;",'pp-inv');
  c=rep(c,"      renderStatic(shown,0);\n      // BITUME : chaussée","      gl.useProgram(depthProgram);gl.uniformMatrix4fv(depthMatrix,false,vp);gl.uniform2f(depthWind,environment?environment.wind:0,t);gl.colorMask(false,false,false,false);\n      renderStatic(shown,0);renderBatch(dynamicBatch,dynamicBuffer,false);\n      gl.colorMask(true,true,true,true);gl.depthMask(false);gl.useProgram(program);\n      renderStatic(shown,0);\n      // BITUME : chaussée",'pp-a');
  c=rep(c,"      renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(crowd)renderBatch(crowd,crowdBuffer,false);","      renderBatch(dynamicBatch,dynamicBuffer,false);gl.depthMask(true);\n      if(crowd)renderBatch(crowd,crowdBuffer,false);",'pp-b');
  return c;
};

// Flou vertical du bloom au quart de resolution, composition a 2 lectures au lieu de 6.
P.bloomq=c=>{
  c=rep(c,"  void main(){\n    if(uPass==0){","  void main(){\n    if(uPass==3){fragColor=vec4(texture(uScene,vUV).rgb+texture(uBloom,vUV).rgb*.28,1.);return;}\n    if(uPass==0){",'bq-1');
  c=rep(c,"    if(uPass==2)c=texture(uScene,vUV).rgb+c*.28;\n","",'bq-2');
  c=rep(c,"gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);\n      gl.uniform1i(postUniforms.uPass,2);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls+=3;",
    "gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);\n      gl.uniform1i(postUniforms.uPass,2);gl.drawArrays(gl.TRIANGLES,0,3);\n      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);\n      gl.uniform1i(postUniforms.uPass,3);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls+=4;",'bq-3');
  return c;
};

// Cible de scene RGB10_A2 (meme memoire que RGBA8) + tramage d'un demi-pas a la composition : plus de bandes.
const IGN="fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))";
P.rgb10=c=>{
  c=rep(c,"    function colorTarget(width,height,depth){\n      const target={framebuffer:gl.createFramebuffer(),texture:texture(width,height),width,height,depth:null};",
    "    function colorTarget(width,height,depth){\n      const target={framebuffer:gl.createFramebuffer(),texture:texture(width,height),width,height,depth:null};\n      if(depth)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB10_A2,width,height,0,gl.RGBA,gl.UNSIGNED_INT_2_10_10_10_REV,null);",'rgb10-a');
  c=rep(c,"    if(uPass==2)c=texture(uScene,vUV).rgb+c*.28;\n","    if(uPass==2)c=texture(uScene,vUV).rgb+c*.28+("+IGN+"-.5)/255.;\n",'rgb10-b');
  return c;
};
// Tramage a la source (cible RGBA8 inchangee) : ±0,5 pas avant la quantification, dans le shader du monde et du ciel.
P.dithersrc=c=>{
  c=rep(c,"    fragColor=vec4(color,1.);\n  }`;\n\n  // A separate translucent pass","    fragColor=vec4(color+("+IGN+"-.5)/255.,1.);\n  }`;\n\n  // A separate translucent pass",'ds-a');
  c=rep(c,"    fragColor=vec4(color*mix(.76,1.,vignette),1.);","    fragColor=vec4(color*mix(.76,1.,vignette)+("+IGN+"-.5)/255.,1.);",'ds-b');
  return c;
};

// Contexte sans tampon de profondeur par defaut (la scene est rendue dans sa propre cible quand le bloom est actif).
P.depthfalse=c=>rep(c,"{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'}","{alpha:false,antialias:false,depth:false,powerPreference:'high-performance'}",'depthfalse');

// Mesures de cout seulement (image differente) : ombres sans projeteurs statiques / sans projeteurs dynamiques.
P.shnostat=c=>{
  c=rep(c,"renderStatic(casters,slot+1,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);","renderBatch(dynamicBatch,dynamicBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);",'sns-a');
  return rep(c,"      renderStatic(casters,2,true);\n","",'sns-b');
};
P.shnodyn=c=>{
  c=rep(c,"renderStatic(casters,slot+1,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);","renderStatic(casters,slot+1,true);gl.disable(gl.POLYGON_OFFSET_FILL);",'snd-a');
  return rep(c,"      renderBatch(dynamicBatch,dynamicBuffer,false,true);if(crowd)renderBatch(crowd,crowdBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);","      gl.disable(gl.POLYGON_OFFSET_FILL);",'snd-b');
};

// Compteur de fragments opaques ayant passe le test de profondeur (surdessin), ordre de soumission.
P.overdraw=c=>{
  c=rep(c,"    fragColor=vec4(color,1.);\n  }`;\n\n  // A separate translucent pass","    fragColor=vec4(1./255.,0.,0.,1.);\n  }`;\n\n  // A separate translucent pass",'od-frag');
  c=rep(c,"gl.clearColor(.035,.06,.073,1);","gl.clearColor(0,0,0,1);",'od-clear');
  c=rep(c,"if(environment)skyPass(axes,f,t);gl.useProgram(program);","gl.useProgram(program);",'od-nosky');
  c=rep(c,"      renderStatic(shown,0);\n      // BITUME : chaussée","      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);\n      renderStatic(shown,0);\n      // BITUME : chaussée",'od-blend');
  c=rep(c,"      if(particles.length)renderEffects(particles,eye,t);","      gl.disable(gl.BLEND);",'od-nofx');
  c=rep(c,"        gl.clear(gl.DEPTH_BUFFER_BIT);if(overlay.length)renderBatch(pack(overlay,environment,true),overlayBuffer,true);\n        if(overlayParticles.length)renderEffects(overlayParticles,eye,t);","        gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);if(overlay.length)renderBatch(pack(overlay,environment,true),overlayBuffer,true);gl.disable(gl.BLEND);",'od-overlay');
  return c;
};
// Idem sans l'arme (pour separer le surdessin du monde de celui de l'arme).
P.overdrawworld=c=>rep(P.overdraw(c),"gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);if(overlay.length)renderBatch(pack(overlay,environment,true),overlayBuffer,true);gl.disable(gl.BLEND);","",'odw');

// Tampon d'identifiants : R,G = identifiant d'instance (statiques 0.., dynamiques 20000.., arme 40000..), B = matiere+1.
P.idbuf=c=>{
  c=rep(c,"  uniform vec2 uWindTime;\n  out vec3 vWorld;","  uniform vec2 uWindTime;\n  uniform float uIdBase;\n  flat out float vId;\n  out vec3 vWorld;",'id-vert');
  c=rep(c,"    vColor=iColor;\n    gl_Position=uViewProjection*vec4(vWorld,1.);","    vColor=iColor;vId=uIdBase+float(gl_InstanceID);\n    gl_Position=uViewProjection*vec4(vWorld,1.);",'id-vert2');
  c=rep(c,"  flat in vec4 vColor;\n  uniform vec3 uEye;\n  uniform vec3 uForward;","  flat in vec4 vColor;\n  flat in float vId;\n  uniform vec3 uEye;\n  uniform vec3 uForward;",'id-frag');
  c=rep(c,"    fragColor=vec4(color,1.);\n  }`;\n\n  // A separate translucent pass","    int id=int(vId+.5);fragColor=vec4(float(id&255)/255.,float((id>>8)&255)/255.,(floor(vMaterial+.5)+1.)/255.,1.);\n  }`;\n\n  // A separate translucent pass",'id-out');
  c=rep(c,"'uSkyBottom','uEnvironment']) uniforms[name]=","'uSkyBottom','uEnvironment','uIdBase']) uniforms[name]=",'id-uni');
  c=rep(c,"      for(const group of batch.groups) {\n","      for(const group of batch.groups) {\n        if(!shadowPass)gl.uniform1f(uniforms.uIdBase,(buffer===dynamicBuffer?20000:buffer===overlayBuffer?40000:0)+group.offset/64);\n",'id-base');
  c=rep(c,"gl.clearColor(.035,.06,.073,1);","gl.clearColor(0,0,0,1);",'id-clear');
  c=rep(c,"if(environment)skyPass(axes,f,t);gl.useProgram(program);","gl.useProgram(program);",'id-nosky');
  c=rep(c,"      if(particles.length)renderEffects(particles,eye,t);","",'id-nofx');
  c=rep(c,"        if(overlayParticles.length)renderEffects(overlayParticles,eye,t);","",'id-nofx2');
  return c;
};

// Variante de controle : arme d'abord dans [0, 0.1], monde sur toute la plage [0, 1] (profondeur du monde inchangee).
P.wfirst2=c=>rep(P.wfirst(c),"gl.depthRange(overlay.length||overlayParticles.length?.1:0,1);","gl.depthRange(0,1);",'wf2');

// Ordre de dessin pour le rejet precoce en profondeur : arme, puis dynamiques, puis statiques en 4 bandes de
// distance (proche -> loin), chaque bande regroupee par forme. Aucun tri par instance.
const BANDS="{const __b=[[],[],[],[]];for(const e of shown){const d=Math.sqrt((e.p[0]-eye[0])**2+(e.p[1]-eye[1])**2+(e.p[2]-eye[2])**2)-e.radius;__b[d<8?0:d<18?1:d<34?2:3].push(e);}stats.staticVisible=shown.length;for(const list of __b)if(list.length)renderBatch(packIndexed(list),staticCaches[0].buffer,true);}";
P.order=c=>{
  c=P.wfirst(c);
  c=rep(c,"      renderStatic(shown,0);\n      // BITUME : chaussée","      renderBatch(dynamicBatch,dynamicBuffer,false);\n      "+BANDS+"\n      // BITUME : chaussée",'ord-a');
  c=rep(c,"      renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(crowd)renderBatch(crowd,crowdBuffer,false);","      if(crowd)renderBatch(crowd,crowdBuffer,false);",'ord-b');
  return c;
};
// Compteur de surdessin dans cet ordre (arme comprise, dans sa tranche de profondeur).
P.overdraworder=c=>{
  c=rep(c,"    fragColor=vec4(color,1.);\n  }`;\n\n  // A separate translucent pass","    fragColor=vec4(1./255.,0.,0.,1.);\n  }`;\n\n  // A separate translucent pass",'odo-frag');
  c=rep(c,"gl.clearColor(.035,.06,.073,1);","gl.clearColor(0,0,0,1);",'odo-clear');
  c=rep(c,"if(environment)skyPass(axes,f,t);gl.useProgram(program);","gl.useProgram(program);",'odo-nosky');
  c=rep(c,"      renderStatic(shown,0);\n      // BITUME : chaussée","      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);\n      if(overlay.length){gl.depthRange(0,.1);renderBatch(pack(overlay,environment,true),overlayBuffer,true);}gl.depthRange(.1,1);\n      renderBatch(dynamicBatch,dynamicBuffer,false);\n      "+BANDS+"\n      // BITUME : chaussée",'odo-a');
  c=rep(c,"      renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(crowd)renderBatch(crowd,crowdBuffer,false);","      gl.disable(gl.BLEND);gl.depthRange(0,1);",'odo-b');
  c=rep(c,"      if(particles.length)renderEffects(particles,eye,t);","",'odo-nofx');
  c=rep(c,"      if(overlay.length||overlayParticles.length) {","      if(false) {",'odo-noov');
  return c;
};

// Arme d'abord + masque stencil : l'arme est dessinee en premier (profondeur pleine precision, comme apres le
// gl.clear actuel) et marque le stencil ; le monde et ses particules ne touchent pas ces pixels. Plus de
// gl.clear(DEPTH) en milieu de passe, profondeur du monde inchangee.
P.wstencil=c=>{
  const plain="selected.forEach(({light},i)=>{const c=light.color||[1,1,1],power=light.power===undefined?1:light.power;lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});gl.uniform3fv(uniforms.uLightColor,lightColors);";
  const dark="selected.forEach(({light},i)=>{const c=light.color||[1,1,1],power=(light.power===undefined?1:light.power)*(blackout.get(light)??1);lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});gl.uniform3fv(uniforms.uLightColor,lightColors);";
  c=rep(c,"gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,target.depth);","gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH24_STENCIL8,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,target.depth);",'ws-rb');
  c=rep(c,"      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(environment)skyPass(axes,f,t);","      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);if(environment)skyPass(axes,f,t);",'ws-clear');
  c=rep(c,"      renderStatic(shown,0);\n      // BITUME : chaussée",
    "      if(overlay.length){if(blackout){"+plain+"}gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.ALWAYS,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);renderBatch(pack(overlay,environment,true),overlayBuffer,true);if(blackout){"+dark+"}gl.stencilFunc(gl.NOTEQUAL,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);}\n      renderStatic(shown,0);\n      // BITUME : chaussée",'ws-a');
  c=rep(c,"        gl.clear(gl.DEPTH_BUFFER_BIT);if(overlay.length)renderBatch(pack(overlay,environment,true),overlayBuffer,true);\n        if(overlayParticles.length)renderEffects(overlayParticles,eye,t);\n      }",
    "        if(overlayParticles.length){if(overlay.length){gl.stencilFunc(gl.EQUAL,1,255);renderEffects(overlayParticles,eye,t);gl.stencilFunc(gl.NOTEQUAL,1,255);gl.disable(gl.DEPTH_TEST);renderEffects(overlayParticles,eye,t);gl.enable(gl.DEPTH_TEST);}else{gl.clear(gl.DEPTH_BUFFER_BIT);renderEffects(overlayParticles,eye,t);}}\n      }\n      gl.disable(gl.STENCIL_TEST);",'ws-b');
  c=rep(c,"        if(blackout){selected.forEach(({light},i)=>{const c=light.color||[1,1,1],power=light.power===undefined?1:light.power;lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});gl.uniform3fv(uniforms.uLightColor,lightColors);}\n","",'ws-c');
  return c;
};

// Ordre de dessin avec masque stencil (profondeur du monde inchangee) : arme, dynamiques, statiques en 4 bandes.
P.order2=c=>{
  c=P.wstencil(c);
  c=rep(c,"      renderStatic(shown,0);\n      // BITUME : chaussée","      renderBatch(dynamicBatch,dynamicBuffer,false);\n      "+BANDS+"\n      // BITUME : chaussée",'ord2-a');
  c=rep(c,"      renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(crowd)renderBatch(crowd,crowdBuffer,false);","      if(crowd)renderBatch(crowd,crowdBuffer,false);",'ord2-b');
  return c;
};
// Controle : statiques en 4 bandes seulement (ordre arme et dynamiques inchange).
P.bands=c=>rep(c,"      renderStatic(shown,0);\n      // BITUME : chaussée","      "+BANDS+"\n      // BITUME : chaussée",'bands');


// --- contre-verification ---
P.wsctx=c=>rep(P.wstencil(c),"{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'}","{alpha:false,antialias:false,depth:true,stencil:true,powerPreference:'high-performance'}",'wsctx');
P.sc10=c=>rep(P.suncull(c),"const R=e.radius+.6,","const R=e.radius+1.0,",'sc10');
P.sc30=c=>rep(P.suncull(c),"const R=e.radius+.6,","const R=e.radius+3.0,",'sc30');

P.sc300=c=>rep(P.suncull(c),"const R=e.radius+.6,","const R=e.radius+30.0,",'sc300');
// un seul groupe de plans a la fois
P.sceye=c=>{c=P.suncull(c);for(const s of ["        if(xa-za*__h>R*__sh&&xb-zb*__h>R*__sh)return false;\n","        if(-xa-za*__h>R*__sh&&-xb-zb*__h>R*__sh)return false;\n","        if(ya-za*__t>R*__sv&&yb-zb*__t>R*__sv)return false;\n","        if(-ya-za*__t>R*__sv&&-yb-zb*__t>R*__sv)return false;\n"])c=rep(c,s,"",'sceye');return c;};
P.scside=c=>{c=P.suncull(c);for(const s of ["        if(za<-R&&zb<-R)return false;\n","        if(ya-za*__t>R*__sv&&yb-zb*__t>R*__sv)return false;\n","        if(-ya-za*__t>R*__sv&&-yb-zb*__t>R*__sv)return false;\n"])c=rep(c,s,"",'scside');return c;};
P.scvert=c=>{c=P.suncull(c);for(const s of ["        if(za<-R&&zb<-R)return false;\n","        if(xa-za*__h>R*__sh&&xb-zb*__h>R*__sh)return false;\n","        if(-xa-za*__h>R*__sh&&-xb-zb*__h>R*__sh)return false;\n"])c=rep(c,s,"",'scvert');return c;};

// diagnostics du test lateral
P.sclong=c=>{c=P.suncull(c);c=rep(c,"const xa=ax*__R[0]+ay*__R[1]+az*__R[2],ya=ax*__U[0]+ay*__U[1]+az*__U[2],za=ax*__F[0]+ay*__F[1]+az*__F[2];","const cx=ax-fw[0]*200,cy=ay-fw[1]*200,cz=az-fw[2]*200;const xa=cx*__R[0]+cy*__R[1]+cz*__R[2],ya=cx*__U[0]+cy*__U[1]+cz*__U[2],za=cx*__F[0]+cy*__F[1]+cz*__F[2];",'sclong1');return rep(c,"L=Math.max(0,far-zc);","L=200;",'sclong2');};
P.scfar=c=>rep(P.suncull(c),"L=Math.max(0,far-zc);","L=200;",'scfar');
P.scback=c=>rep(P.suncull(c),"const xa=ax*__R[0]+ay*__R[1]+az*__R[2],ya=ax*__U[0]+ay*__U[1]+az*__U[2],za=ax*__F[0]+ay*__F[1]+az*__F[2];","const cx=ax-fw[0]*200,cy=ay-fw[1]*200,cz=az-fw[2]*200;const xa=cx*__R[0]+cy*__R[1]+cz*__R[2],ya=cx*__U[0]+cy*__U[1]+cz*__U[2],za=cx*__F[0]+cy*__F[1]+cz*__F[2];",'scback');
P.scrad2=c=>rep(P.suncull(c),"const R=e.radius+.6,","const R=e.radius*2+.6,",'scrad2');
P.scrad4=c=>rep(P.suncull(c),"const R=e.radius+.6,","const R=e.radius*4+.6,",'scrad4');

const SCF=".filter(e=>inside(e)&&reach(e));";
P.scsmall=c=>rep(P.suncull(c),SCF,".filter(e=>inside(e)&&(e.radius>=3||reach(e)));",'scsmall');
P.scbig=c=>rep(P.suncull(c),SCF,".filter(e=>inside(e)&&(e.radius<3||reach(e)));",'scbig');
P.scnofol=c=>rep(P.suncull(c),SCF,".filter(e=>inside(e)&&(e.mesh.shape==='foliage'||reach(e)));",'scnofol');
P.scfol=c=>rep(P.suncull(c),SCF,".filter(e=>inside(e)&&(e.mesh.shape!=='foliage'||reach(e)));",'scfol');
P.scnorot=c=>rep(P.suncull(c),SCF,".filter(e=>inside(e)&&((e.mesh.r&&(e.mesh.r[0]||e.mesh.r[1]||e.mesh.r[2]))||reach(e)));",'scnorot');

const SCA="const xa=ax*__R[0]+ay*__R[1]+az*__R[2],ya=ax*__U[0]+ay*__U[1]+az*__U[2],za=ax*__F[0]+ay*__F[1]+az*__F[2];";
const up=n=>c=>rep(P.suncull(c),SCA,"const cx=ax-fw[0]*"+n+",cy=ay-fw[1]*"+n+",cz=az-fw[2]*"+n+";const xa=cx*__R[0]+cy*__R[1]+cz*__R[2],ya=cx*__U[0]+cy*__U[1]+cz*__U[2],za=cx*__F[0]+cy*__F[1]+cz*__F[2];",'scup');
P.scup10=up(10);P.scup40=up(40);
P.scadd10=c=>rep(P.suncull(c),"const R=e.radius+.6,","const R=e.radius+10.0,",'scadd10');
// journal des gros projeteurs rejetes sur quelques images
P.sclog=c=>rep(P.suncull(c),SCF,".filter(e=>{if(!inside(e))return false;const k=reach(e);if(!k&&e.radius>=3){const L=(window.__SCLOG||(window.__SCLOG={}));const key=e.mesh.shape+'|'+e.p.map(v=>+v.toFixed(1))+'|'+(e.mesh.s||[]).map(v=>+v.toFixed(1))+'|'+(e.mesh.r||[]).map(v=>+v.toFixed(2))+'|m'+e.mesh.mat;L[key]=(L[key]||0)+1;}return k;});",'sclog');

P.ctxst=c=>rep(c,"{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'}","{alpha:false,antialias:false,depth:true,stencil:true,powerPreference:'high-performance'}",'ctxst');

// Ciel tardif : dessine apres les opaques, avant les particules, a la profondeur 1 exacte (depthRange(1,1)), test LEQUAL, sans ecriture.
P.skylate=c=>{
  c=rep(c,"if(environment)skyPass(axes,f,t);gl.useProgram(program);","gl.useProgram(program);",'sl-a');
  c=rep(c,"      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(skyProgram);","      gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(skyProgram);",'sl-b');
  c=rep(c,"      if(particles.length)renderEffects(particles,eye,t);","      if(environment){gl.depthRange(1,1);gl.depthMask(false);skyPass(axes,f,t);gl.depthMask(true);gl.depthRange(0,1);gl.useProgram(program);gl.bindVertexArray(vao);}\n      if(particles.length)renderEffects(particles,eye,t);",'sl-c');
  return c;
};

export function build(base,name){
  let c=base;
  for(const part of name.split('+')){if(!P[part])throw new Error('variante inconnue '+part);c=P[part](c);}
  return c;
}
export const names=Object.keys(P);
