// NATIF : variantes du renderer de FERRO v0.2 (248043a), appliquees EN MEMOIRE sur une copie locale.
// Chaque ancre doit exister exactement une fois (sinon la variante echoue : pas de patch silencieux).
export function rep(code, find, replace, label) {
  const n = code.split(find).length - 1;
  if (n !== 1) throw new Error(`patch ${label}: ancre trouvee ${n} fois: ${find.slice(0, 90)}`);
  return code.replace(find, () => replace);
}
const P = {};

// ---------- Mesures de cout par passe (image differente : ce ne sont pas des propositions) ----------
// Saut des rendus de profondeur apres la 1re image (l'atlas reste celui de la 1re image) : cout des passes d'ombre.
// fx.skipSh : 1 = lampes, 2 = soleil, 4 = torche.
P.shskip = c => {
  c = rep(c, '        if(!sunOnly)shadowLights.forEach((light,i)=>shadowPass(light,dynamicBatch,i,null,t));\n        if(environment)sunShadowPass(eye,axes,dynamicBatch,t,camera,fx,crowd);\n        if(!sunOnly)shadowPass({p:torchPosition},dynamicBatch,2,axes,t);',
    '        const __sk=(stats.__n=(stats.__n||0)+1)>1?(fx.skipSh||0):0;\n        if(!sunOnly&&!(__sk&1))shadowLights.forEach((light,i)=>shadowPass(light,dynamicBatch,i,null,t));\n        if(environment&&!(__sk&2))sunShadowPass(eye,axes,dynamicBatch,t,camera,fx,crowd);\n        if(!sunOnly&&!(__sk&4))shadowPass({p:torchPosition},dynamicBatch,2,axes,t);', 'shskip-calls');
  c = rep(c, 'gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.clear(gl.DEPTH_BUFFER_BIT);\n        const __sk', 'const __sk0=(stats.__n||0)>=1?(fx.skipSh||0):0;if(__sk0!==7){gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);if(!__sk0)gl.clear(gl.DEPTH_BUFFER_BIT);}\n        const __sk', 'shskip-clear');
  return c;
};
P.nosky = c => rep(c, 'gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(environment)skyPass(axes,f,t);gl.useProgram(program);', 'gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);', 'nosky');
P.l0 = c => rep(c, 'gl.uniform1i(uniforms.uLightCount,selected.length)', 'gl.uniform1i(uniforms.uLightCount,0)', 'l0');
// Ni particules ni arme (filtrage des listes) : cout des translucides et du calque d'arme.
P.nofx = c => rep(c, 'const ordinary=[],overlay=[],particles=[],overlayParticles=[];for(const mesh of dynamic||[]) (mesh.overlay?(mesh.fx?overlayParticles:overlay):mesh.fx?particles:ordinary).push(mesh);',
  'const ordinary=[],overlay=[],particles=[],overlayParticles=[];for(const mesh of dynamic||[]){if(mesh.fx&&fx.dropFx)continue;if(mesh.overlay&&fx.dropOverlay)continue;if(!mesh.fx&&!mesh.overlay&&fx.dropDyn)continue;(mesh.overlay?(mesh.fx?overlayParticles:overlay):mesh.fx?particles:ordinary).push(mesh);}', 'nofx');
// Composition seule : la chaine du bloom (passes 0 et 1) est sautee, la passe finale ne lit que la scene.
P.postcopy = c => {
  c = rep(c, '    if(uPass==0){\n      vec3 c=bright(', '    if(uPass==3){fragColor=vec4(texture(uScene,vUV).rgb,1.);return;}\n    if(uPass==0){\n      vec3 c=bright(', 'pc-shader');
  c = rep(c, "      gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.viewport(0,0,post.a.width,post.a.height);\n      gl.uniform1i(postUniforms.uPass,0);gl.uniform2f(postUniforms.uTexel,1/canvas.width,1/canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);\n      gl.bindFramebuffer(gl.FRAMEBUFFER,post.b.framebuffer);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);\n      gl.uniform1i(postUniforms.uPass,1);gl.uniform2f(postUniforms.uTexel,1/post.a.width,1/post.a.height);gl.drawArrays(gl.TRIANGLES,0,3);\n      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);\n      gl.uniform1i(postUniforms.uPass,2);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls+=3;",
    "      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);\n      gl.uniform1i(postUniforms.uPass,3);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls+=1;", 'pc-js');
  return c;
};
// Compteur de surdessin : chaque fragment opaque ayant passe le test de profondeur ajoute 1/255 (melange additif).
P.overdraw = c => {
  c = rep(c, '    fragColor=vec4(color,1.);\n  }`;\n\n  // A separate translucent pass', '    fragColor=vec4(color,1.);\n    fragColor=vec4(1./255.,vOverlay>.5?1./255.:0.,0.,1.);\n  }`;\n\n  // A separate translucent pass', 'od-shader');
  c = rep(c, 'gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(environment)skyPass(axes,f,t);gl.useProgram(program);', 'gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);', 'od-state');
  return c;
};

// ---------- Propositions sans perte (identite d'image a prouver par lecture des pixels) ----------
// A) Ciel dessine apres l'opaque, au plan lointain (depthRange(1,1)), sans ecriture de profondeur.
P.skylate = c => {
  c = rep(c, 'gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(skyProgram);',
    'gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.depthRange(1,1);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(skyProgram);', 'sky-state');
  c = rep(c, 'stats.drawCalls++;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);\n    }\n    function postPass',
    'stats.drawCalls++;gl.depthRange(0,1);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.useProgram(program);gl.bindVertexArray(vao);\n    }\n    function postPass', 'sky-restore');
  c = rep(c, 'gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(environment)skyPass(axes,f,t);gl.useProgram(program);', 'gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);', 'sky-move-a');
  c = rep(c, '      if(crowd)renderBatch(crowd,crowdBuffer,false);\n      if(particles.length)renderEffects(particles,eye,t);', '      if(crowd)renderBatch(crowd,crowdBuffer,false);\n      if(environment)skyPass(axes,f,t);\n      if(particles.length)renderEffects(particles,eye,t);', 'sky-move-b');
  return c;
};
// B) invalidateFramebuffer : profondeur de la scene jamais relue ; cibles du bloom et tampon final entierement recouverts.
P.inval = c => {
  c = rep(c, '      if(stats.bloom)postPass();\n    }\n    function lost', '      if(stats.bloom){if(!msaa)gl.invalidateFramebuffer(gl.FRAMEBUFFER,[gl.DEPTH_ATTACHMENT]);postPass();}\n    }\n    function lost', 'inv-depth');
  c = rep(c, "      gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.viewport(0,0,post.a.width,post.a.height);\n", "      gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.invalidateFramebuffer(gl.FRAMEBUFFER,[gl.COLOR_ATTACHMENT0]);gl.viewport(0,0,post.a.width,post.a.height);\n", 'inv-a');
  c = rep(c, "      gl.bindFramebuffer(gl.FRAMEBUFFER,post.b.framebuffer);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);\n", "      gl.bindFramebuffer(gl.FRAMEBUFFER,post.b.framebuffer);gl.invalidateFramebuffer(gl.FRAMEBUFFER,[gl.COLOR_ATTACHMENT0]);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);\n", 'inv-b');
  return c;
};
// B2) idem + tampon du canvas invalide avant la composition finale (il est entierement recouvert).
P.inval2 = c => rep(P.inval(c), "      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);\n", "      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.invalidateFramebuffer(gl.FRAMEBUFFER,[gl.COLOR,gl.DEPTH]);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);\n", 'inv-screen');
// C) Branches sur uniformes : eclair de bouche, onde, voile de degats (termes exactement nuls quand l'uniforme vaut 0).
P.ubranch = c => {
  c = rep(c, '    vec3 muzzleVector=uTorchPosition+uForward*.8-vWorld;', '    if(uEffects.y>0.){\n    vec3 muzzleVector=uTorchPosition+uForward*.8-vWorld;', 'ub-muzzle-open');
  c = rep(c, 'specular+=vec3(1.,.48,.12)*muzzlePower*metalHighlight(n,view,muzzleDirection,roughness,f0);', 'specular+=vec3(1.,.48,.12)*muzzlePower*metalHighlight(n,view,muzzleDirection,roughness,f0);}', 'ub-muzzle-close');
  c = rep(c, '    float hurt=uEffects.z*(1.-vignette*.65);\n    color=mix(color,vec3(.64,.035,.015),clamp(hurt*.68,0.,.6));\n    float waveRadius=(1.-clamp(uEffects.w,0.,1.))*.8;\n    float wave=exp(-abs(length((screen-.5)*vec2(uResolution.x/uResolution.y,1.))-waveRadius)*85.)*uEffects.w;\n    color+=vec3(.03,.27,.23)*wave;',
    '    if(uEffects.z>0.){float hurt=uEffects.z*(1.-vignette*.65);\n    color=mix(color,vec3(.64,.035,.015),clamp(hurt*.68,0.,.6));}\n    if(uEffects.w>0.){float waveRadius=(1.-clamp(uEffects.w,0.,1.))*.8;\n    float wave=exp(-abs(length((screen-.5)*vec2(uResolution.x/uResolution.y,1.))-waveRadius)*85.)*uEffects.w;\n    color+=vec3(.03,.27,.23)*wave;}', 'ub-screen');
  return c;
};
// D) Ombre echantillonnee seulement la ou la lumiere compte : derivees calculees hors branche (comme aujourd'hui),
//    seules les lectures de l'atlas sont conditionnelles. Termes exactement nuls sinon (N.L <= 0, hors du cone).
P.shgate = c => {
  c = rep(c, '  float shadow(vec3 n,vec3 l,int slot) {', '  float shadow(vec3 n,vec3 l,int slot,bool need) {', 'sg-sig');
  c = rep(c, '    if(projected.w<=0.||p.z<=0.||p.z>=1.||min(p.x,p.y)<=.001||max(p.x,p.y)>=.999)return 1.;', '    if(!need||projected.w<=0.||p.z<=0.||p.z>=1.||min(p.x,p.y)<=.001||max(p.x,p.y)>=.999)return 1.;', 'sg-early');
  c = rep(c, '      float visibility=i==0?shadow(geometricNormal,l,0):i==1&&uEnvironment.x<.5?shadow(geometricNormal,l,1):1.;', '      float visibility=i==0?shadow(geometricNormal,l,0,diffuse>0.):i==1&&uEnvironment.x<.5?shadow(geometricNormal,l,1,diffuse>0.):1.;', 'sg-lamp');
  c = rep(c, '    float sunlight=outdoors>.5?shadow(geometricNormal,uSunDirection,1):0.;\n    float leafBack=m>10.5&&m<11.5?max(dot(-n,uSunDirection),0.)*.24:0.;',
    '    float leafBack=m>10.5&&m<11.5?max(dot(-n,uSunDirection),0.)*.24:0.;\n    float sunlight=outdoors>.5?shadow(geometricNormal,uSunDirection,1,dot(n,uSunDirection)>0.||leafBack>0.):0.;', 'sg-sun');
  c = rep(c, '    float torch=cone/(1.+torchDistance*torchDistance*.045)*shadow(geometricNormal,torchDirection,2);', '    float torch=cone/(1.+torchDistance*torchDistance*.045)*shadow(geometricNormal,torchDirection,2,cone>0.&&dot(n,torchDirection)>0.);', 'sg-torch');
  return c;
};
// E) Programme d'ombre en profondeur seule : sommet reduit a la position (memes expressions que VERT).
P.depthvs = c => {
  c = rep(c, '  const DEPTH_FRAG=`#version 300 es', '  const DEPTH_VERT=`#version 300 es\n  precision highp float;\n  layout(location=0) in vec3 aPosition;\n  layout(location=2) in vec4 iPosition;\n  layout(location=3) in vec4 iScale;\n  layout(location=4) in vec4 iRotation;\n  uniform mat4 uViewProjection;\n  uniform vec2 uWindTime;\n  void main() {\n    vec3 c=cos(iRotation.xyz), s=sin(iRotation.xyz);\n    mat3 rx=mat3(1.,0.,0., 0.,c.x,s.x, 0.,-s.x,c.x);\n    mat3 ry=mat3(c.y,0.,-s.y, 0.,1.,0., s.y,0.,c.y);\n    mat3 rz=mat3(c.z,s.z,0., -s.z,c.z,0., 0.,0.,1.);\n    mat3 rotation=rz*ry*rx;\n    vec3 vWorld=rotation*(aPosition*iScale.xyz)+iPosition.xyz;\n    if(iPosition.w>10.5&&iPosition.w<11.5){\n      float phase=uWindTime.y*.85+iPosition.x*.37+iPosition.z*.21;\n      float bend=(aPosition.y+.5)*uWindTime.x*.055;\n      vWorld.x+=sin(phase)*bend;vWorld.z+=cos(phase*.73)*bend*.6;\n    }\n    gl_Position=uViewProjection*vec4(vWorld,1.);\n  }`;\n  const DEPTH_FRAG=`#version 300 es', 'dv-src');
  c = rep(c, 'depthProgram=link(VERT,DEPTH_FRAG)', 'depthProgram=link(DEPTH_VERT,DEPTH_FRAG)', 'dv-link');
  return c;
};
// F) Tri avant-arriere des statiques visibles (cle = distance - rayon).
P.f2b = c => rep(c, 'const shown=camera.allStatic?worldIndex.entries:worldIndex.query(eye,ranges).filter(e=>visible(e,eye,axes,canvas.width/canvas.height/f,1/f,ranges[0]));',
  'const shown=camera.allStatic?worldIndex.entries:worldIndex.query(eye,ranges).filter(e=>visible(e,eye,axes,canvas.width/canvas.height/f,1/f,ranges[0]));for(const e of shown)e.k=Math.sqrt((e.p[0]-eye[0])**2+(e.p[1]-eye[1])**2+(e.p[2]-eye[2])**2)-e.radius;shown.sort((a,b)=>a.k-b.k);', 'f2b');
// G) Pre-passe de profondeur (programme de profondeur existant, gl_Position invariant), puis couleur sans ecriture.
P.prepass = c => {
  c = rep(c, '  uniform mat4 uViewProjection;\n  uniform vec2 uWindTime;\n  out vec3 vWorld;', '  uniform mat4 uViewProjection;\n  uniform vec2 uWindTime;\n  invariant gl_Position;\n  out vec3 vWorld;', 'pp-invariant');
  c = rep(c, '      renderStatic(shown,0);\n      // BITUME : chaussée et terrain, puis décor par lots, découpés au champ et à la portée de chaque lot.\n      dessinerNappes(eye,axes,canvas.width/canvas.height/f,1/f,far);\n      stats.lotsVisibles=dessinerLots(eye,axes,canvas.width/canvas.height/f,1/f,far);\n      renderBatch(dynamicBatch,dynamicBuffer,false);',
    '      gl.useProgram(depthProgram);gl.uniformMatrix4fv(depthMatrix,false,vp);gl.uniform2f(depthWind,environment?environment.wind:0,t);gl.colorMask(false,false,false,false);\n      renderStatic(shown,0);renderBatch(dynamicBatch,dynamicBuffer,false);\n      gl.colorMask(true,true,true,true);gl.depthMask(false);gl.useProgram(program);\n      renderStatic(shown,0);\n      renderBatch(dynamicBatch,dynamicBuffer,false);gl.depthMask(true);', 'pp-draw');
  return c;
};
// H) Portee finie des lumieres : fenetre (1-(d/R)^4)^2, R tel que la contribution non fenetree a R soit < seuil.
//    lrange = fenetre seule (toutes les lumieres evaluees) ; lskip = meme image, lumieres hors de portee sautees.
const rangeJs = thr => c => {
  c = rep(c, 'selected.forEach(({light},i)=>{lightPositions.set(light.p,i*3);lightRanges[i]=light.range||0;const c=light.color||[1,1,1],power=(light.power===undefined?1:light.power)*(blackout?.get(light)??1);',
    `selected.forEach(({light},i)=>{const c0=light.color||[1,1,1];lightPositions.set(light.p,i*3);lightRanges[i]=light.range||-Math.sqrt(Math.max(1,((i<2?.27:.13)*Math.max(c0[0],c0[1],c0[2])*(light.power===undefined?1:light.power)/${thr}-1)/.26));const c=light.color||[1,1,1],power=(light.power===undefined?1:light.power)*(blackout?.get(light)??1);`, 'lr-js');
  return c;
};
const rangeShader = skip => c => rep(c, '      if(uLightRange[i]>0.)attenuation*=1.-smoothstep(uLightRange[i]*.35,uLightRange[i],d);',
  `      float R=uLightRange[i];\n      if(R>0.)attenuation*=1.-smoothstep(R*.35,R,d);\n      else if(R<0.){${skip ? 'if(i>0&&d>=-R)continue;' : ''}float q=min(d/-R,1.);q*=q;q*=q;attenuation*=(1.-q)*(1.-q);}`, 'lr-shader');
P.lrange = c => rangeShader(false)(rangeJs('.004')(c));
P.lskip = c => rangeShader(true)(rangeJs('.004')(c));
P.lrange1 = c => rangeShader(false)(rangeJs('.001')(c));
P.lskip1 = c => rangeShader(true)(rangeJs('.001')(c));
// I) Reflet GGX limite aux 4 premieres lumieres (RGPU-01, rappel pour la mesure a resolution native).
P.spec4 = c => rep(c, '      specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;', '      if(i<4)specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;', 'spec4');
// I2) GGX saute quand N.L <= 0 (metalHighlight multiplie par nl : terme exactement nul), soleil et torche compris.
P.ggxgate = c => {
  c = rep(c, '      specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;', '      if(diffuse>0.)specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;', 'gg-loop');
  c = rep(c, '    specular+=uSunColor*sunlight*metalHighlight(n,view,uSunDirection,roughness,f0);', '    if(sunlight>0.&&dot(n,uSunDirection)>0.)specular+=uSunColor*sunlight*metalHighlight(n,view,uSunDirection,roughness,f0);', 'gg-sun');
  c = rep(c, '    specular+=vec3(.44,.52,.56)*torch*metalHighlight(n,view,torchDirection,roughness,f0)*1.5;', '    if(torch>0.&&dot(n,torchDirection)>0.)specular+=vec3(.44,.52,.56)*torch*metalHighlight(n,view,torchDirection,roughness,f0)*1.5;', 'gg-torch');
  return c;
};
P.ggxgate4 = c => rep(P.ggxgate(c), '      if(diffuse>0.)specular+=uLightColor[i]', '      if(i<4&&diffuse>0.)specular+=uLightColor[i]', 'gg4');
// J) Contexte sans tampon de profondeur par defaut (la scene a sa propre cible quand le bloom est actif).
P.nodepthctx = c => rep(c, "canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'})", "canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,powerPreference:'high-performance'})", 'nodepth');
// K) Resolution native exacte : resize() prend la taille du tampon dans canvas.__native ([largeur, hauteur]) au lieu
//    de clientWidth * ratio. Sert a la politique « natif » (ResizeObserver + devicePixelContentBoxSize).
P.native = c => rep(c, "      const width=Math.max(1,Math.round(cssWidth*ratio)),height=Math.max(1,Math.round(cssHeight*ratio));\n      if(canvas.width!==width||canvas.height!==height) {canvas.width=width;canvas.height=height;}\n      stats.renderScale=autoScale;",
  "      let width=Math.max(1,Math.round(cssWidth*ratio)),height=Math.max(1,Math.round(cssHeight*ratio));\n      if(canvas.__native){width=canvas.__native[0];height=canvas.__native[1];ratio=width/cssWidth;}\n      if(canvas.width!==width||canvas.height!==height) {canvas.width=width;canvas.height=height;}\n      stats.renderScale=autoScale;", 'native');

const COMBOS = {
  base: [],
  lossless: ['skylate', 'inval', 'ubranch', 'shgate'],
  lossless2: ['skylate', 'inval', 'ubranch'],
  all: ['skylate', 'inval', 'ubranch', 'shgate', 'depthvs'],
  exact: ['skylate', 'inval', 'shgate', 'depthvs'],
  exactplus: ['skylate', 'inval', 'shgate', 'depthvs', 'ubranch', 'ggxgate'],
  visu1: ['skylate', 'inval', 'shgate', 'depthvs', 'ubranch', 'ggxgate', 'lskip1'],
  visu4: ['skylate', 'inval', 'shgate', 'depthvs', 'ubranch', 'ggxgate', 'lskip'],
  visu4s: ['skylate', 'inval', 'shgate', 'depthvs', 'ubranch', 'ggxgate4', 'lskip'],
  skyinval: ['skylate', 'inval'],
  f2bsky: ['f2b', 'skylate'],
  shskipnofx: ['shskip', 'nofx'],
  meas: ['shskip', 'nofx'],
  odf2b: ['overdraw', 'f2b'],
};
export function build(base, name) {
  const list = COMBOS[name] || name.split('+');
  let c = base;
  for (const n of list) { if (!P[n]) throw new Error('variante inconnue ' + n); c = P[n](c); }
  return c;
}
export const names = Object.keys(P);
