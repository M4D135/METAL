// Schema du paquet d'etat de rendu, tire du recensement (census.mjs) : champs lus par la page, par racine.
// Prefixe '$' = chaine (envoyee comme indice de dictionnaire), sinon nombre/booleen (Float32).
export const LISTS={
  enemies:['type','deployed','id','hp','x','z','baseY','$attackState','moveSpeed','windup','windupMax','awareness','stun','yaw','airborne','hurt','bossScale','$tactic','goalX','goalZ','bossAwake','active'],
  debris:['x','y','z','rotation.0','rotation.1','rotation.2','size.0','size.1','size.2','color.0','color.1','color.2','sourceId','$shape','structural','age','life','seed','mat','id','$material','resting'],
  pickups:['x','y','z','$kind','taken','weapon','requiresWeapon','displayOnly','rewardTaken'],
  loot:['x','y','z','$kind','taken','weapon','requiresWeapon','displayOnly','rewardTaken'],
  particles:['x','y','z','life','kind'],
  bullets:['x','y','z'],
  projectiles:['x','y','z','vx','vy','vz','$kind','age','id'],
  explosions:['x','y','z','age','life','radius','seed','id','power'],
  bossAttacks:['x','y','z','$kind','age','life','radius','warning','angle','id'],
  pipes:['x','y','z','hot','broken','active','nozzle.0','nozzle.1','nozzle.2','destructibleId','dx','dy','dz','length','radius','id','warning'],
  traps:['$kind','destroyed','warning','box.minX','box.minY','box.minZ','box.maxX','box.maxY','box.maxZ','hot','angle'],
  lifts:['x','z','y','$axis','w','d','minY','maxY','lowerCall.x','lowerCall.y','lowerCall.z','upperCall.x','upperCall.y','upperCall.z','moving','powered'],
  doors:['x','z','w','d','h','y','progress','destroyed','open'],
  mechanisms:['x','z','y','baseY','active','id','$kind','destroyed','required'],
  cores:['x','y','z','taken','id'],
  encounters:['$status','wave','pendingWave'],
};
export const SCALARS=['player.x','player.y','player.z','player.yaw','player.pitch','player.hp','player.heat','player.overheated','player.airborne','player.pulseCooldown',
  'locomotion.stridePhase','locomotion.dashBlend','locomotion.speed','locomotion.sprintBlend','locomotion.strafe','locomotion.forward','locomotion.accelForward','locomotion.moveBlend',
  'time','weapon','damage','flash','leftFlash','hitMarker','pulseVisual','threat','moving','destructionRevision','relays','kills','score','combo','maxHp','director.pressure',
  'shield.energy','shield.raised','shield.bashVisual','shield.bashCooldown','armor.points','armor.capacity','equipment.left','economy.credits','economy.cores','dead','won','bossAlive'];
const acc=(root,path)=>path.split('.').reduce((s,k)=>s+'?.['+JSON.stringify(/^\d+$/.test(k)?+k:k)+']',root);
export const dict=[],dictIndex=new Map();
const S=v=>{let i=dictIndex.get(v);if(i===undefined){i=dict.length;dict.push(v);dictIndex.set(v,i);}return i;};
const N=v=>typeof v==='number'?v:v===true?1:v===false?0:v==null?NaN:typeof v==='string'?S(v):NaN;
// Compile : pack(state,f32) -> longueur ecrite ; en-tete = [nScalaires, puis un compteur par liste].
export function compilePack(){
  let body='let o=0;f[o++]='+SCALARS.length+';';
  for(const p of SCALARS)body+='f[o++]=N('+acc('s',p)+');';
  for(const [root,fields] of Object.entries(LISTS)){
    body+='{const a=s.'+root+'||E,n=a.length;f[o++]=n;for(let i=0;i<n;i++){const e=a[i];';
    for(const fl of fields)body+='f[o++]=N('+acc('e',fl.replace('$',''))+');';
    body+='}}';
  }
  return new Function('N','E','return function pack(s,f){'+body+'return o;}')(N,[]);
}
export function needed(s){let n=1+SCALARS.length;for(const [root,fields] of Object.entries(LISTS))n+=1+((s[root]||[]).length)*fields.length;return n;}
// Compile : unpack(f32,mirror,D) reconstruit des objets-miroirs reutilises (compatibilite avec le code de page actuel).
export function compileUnpack(){
  let body='let o=1;';
  const set=(root,path,expr)=>{const k=path.split('.');if(k.length===1)return root+'['+JSON.stringify(k[0])+']='+expr+';';return '('+root+'['+JSON.stringify(k[0])+']??='+(/^\d+$/.test(k[1])?'[]':'{}')+')['+JSON.stringify(/^\d+$/.test(k[1])?+k[1]:k[1])+']='+expr+';';};
  for(const p of SCALARS)body+=set('m',p,'f[o++]');
  for(const [root,fields] of Object.entries(LISTS)){
    body+='{const a=(m.'+root+'??=[]),n=f[o++];for(let i=a.length;i<n;i++)a.push({});a.length=n;for(let i=0;i<n;i++){const e=a[i];';
    for(const fl of fields)body+=set('e',fl.replace('$',''),fl[0]==='$'?'D[f[o++]]':'f[o++]');
    body+='}}';
  }
  return new Function('return function unpack(f,m,D){'+body+'return o;}')();
}
// Sous-ensemble en objets simples (pour le clonage structure « naif mais filtre »).
export function compileSubset(){
  let body='const r={};';
  const groups={};for(const p of SCALARS){const k=p.split('.');if(k.length===1)body+='r['+JSON.stringify(p)+']=s['+JSON.stringify(p)+'];';else(groups[k[0]]??=[]).push(k[1]);}
  for(const [g,ks] of Object.entries(groups))body+='r.'+g+'=s.'+g+'?{'+ks.map(k=>k+':s.'+g+'.'+k).join(',')+'}:undefined;';
  for(const [root,fields] of Object.entries(LISTS)){
    const flat=fields.map(f=>f.replace('$','')).filter(f=>!f.includes('.')),nested=[...new Set(fields.filter(f=>f.includes('.')).map(f=>f.split('.')[0]))];
    body+='{const a=s.'+root+'||E,b=new Array(a.length);for(let i=0;i<a.length;i++){const e=a[i];b[i]={'+flat.map(k=>k+':e.'+k).concat(nested.map(k=>k+':e.'+k)).join(',')+'};}r.'+root+'=b;}';
  }
  return new Function('E','return function subset(s){'+body+'return r;}')([]);
}
