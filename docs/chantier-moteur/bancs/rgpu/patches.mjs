// RGPU : variantes du moteur de rendu, appliquées en mémoire sur une COPIE de src/renderer.js.
// Chaque remplacement vérifie que l'ancre existe exactement une fois (sinon la variante échoue).
export function rep(code, find, replace, label) {
  const n = code.split(find).length - 1;
  if (n !== 1) throw new Error(`patch ${label}: ancre trouvée ${n} fois: ${find.slice(0, 80)}`);
  return code.replace(find, () => replace);
}

// --- Propositions (sans changement visuel ou changement invisible) ---------------------------
// 1) Éclair de bouche : branche uniforme, rien n'est calculé quand uEffects.y == 0.
export function muzzle(c) {
  c = rep(c, '    vec3 muzzleVector=uTorchPosition+uForward*.8-vWorld;', '    if(uEffects.y>0.){\n    vec3 muzzleVector=uTorchPosition+uForward*.8-vWorld;', 'muzzle-open');
  c = rep(c, 'specular+=vec3(1.,.48,.12)*muzzlePower*metalHighlight(n,view,muzzleDirection,roughness,f0);', 'specular+=vec3(1.,.48,.12)*muzzlePower*metalHighlight(n,view,muzzleDirection,roughness,f0);}', 'muzzle-close');
  return c;
}
// 2) Ombres : dérivées analytiques (dFdx(vWorld) une fois, hors branche) puis branches EXACTES :
//    pas d'échantillonnage si N.L <= 0 (diffus et spéculaire nuls), ni hors du cône de la torche.
export function shbranch(c) {
  c = rep(c, '  float shadow(vec3 n,vec3 l,int slot) {', '  vec3 gWdx,gWdy;\n  float shadow(vec3 n,vec3 l,int slot) {', 'sh-globals');
  c = rep(c, '    vec3 p=projected.xyz/projected.w*.5+.5;\n    vec3 dx=dFdx(p),dy=dFdy(p);',
    '    vec3 ndc=projected.xyz/projected.w,p=ndc*.5+.5;\n    vec4 cdx=uShadowMatrix[slot]*vec4(gWdx,0.),cdy=uShadowMatrix[slot]*vec4(gWdy,0.);\n    vec3 dx=.5*(cdx.xyz-ndc*cdx.w)/projected.w,dy=.5*(cdy.xyz-ndc*cdy.w)/projected.w;', 'sh-analytic');
  c = rep(c, '  void main() {\n    vec3 geometricNormal=normalize(vNormal)', '  void main() {\n    gWdx=dFdx(vWorld);gWdy=dFdy(vWorld);\n    vec3 geometricNormal=normalize(vNormal)', 'sh-main');
  c = rep(c, '      float visibility=i==0?shadow(geometricNormal,l,0):i==1&&uEnvironment.x<.5?shadow(geometricNormal,l,1):1.;',
    '      float visibility=1.;\n      if(diffuse>0.){if(i==0)visibility=shadow(geometricNormal,l,0);else if(i==1&&uEnvironment.x<.5)visibility=shadow(geometricNormal,l,1);}', 'sh-lamp');
  c = rep(c, '    float sunlight=outdoors>.5?shadow(geometricNormal,uSunDirection,1):0.;\n    float leafBack=m>10.5&&m<11.5?max(dot(-n,uSunDirection),0.)*.24:0.;',
    '    float leafBack=m>10.5&&m<11.5?max(dot(-n,uSunDirection),0.)*.24:0.;\n    float sunlight=outdoors>.5&&(dot(n,uSunDirection)>0.||leafBack>0.)?shadow(geometricNormal,uSunDirection,1):0.;', 'sh-sun');
  c = rep(c, '    float torch=cone/(1.+torchDistance*torchDistance*.045)*shadow(geometricNormal,torchDirection,2);',
    '    float torch=cone>0.&&dot(n,torchDirection)>0.?cone/(1.+torchDistance*torchDistance*.045)*shadow(geometricNormal,torchDirection,2):0.;', 'sh-torch');
  return c;
}
// 3) Portée automatique des lumières du monde (aujourd'hui range=0 pour toutes) : fenêtre douce
//    (1-(d/R)^4)^2 et saut de la lumière au-delà de R. R est choisi pour une contribution < 0,004.
//    Nécessite shbranch (dérivées analytiques) pour que `continue` ne casse pas dFdx de l'ombre 0.
export function lightcull(c) {
  c = rep(c, '      if(uLightRange[i]>0.)attenuation*=1.-smoothstep(uLightRange[i]*.35,uLightRange[i],d);',
    '      float R=uLightRange[i];\n      if(R>0.){if(d>=R)continue;attenuation*=1.-smoothstep(R*.35,R,d);}\n      else if(R<0.){if(d>=-R)continue;float q=d/-R;q*=q;q*=q;attenuation*=(1.-q)*(1.-q);}', 'lc-shader');
  c = rep(c, 'lightRanges[i]=light.range||0;',
    'lightRanges[i]=light.range||-Math.sqrt(Math.max(1,((i<2?.27:.13)*Math.max(c0[0],c0[1],c0[2])*(light.power===undefined?1:light.power)/.004-1)/.26));', 'lc-js');
  c = rep(c, "selected.forEach(({light},i)=>{lightPositions.set(light.p,i*3);", "selected.forEach(({light},i)=>{const c0=light.color||[1,1,1];lightPositions.set(light.p,i*3);", 'lc-js2');
  return c;
}
// 4) Ciel dessiné APRÈS l'opaque, avec test de profondeur à z=1 : seuls les pixels de ciel le paient.
export function skylate(c) {
  c = rep(c, '  const SKY_FRAG=`', "  const SKY_VERT=POST_VERT.replace('gl_Position=vec4(p*2.-1.,0.,1.);','gl_Position=vec4(p*2.-1.,1.,1.);');\n  const SKY_FRAG=`", 'sky-vert');
  c = rep(c, 'skyProgram=link(POST_VERT,SKY_FRAG)', 'skyProgram=link(SKY_VERT,SKY_FRAG)', 'sky-link');
  c = rep(c, 'gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(skyProgram);',
    'gl.enable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(skyProgram);', 'sky-state');
  c = rep(c, 'stats.drawCalls++;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);\n    }\n    function postPass',
    'stats.drawCalls++;gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.useProgram(program);gl.bindVertexArray(vao);\n    }\n    function postPass', 'sky-restore');
  c = rep(c, 'if(environment)skyPass(axes,f,t);gl.useProgram(program);', 'gl.useProgram(program);', 'sky-move-a');
  c = rep(c, '      renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(particles.length)', '      renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(environment)skyPass(axes,f,t);\n      if(particles.length)', 'sky-move-b');
  return c;
}
// 5) Flou vertical du bloom au quart de résolution, composition finale à 2 lectures au lieu de 6.
export function bloomq(c) {
  c = rep(c, '  void main(){\n    if(uPass==0){', '  void main(){\n    if(uPass==3){fragColor=vec4(texture(uScene,vUV).rgb+texture(uBloom,vUV).rgb*.28,1.);return;}\n    if(uPass==0){', 'bq-shader');
  c = rep(c, 'if(uPass==2)c=texture(uScene,vUV).rgb+c*.28;', '', 'bq-shader2');
  c = rep(c, 'gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);\n      gl.uniform1i(postUniforms.uPass,2);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls+=3;',
    'gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);\n      gl.uniform1i(postUniforms.uPass,2);gl.drawArrays(gl.TRIANGLES,0,3);\n      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);\n      gl.uniform1i(postUniforms.uPass,3);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls+=4;', 'bq-js');
  return c;
}
// 6) PCF matériel (sampler2DShadow + filtrage LINEAR) : soleil 9 lectures -> 4 lectures filtrées.
export function hwpcf(c) {
  c = rep(c, 'uniform highp sampler2D uShadowMap;', 'uniform highp sampler2DShadow uShadowMap;', 'pcf-sampler');
  c = rep(c, '    vec2 centre=(floor(tap/texel)+.5)*texel;\n    return step(depth+dot(slope,(centre-uv)*2.),texture(uShadowMap,tap).r);',
    '    return texture(uShadowMap,vec3(tap,depth+dot(slope,(tap-uv)*2.)));', 'pcf-sample');
  const sunOld = `      visibility=depthSample(uv,vec2(0.),p.z-bias,slope)*4.;
      visibility+=(depthSample(uv,vec2(-1.25,0.),p.z-bias,slope)+depthSample(uv,vec2(1.25,0.),p.z-bias,slope)+depthSample(uv,vec2(0.,-1.25),p.z-bias,slope)+depthSample(uv,vec2(0.,1.25),p.z-bias,slope))*2.;
      visibility+=depthSample(uv,vec2(-1.25,-1.25),p.z-bias,slope)+depthSample(uv,vec2(1.25,-1.25),p.z-bias,slope)+depthSample(uv,vec2(-1.25,1.25),p.z-bias,slope)+depthSample(uv,vec2(1.25,1.25),p.z-bias,slope);
      visibility*=.0625;`;
  c = rep(c, sunOld, `      visibility=(depthSample(uv,vec2(-.75,-.75),p.z-bias,slope)+depthSample(uv,vec2(.75,-.75),p.z-bias,slope)+depthSample(uv,vec2(-.75,.75),p.z-bias,slope)+depthSample(uv,vec2(.75,.75),p.z-bias,slope))*.25;`, 'pcf-sun');
  c = rep(c, 'texture:texture(size*2,size*2,true),size};', 'texture:texture(size*2,size*2,true),size};gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);', 'pcf-tex');
  c = rep(c, 'whiteTexture=null', 'whiteTexture=null,whiteDepth=null', 'pcf-decl');
  c = rep(c, 'whiteTexture=texture(1,1);', 'whiteDepth=texture(1,1,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);whiteTexture=texture(1,1);', 'pcf-white');
  c = rep(c, 'gl.bindTexture(gl.TEXTURE_2D,stats.shadows?shadowTarget.texture:whiteTexture)', 'gl.bindTexture(gl.TEXTURE_2D,stats.shadows?shadowTarget.texture:whiteDepth)', 'pcf-bind');
  return c;
}
// 7) Tri avant-arrière des instances statiques visibles (clé = distance - rayon).
export function f2b(c) {
  return rep(c, 'const shown=candidates.filter(e=>visible(e,eye,axes,canvas.width/canvas.height/f,1/f,ranges[0]));',
    'const shown=candidates.filter(e=>visible(e,eye,axes,canvas.width/canvas.height/f,1/f,ranges[0]));for(const e of shown)e.k=Math.sqrt((e.p[0]-eye[0])**2+(e.p[1]-eye[1])**2+(e.p[2]-eye[2])**2)-e.radius;shown.sort((a,b)=>a.k-b.k);', 'f2b');
}
// 8) Pré-passe de profondeur (programme de profondeur existant) puis couleur avec depthMask(false).
export function prepass(c) {
  c = rep(c, 'out vec3 vWorld;', 'invariant gl_Position;\n  out vec3 vWorld;', 'pp-invariant');
  c = rep(c, '      renderStatic(shown,0);\n      renderBatch(dynamicBatch,dynamicBuffer,false);',
    '      gl.useProgram(depthProgram);gl.uniformMatrix4fv(depthMatrix,false,vp);gl.uniform2f(depthWind,environment?environment.wind:0,t);gl.colorMask(false,false,false,false);\n      renderStatic(shown,0);renderBatch(dynamicBatch,dynamicBuffer,false);\n      gl.colorMask(true,true,true,true);gl.depthMask(false);gl.useProgram(program);\n      renderStatic(shown,0);\n      renderBatch(dynamicBatch,dynamicBuffer,false);gl.depthMask(true);', 'pp-draw');
  return c;
}
// --- Mesures seulement (pas des propositions) -------------------------------------------------
export function nomat(c) { return rep(c, '  float noise(vec2 p) {', '  float noise(vec2 p){return .5;}\n  float noiseUnused(vec2 p) {', 'nomat'); }
export function l6(c) { return rep(c, "(quality==='low'?6:12)", '6', 'l6'); }
export function l0(c) { return rep(c, 'gl.uniform1i(uniforms.uLightCount,selected.length)', 'gl.uniform1i(uniforms.uLightCount,0)', 'l0'); }
export function nosky(c) { return rep(c, 'if(environment)skyPass(axes,f,t);gl.useProgram(program);', 'gl.useProgram(program);', 'nosky'); }
// Compteur de fragments : chaque fragment opaque qui passe le test de profondeur ajoute 1/255.
export function overdraw(c) {
  c = rep(c, 'fragColor=vec4(color,1.);', 'fragColor=vec4(1./255.,0.,0.,1.);', 'od-frag');
  c = rep(c, 'gl.clearColor(.035,.06,.073,1);', 'gl.clearColor(0,0,0,1);', 'od-clear');
  c = rep(c, 'if(environment)skyPass(axes,f,t);gl.useProgram(program);', 'gl.useProgram(program);', 'od-nosky');
  c = rep(c, '      renderStatic(shown,0);\n      renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(particles.length)renderEffects(particles,eye,t);',
    '      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);renderStatic(shown,0);\n      renderBatch(dynamicBatch,dynamicBuffer,false);gl.disable(gl.BLEND);', 'od-blend');
  c = rep(c, 'if(overlay.length||overlayParticles.length) {', 'if(false) {', 'od-nooverlay');
  return c;
}

// 3b) Portée automatique sans toucher la lumière ombrée i==0 (pas besoin de dérivées analytiques).
export function lightcull2(c) {
  c = rep(c, '      if(uLightRange[i]>0.)attenuation*=1.-smoothstep(uLightRange[i]*.35,uLightRange[i],d);',
    '      float R=uLightRange[i];\n      if(R>0.){if(i>0&&d>=R)continue;attenuation*=1.-smoothstep(R*.35,R,d);}\n      else if(R<0.){if(i>0&&d>=-R)continue;float q=min(d/-R,1.);q*=q;q*=q;attenuation*=(1.-q)*(1.-q);}', 'lc2-shader');
  c = rep(c, 'lightRanges[i]=light.range||0;',
    'lightRanges[i]=light.range||-Math.sqrt(Math.max(1,((i<2?.27:.13)*Math.max(c0[0],c0[1],c0[2])*(light.power===undefined?1:light.power)/.004-1)/.26));', 'lc2-js');
  c = rep(c, "selected.forEach(({light},i)=>{lightPositions.set(light.p,i*3);", "selected.forEach(({light},i)=>{const c0=light.color||[1,1,1];lightPositions.set(light.p,i*3);", 'lc2-js2');
  return c;
}
// 9) Reflet spéculaire GGX limité aux 4 premières lumières (ombrée + transitoires + plus proches).
export function spec4(c) {
  return rep(c, '      specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;', '      if(i<4)specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;', 'spec4');
}
// 10) Soleil : 9 lectures -> 4 lectures manuelles (sans PCF matériel), pour isoler le coût des taps.
export function sun4(c) {
  const sunOld = `      visibility=depthSample(uv,vec2(0.),p.z-bias,slope)*4.;
      visibility+=(depthSample(uv,vec2(-1.25,0.),p.z-bias,slope)+depthSample(uv,vec2(1.25,0.),p.z-bias,slope)+depthSample(uv,vec2(0.,-1.25),p.z-bias,slope)+depthSample(uv,vec2(0.,1.25),p.z-bias,slope))*2.;
      visibility+=depthSample(uv,vec2(-1.25,-1.25),p.z-bias,slope)+depthSample(uv,vec2(1.25,-1.25),p.z-bias,slope)+depthSample(uv,vec2(-1.25,1.25),p.z-bias,slope)+depthSample(uv,vec2(1.25,1.25),p.z-bias,slope);
      visibility*=.0625;`;
  return rep(c, sunOld, `      visibility=(depthSample(uv,vec2(-.75,-.75),p.z-bias,slope)+depthSample(uv,vec2(.75,-.75),p.z-bias,slope)+depthSample(uv,vec2(-.75,.75),p.z-bias,slope)+depthSample(uv,vec2(.75,.75),p.z-bias,slope))*.25;`, 'sun4');
}
// Mesure : nombre de lumières (parmi les 12 retenues) à moins de 8 m / 16 m / contribution > 0,004.
export function lcount(c) {
  c = rep(c, 'fragColor=vec4(color,1.);', `float n8=0.,n16=0.,nc=0.;
    for(int j=0;j<12;j++){if(j>=uLightCount)break;vec3 tl=uLightPosition[j]-vWorld;float dd=length(tl);float aa=(j<2?.27:.13)/(1.+dd*dd*.26);float mc=max(uLightColor[j].r,max(uLightColor[j].g,uLightColor[j].b));n8+=step(dd,8.);n16+=step(dd,16.);nc+=step(.004,aa*mc);}
    fragColor=vec4(n8/255.,(n16+1.)/255.,nc/255.,1.);`, 'lcount-frag');
  c = rep(c, 'gl.clearColor(.035,.06,.073,1);', 'gl.clearColor(0,0,0,1);', 'lcount-clear');
  c = rep(c, 'if(environment)skyPass(axes,f,t);gl.useProgram(program);', 'gl.useProgram(program);', 'lcount-nosky');
  c = rep(c, '      if(particles.length)renderEffects(particles,eye,t);', '', 'lcount-nofx');
  c = rep(c, 'if(overlay.length||overlayParticles.length) {', 'if(false) {', 'lcount-nooverlay');
  return c;
}

const SHADOW_CALLS='shadowLights.forEach((light,i)=>shadowPass(light,dynamicBatch,i,null,t));if(environment)sunShadowPass(eye,axes,dynamicBatch,t);shadowPass({p:torchPosition},dynamicBatch,2,axes,t);';
const SHADOW_SETTINGS='gl.uniform4f(uniforms.uShadowSettings,stats.shadows?shadowLights.length:0,shadowTarget?1/(shadowTarget.size*2):1,stats.shadows?1:0,stats.shadows&&environment?1:0);';
// Mesures/propositions sur les passes d'ombre.
export function notorch(c) {
  c = rep(c, SHADOW_CALLS, 'shadowLights.forEach((light,i)=>shadowPass(light,dynamicBatch,i,null,t));if(environment)sunShadowPass(eye,axes,dynamicBatch,t);', 'notorch-pass');
  return rep(c, SHADOW_SETTINGS, 'gl.uniform4f(uniforms.uShadowSettings,stats.shadows?shadowLights.length:0,shadowTarget?1/(shadowTarget.size*2):1,0,stats.shadows&&environment?1:0);', 'notorch-uniform');
}
export function nolamp(c) {
  c = rep(c, SHADOW_CALLS, 'if(environment)sunShadowPass(eye,axes,dynamicBatch,t);shadowPass({p:torchPosition},dynamicBatch,2,axes,t);', 'nolamp-pass');
  return rep(c, SHADOW_SETTINGS, 'gl.uniform4f(uniforms.uShadowSettings,0,shadowTarget?1/(shadowTarget.size*2):1,stats.shadows?1:0,stats.shadows&&environment?1:0);', 'nolamp-uniform');
}
export function nosun(c) {
  c = rep(c, SHADOW_CALLS, 'shadowLights.forEach((light,i)=>shadowPass(light,dynamicBatch,i,null,t));shadowPass({p:torchPosition},dynamicBatch,2,axes,t);', 'nosun-pass');
  return rep(c, SHADOW_SETTINGS, 'gl.uniform4f(uniforms.uShadowSettings,stats.shadows?shadowLights.length:0,shadowTarget?1/(shadowTarget.size*2):1,stats.shadows?1:0,0);', 'nosun-uniform');
}
// Lot dynamique dédié aux ombres : seulement les pièces opaques assez grandes (comme shadowCaster statique).
export function dynsh(c) {
  c = rep(c, 'lampCasters=[],actorLightPlan=null', 'lampCasters=[],actorLightPlan=null,shadowDynBuffer=null', 'dynsh-decl');
  c = rep(c, SHADOW_CALLS, 'if(!shadowDynBuffer)shadowDynBuffer=gl.createBuffer();const casterBatch=pack(ordinary.filter(m=>{const s=m.s||[1,1,1],mat=m.mat||0;return Math.max(s[0],s[1],s[2])>=.3&&(mat<4||mat>7)&&m.shape!=="ring";}),environment,true);gl.bindBuffer(gl.ARRAY_BUFFER,shadowDynBuffer);gl.bufferData(gl.ARRAY_BUFFER,casterBatch.values,gl.DYNAMIC_DRAW);stats.uploadBytes+=casterBatch.values.byteLength;stats.shadowDynamic=casterBatch.values.length/16;'
    + 'shadowLights.forEach((light,i)=>shadowPass(light,casterBatch,i,null,t));if(environment)sunShadowPass(eye,axes,casterBatch,t);shadowPass({p:torchPosition},casterBatch,2,axes,t);', 'dynsh-calls');
  c = rep(c, 'renderStatic(casters,slot+1,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);', 'renderStatic(casters,slot+1,true);renderBatch(dynamicBatch,shadowDynBuffer,false,true);', 'dynsh-lamp');
  c = rep(c, 'renderStatic(casters,2,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);', 'renderStatic(casters,2,true);renderBatch(dynamicBatch,shadowDynBuffer,false,true);', 'dynsh-sun');
  return c;
}

export function notorchAny(c) {
  c = rep(c, 'shadowPass({p:torchPosition},casterBatch,2,axes,t);', '', 'notorch2-pass');
  return rep(c, SHADOW_SETTINGS, 'gl.uniform4f(uniforms.uShadowSettings,stats.shadows?shadowLights.length:0,shadowTarget?1/(shadowTarget.size*2):1,0,stats.shadows&&environment?1:0);', 'notorch2-uniform');
}

// CPU (résultat identique) : clés numériques de l'index spatial, filtre soleil sans allocation.
export function cpuopt(c) {
  c = rep(c, "key=Math.floor(e.p[0]/8)+','+Math.floor(e.p[2]/8),map=levels[e.detail];", "key=(Math.floor(e.p[0]/8)+32768)*65536+Math.floor(e.p[2]/8)+32768,map=levels[e.detail];", 'cpu-key1');
  c = rep(c, "const bucket=levels[level].get(x+','+z);if(!bucket)continue;", "const bucket=levels[level].get((x+32768)*65536+z+32768);if(!bucket)continue;", 'cpu-key2');
  c = rep(c, `        const d=e.p.map((v,k)=>v-p[k]),along=a=>d[0]*a[0]+d[1]*a[1]+d[2]*a[2],z=along(fw);
        return Math.abs(along(r))<extent+e.radius&&Math.abs(along(u))<extent+e.radius&&z+e.radius>near&&z-e.radius<far;`,
    `        const dx=e.p[0]-p[0],dy=e.p[1]-p[1],dz=e.p[2]-p[2],z=dx*fw[0]+dy*fw[1]+dz*fw[2];
        return Math.abs(dx*r[0]+dy*r[1]+dz*r[2])<extent+e.radius&&Math.abs(dx*u[0]+dy*u[1]+dz*u[2])<extent+e.radius&&z+e.radius>near&&z-e.radius<far;`, 'cpu-sunfilter');
  return c;
}
// CPU (changement contrôlé) : liste des projeteurs du soleil réutilisée tant que le centre a bougé de
// moins de 2 m (requête élargie de 2 m) -> plus de requête/filtre/pack/upload la plupart des images.
export function suncache(c) {
  c = rep(c, 'lampCasters=[],actorLightPlan=null', 'lampCasters=[],actorLightPlan=null,sunPlan=null', 'sc-decl');
  c = rep(c, `      const casters=worldIndex.query(center,[extent+24,26,0]).filter(e=>{`,
    `      const reuse=sunPlan&&sunPlan.index===worldIndex&&Math.hypot(center[0]-sunPlan.c[0],center[1]-sunPlan.c[1],center[2]-sunPlan.c[2])<2;
      const casters=reuse?sunPlan.casters:worldIndex.query(center,[extent+26,28,0]).filter(e=>{`, 'sc-query');
  c = rep(c, `        return Math.abs(dx*r[0]+dy*r[1]+dz*r[2])<extent+e.radius&&Math.abs(dx*u[0]+dy*u[1]+dz*u[2])<extent+e.radius&&z+e.radius>near&&z-e.radius<far;
      });`, `        return Math.abs(dx*r[0]+dy*r[1]+dz*r[2])<extent+2+e.radius&&Math.abs(dx*u[0]+dy*u[1]+dz*u[2])<extent+2+e.radius&&z+e.radius>near-2&&z-e.radius<far+2;
      });
      if(!reuse)sunPlan={index:worldIndex,c:center.slice(),casters};`, 'sc-store');
  return c;
}

// Qualité : MSAA 4x sur la cible de scène (renderbuffers multi-échantillons) puis résolution par blit.
export function msaa4(c) {
  c = rep(c, 'if(scene&&a&&b)post={scene,a,b};else{deleteTarget(scene);deleteTarget(a);deleteTarget(b);}',
    'if(scene&&a&&b)post={scene,a,b};else{deleteTarget(scene);deleteTarget(a);deleteTarget(b);}\n      if(post){const fb=gl.createFramebuffer(),mc=gl.createRenderbuffer(),md=gl.createRenderbuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.bindRenderbuffer(gl.RENDERBUFFER,mc);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,4,gl.RGBA8,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,mc);gl.bindRenderbuffer(gl.RENDERBUFFER,md);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,4,gl.DEPTH_COMPONENT24,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,md);post.msaa={framebuffer:fb,mc,md};}', 'msaa-alloc');
  c = rep(c, 'gl.bindFramebuffer(gl.FRAMEBUFFER,stats.bloom?post.scene.framebuffer:null);', 'gl.bindFramebuffer(gl.FRAMEBUFFER,stats.bloom?post.msaa.framebuffer:null);', 'msaa-bind');
  c = rep(c, '      if(stats.bloom)postPass();', '      if(stats.bloom){gl.bindFramebuffer(gl.READ_FRAMEBUFFER,post.msaa.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,post.scene.framebuffer);gl.blitFramebuffer(0,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);postPass();}', 'msaa-resolve');
  return c;
}

// Portée fixe R (m) pour les lumières du monde sans portée, même fenêtre que lightcull2.
function fixedRange(R){return function(c){
  c = rep(c, '      if(uLightRange[i]>0.)attenuation*=1.-smoothstep(uLightRange[i]*.35,uLightRange[i],d);',
    '      float R=uLightRange[i];\n      if(R>0.){if(i>0&&d>=R)continue;attenuation*=1.-smoothstep(R*.35,R,d);}\n      else if(R<0.){if(i>0&&d>=-R)continue;float q=min(d/-R,1.);q*=q;q*=q;attenuation*=(1.-q)*(1.-q);}', 'fr-shader');
  return rep(c, 'lightRanges[i]=light.range||0;', 'lightRanges[i]=light.range||-'+R+';', 'fr-js');
};}
export const lcR16=fixedRange(16), lcR24=fixedRange(24);

// 9b) Deux boucles à bornes constantes : 0..3 complète (ombre + GGX), 4..11 diffus seul (pas de GGX).
//     Fenêtre de portée (1-(d/R)^4)^2 sans `continue` (pas de divergence, déroulage possible).
const LOOP_OLD = `    for(int i=0;i<12;i++) {
      if(i>=uLightCount) break;
      vec3 toLight=uLightPosition[i]-vWorld;
      float d=length(toLight);
      vec3 l=toLight/max(d,.001);
      float attenuation=(i<2?.27:.13)/(1.+d*d*.26);
      if(uLightRange[i]>0.)attenuation*=1.-smoothstep(uLightRange[i]*.35,uLightRange[i],d);
      float diffuse=max(dot(n,l),0.);
      float visibility=i==0?shadow(geometricNormal,l,0):i==1&&uEnvironment.x<.5?shadow(geometricNormal,l,1):1.;
      light+=uLightColor[i]*attenuation*(diffuse*visibility+.035);
      specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;
    }`;
const LOOP_NEW = `    for(int i=0;i<4;i++) {
      if(i>=uLightCount) break;
      vec3 toLight=uLightPosition[i]-vWorld;
      float d=length(toLight);
      vec3 l=toLight/max(d,.001);
      float attenuation=(i<2?.27:.13)/(1.+d*d*.26);
      float R=uLightRange[i];
      if(R>0.)attenuation*=1.-smoothstep(R*.35,R,d);
      else if(R<0.){float q=min(d*d/(R*R),1.);q*=q;attenuation*=(1.-q)*(1.-q);}
      float diffuse=max(dot(n,l),0.);
      float visibility=i==0?shadow(geometricNormal,l,0):i==1&&uEnvironment.x<.5?shadow(geometricNormal,l,1):1.;
      light+=uLightColor[i]*attenuation*(diffuse*visibility+.035);
      specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;
    }
    for(int i=4;i<12;i++) {
      if(i>=uLightCount) break;
      vec3 toLight=uLightPosition[i]-vWorld;
      float d2=dot(toLight,toLight);
      float attenuation=.13/(1.+d2*.26);
      float R=uLightRange[i];
      if(R>0.)attenuation*=1.-smoothstep(R*.35,R,sqrt(d2));
      else if(R<0.){float q=min(d2/(R*R),1.);q*=q;attenuation*=(1.-q)*(1.-q);}
      float diffuse=max(dot(n,toLight),0.)*inversesqrt(max(d2,.000001));
      light+=uLightColor[i]*attenuation*(diffuse+.035);
    }`;
export function split(c) { return rep(c, LOOP_OLD, LOOP_NEW, 'split-loop'); }
export function autoRange(c) {
  c = rep(c, 'lightRanges[i]=light.range||0;',
    'lightRanges[i]=light.range||-Math.sqrt(Math.max(1,((i<2?.27:.13)*Math.max(c0[0],c0[1],c0[2])*(light.power===undefined?1:light.power)/.004-1)/.26));', 'ar-js');
  return rep(c, "selected.forEach(({light},i)=>{lightPositions.set(light.p,i*3);", "selected.forEach(({light},i)=>{const c0=light.color||[1,1,1];lightPositions.set(light.p,i*3);", 'ar-js2');
}

// Budget de pixels aussi en qualité haute : 3,3 MPix au plus (au lieu du DPR natif plafonné à 2).
export function hicap(c) {
  return rep(c, "if(quality==='auto')ratio=Math.min(ratio,Math.sqrt(1800000/(cssWidth*cssHeight)))*autoScale;",
    "if(quality==='auto')ratio=Math.min(ratio,Math.sqrt(1800000/(cssWidth*cssHeight)))*autoScale;else if(quality==='high')ratio=Math.min(ratio,Math.sqrt(3300000/(cssWidth*cssHeight)));", 'hicap');
}

// Mesure : bruit des particules remplacé par une constante (part ALU vs remplissage/mélange).
export function fxnoise0(c) { return rep(c, '  float noise(vec3 p){\n    return .5+', '  float noise(vec3 p){return .5;}\n  float noiseUnusedFx(vec3 p){\n    return .5+', 'fxnoise0'); }

// Projeteurs dynamiques en tête de chaque groupe de forme : un seul pack, un seul envoi ; les passes
// d'ombre dessinent seulement le préfixe « projeteurs » (mêmes critères que dynsh).
export function dynsh2(c) {
  c = rep(c, `    const count=grouped.reduce((n,g)=>n+g.length,0),values=new Float32Array(count*16),groups=[];
    let offset=0;
    for(let i=0;i<names.length;i++) {
      const list=grouped[i];
      if(list.length) groups.push({name:names[i],offset:offset*4,count:list.length});`,
`    const count=grouped.reduce((n,g)=>n+g.length,0),values=new Float32Array(count*16),groups=[],shadowGroups=[];
    let offset=0;
    for(let i=0;i<names.length;i++) {
      let list=grouped[i],nc=0;
      if(objects&&list.length){const a=[],b=[];for(const m of list){const s=m.s||[1,1,1],mat=m.mat||0;(Math.max(s[0],s[1],s[2])>=.3&&(mat<4||mat>7)&&m.shape!=="ring"?a:b).push(m);}nc=a.length;list=a.length?a.concat(b):b;}
      if(list.length) groups.push({name:names[i],offset:offset*4,count:list.length});
      if(nc) shadowGroups.push({name:names[i],offset:offset*4,count:nc});`, 'dynsh2-pack');
  c = rep(c, `        offset+=16;
      }
    }
    return {values,groups};
  }`, `        offset+=16;
      }
    }
    return {values,groups,shadowGroups};
  }`, 'dynsh2-ret');
  c = rep(c, 'renderStatic(casters,slot+1,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);', 'renderStatic(casters,slot+1,true);renderBatch({groups:dynamicBatch.shadowGroups||dynamicBatch.groups},dynamicBuffer,false,true);', 'dynsh2-lamp');
  c = rep(c, 'renderStatic(casters,2,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);', 'renderStatic(casters,2,true);renderBatch({groups:dynamicBatch.shadowGroups||dynamicBatch.groups},dynamicBuffer,false,true);', 'dynsh2-sun');
  return c;
}
// Bruit de valeur des matériaux : 4 hash ALU -> 1 lecture bilinéaire d'une texture R8 256x256 générée
// par code à l'initialisation (même hash sur le réseau entier, période 256 cellules).
export function noisetex(c) {
  c = rep(c, `  float noise(vec2 p) {
    vec2 a=floor(p), b=fract(p); b=b*b*(3.-2.*b);
    return mix(mix(hash(a),hash(a+vec2(1,0)),b.x),
      mix(hash(a+vec2(0,1)),hash(a+vec2(1,1)),b.x),b.y);
  }`, `  uniform sampler2D uNoise;
  float noise(vec2 p) {
    vec2 a=floor(p), b=fract(p); b=b*b*(3.-2.*b);
    return texture(uNoise,(a+b+.5)*.00390625).r;
  }`, 'nt-glsl');
  c = rep(c, 'whiteTexture=null', 'whiteTexture=null,noiseTexture=null,noiseLocation=null', 'nt-decl');
  c = rep(c, 'whiteTexture=texture(1,1);', `{const fr=x=>x-Math.floor(x),nd=new Uint8Array(65536);for(let j=0;j<256;j++)for(let i=0;i<256;i++){let x=fr(i*.1031),y=fr(j*.1031),z=fr(i*.1031);const d=x*(y+33.33)+y*(z+33.33)+z*(x+33.33);x+=d;y+=d;z+=d;nd[j*256+i]=Math.round(fr((x+y)*z)*255);}
      noiseTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,noiseTexture);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,256,256,0,gl.RED,gl.UNSIGNED_BYTE,nd);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);noiseLocation=gl.getUniformLocation(program,'uNoise');}
      whiteTexture=texture(1,1);`, 'nt-init');
  c = rep(c, 'gl.uniform1i(uniforms.uShadowMap,2);', 'gl.uniform1i(uniforms.uShadowMap,2);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,noiseTexture);gl.uniform1i(noiseLocation,3);gl.activeTexture(gl.TEXTURE2);', 'nt-bind');
  return c;
}
export const VARIANTS = {
  base: [], muzzle: [muzzle], shbranch: [shbranch], lightcull: [shbranch, lightcull], skylate: [skylate], bloomq: [bloomq], hwpcf: [hwpcf],
  f2b: [f2b], prepass: [prepass], nomat: [nomat], l6: [l6], l0: [l0], nosky: [nosky],
  combo: [muzzle, shbranch, lightcull, skylate, bloomq, hwpcf],
  overdraw: [overdraw], overdrawf2b: [overdraw, f2b], lightcull2: [lightcull2], spec4: [spec4], sun4: [sun4], lcount: [lcount],
  combo2: [muzzle, lightcull2, spec4, hwpcf, bloomq, skylate], notorch: [notorch], nolamp: [nolamp], nosun: [nosun], dynsh: [dynsh],
  combo3: [muzzle, lightcull2, spec4, dynsh, notorchAny], cpuopt: [cpuopt], suncache: [cpuopt, suncache], msaa4: [msaa4], lcR16: [lcR16], lcR24: [lcR24], spec4R16: [spec4, lcR16],
  combo4: [cpuopt, suncache, muzzle, lightcull2, spec4, dynsh, notorchAny, hwpcf, skylate, bloomq],
  split: [split], splitW: [split, autoRange], combo5: [cpuopt, suncache, muzzle, split, autoRange, dynsh, notorchAny, hwpcf, skylate, bloomq],
  combo5n: [cpuopt, suncache, muzzle, split, dynsh, notorchAny, hwpcf, skylate],
  fxnoise0: [fxnoise0], dynsh2: [dynsh2], noisetex: [noisetex],
  combo7: [cpuopt, suncache, muzzle, spec4, dynsh2, notorch, hwpcf, skylate], combo8: [cpuopt, suncache, muzzle, spec4, dynsh2, notorch, hwpcf, skylate, noisetex],
  combo6: [cpuopt, suncache, muzzle, spec4, dynsh, notorchAny, hwpcf, skylate], hicap: [hicap], hicap6: [cpuopt, suncache, muzzle, spec4, dynsh, notorchAny, hwpcf, skylate, hicap],
};
export function build(base, name) {
  let c = base;
  for (const p of VARIANTS[name]) c = p(c);
  return c;
}
