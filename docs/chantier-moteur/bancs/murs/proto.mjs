// Prototype de la règle « murs = armes lourdes seulement » et instrumentation, en correctifs mémoire.
// A = instrumentation seule (comportement d'origine), B = instrumentation + règle.
// La règle lit world.armored (liste d'identifiants de groupes) : champ hors de world.destructibles,
// donc hors de l'empreinte de simulation.js:237 et de la signature de destruction.js:137.

// --- Instrumentation commune : journal des dégâts au décor, classés par source et par genre de groupe ---
export const instr={
  destruction:[
    // impact sans rupture
    ["if(record.damage<g.strength){states.set(g.id,record);result.events.push({name:'materialImpact',...event});continue;}",
     "if(record.damage<g.strength){states.set(g.id,record);result.events.push({name:'materialImpact',...event});globalThis.__LOG&&globalThis.__LOG(g,bullet,amount,0);continue;}"],
    // rupture (coupe ou effondrement)
    ["g.active=built.active;g.solids=built.solids;result.events.push({name:'materialBreak',...event});}",
     "g.active=built.active;g.solids=built.solids;result.events.push({name:'materialBreak',...event});globalThis.__LOG&&globalThis.__LOG(g,bullet,amount,record.removed?2:1);}"],
    ["rebuild();revision++;result.revision=revision;","globalThis.__REV&&globalThis.__REV(result,fallen.length);rebuild();revision++;result.revision=revision;"],
  ],
  simulation:[
    ["      damageScenery(point,terrainPower,r,undefined,ignoreId);syncDestruction();hear(point[0],point[2],34,point[1]);",
     "      globalThis.__SRC=(owner==='player'?'joueur':owner==='environment'?'vapeur':Number.isInteger(owner)&&s.enemies[owner]&&giant(s.enemies[owner])?'boss':'ennemi')+':'+kind;damageScenery(point,terrainPower,r,undefined,ignoreId,__HEAVY(owner,kind));globalThis.__SRC='joueur:balle';syncDestruction();hear(point[0],point[2],34,point[1]);"],
    ["else{damageScenery([q.x,q.y,q.z],8,0,dir);syncDestruction();emit('rocketDud'","else{globalThis.__SRC=(q.owner==='player'?'joueur':'ennemi')+':raté';damageScenery([q.x,q.y,q.z],8,0,dir);globalThis.__SRC='joueur:balle';syncDestruction();emit('rocketDud'"],
    ["if(rocket&&muzzle.blocked){damageScenery(origin,8,0,muzzle.direction);","if(rocket&&muzzle.blocked){globalThis.__SRC='joueur:raté';damageScenery(origin,8,0,muzzle.direction);globalThis.__SRC='joueur:balle';"],
    // portes : journal des dégâts
    ["        d.hp=Math.max(0,d.hp-power*(r?Math.max(.2,1-distance/r):1));","        if(globalThis.__DOORS_ARMORED&&!heavy){globalThis.__DOORLOG&&globalThis.__DOORLOG(d,power,false);continue;}d.hp=Math.max(0,d.hp-power*(r?Math.max(.2,1-distance/r):1));globalThis.__DOORLOG&&globalThis.__DOORLOG(d,power,!d.hp);"],
    // classe de dégâts portée par l'appel (sans effet tant que le monde ne marque aucun groupe)
    ["    function damageScenery(point,power,r=0,direction,ignoreId){","    const __HEAVY=(owner,kind)=>{const R=globalThis.__RULE||{};return kind==='steam'?!!R.steam:owner==='player'?true:Number.isInteger(owner)&&s.enemies[owner]&&giant(s.enemies[owner])?R.boss!==false:R.enemy!==false;};\n    function damageScenery(point,power,r=0,direction,ignoreId,heavy=r>0){if(power>0&&globalThis.__CALL)globalThis.__CALL(point,power,r,direction,ignoreId,heavy);"],
    ["const result=destruction&&(r>0?destruction.blast(point,r,power,ignoreId):destruction.hit(point,power,direction));","const result=destruction&&(r>0?destruction.blast(point,r,power,ignoreId,{heavy}):destruction.hit(point,power,direction,{heavy}));"],
  ]};
// --- Règle (B) : destruction.js ---
export const rule={
  destruction:[
    ["    const foliage=originalMeshes.some(m=>m.shape==='foliage')?sharedFoliage():null;","    const ARMORED=new Set(world.armored||[]),UNBREAKABLE=new Set(world.unbreakable||[]);\n    const foliage=originalMeshes.some(m=>m.shape==='foliage')?sharedFoliage():null;"],
    ["g.originalVolume=g.colliders.reduce((v,i)=>v+volume(originalColliders[i]),0);groups.set(g.id,g);","g.originalVolume=g.colliders.reduce((v,i)=>v+volume(originalColliders[i]),0);g.armored=UNBREAKABLE.has(g.id)?2:ARMORED.has(g.id)?1:0;groups.set(g.id,g);"],
    ["    function damage(point,radius,power,bullet,ignoreId,direction){","    function damage(point,radius,power,bullet,ignoreId,direction,heavy=!bullet){"],
    ["amount=power*(bullet?1:Math.pow(Math.max(0,1-d/radius),.45));if(amount<=.02)continue;",
     "amount=power*(bullet?1:Math.pow(Math.max(0,1-d/radius),.45));if(amount<=.02)continue;\n        if(g.armored>(heavy?1:0)){chipsFor(g,nearest,impact,amount,result.debris);result.events.push({name:'materialImpact',x:impact[0],y:impact[1],z:impact[2],sourceId:g.id,material:materialOf(nearest.mesh),power:amount,seed:nearest.source*977+(revision+1)*911,deflected:true});result.deflected=(result.deflected||0)+1;globalThis.__LOG&&globalThis.__LOG(g,bullet,amount,-1);continue;}"],
    ["hit:(point,power,direction)=>damage(point,.22,power,true,undefined,validPoint(direction)?direction:undefined),blast:(point,radius,power,ignoreId)=>damage(point,radius,power,false,ignoreId)",
     "hit:(point,power,direction,options)=>damage(point,.22,power,true,undefined,validPoint(direction)?direction:undefined,options?.heavy===true),blast:(point,radius,power,ignoreId,options)=>damage(point,radius,power,false,ignoreId,undefined,options?.heavy!==false)"],
  ]};
// Sans la règle, hit/blast ignorent le 4e/5e argument : rien à corriger côté A.
export const patchesA={destruction:instr.destruction,simulation:instr.simulation};
export const patchesB={destruction:[...rule.destruction,...instr.destruction],simulation:instr.simulation};

// --- Définitions candidates d'un « mur » (marquage par donnée) ---
// m = maillage du premier collider du groupe (ou premier maillage), c = ce collider.
export function classify(world,g){
  const c=g.colliders.length?world.colliders[g.colliders[0]]:null,m=world.meshes[c?c.mesh:g.meshes[0]],cat=m.category||'';
  const sx=c?c.maxX-c.minX:0,sy=c?c.maxY-c.minY:0,sz=c?c.maxZ-c.minZ:0;
  return {kind:g.kind,cat,mat:m.mat,sx,sy,sz,thin:Math.min(sx,sz)};
}
export const DEFS={
  // R1 : genre « wall » seul (murs de salle, linteaux, cages d'ascenseur, cloisons de renfort, hautes enceintes)
  R1:(w,g)=>g.kind==='wall',
  // R2 : structure = murs + toits + piliers porteurs (section >= 0,6 m)
  R2:(w,g)=>{const q=classify(w,g);return g.kind==='wall'||g.kind==='roof'||g.kind==='support'&&q.thin>=.6;},
  // R3 : R2 + murets d'enceinte (catégorie boundary, quel que soit le genre)
  R3:(w,g)=>{const q=classify(w,g);return g.kind==='wall'||g.kind==='roof'||g.kind==='support'&&q.thin>=.6||q.cat==='boundary';},
};
export const armoredIds=(world,def)=>world.destructibles.filter(g=>DEFS[def](world,g)).map(g=>g.id);

// Famille « terrain » : relief d'arrière-plan et marquages/dallages posés au sol (classe « jamais »).
const FLAT=new Set(['arena_inlay','floor_drain','threshold','hazard_marking','trail','ground_patch','leaf_litter','jump_landing','dock_warning','trap_warning','arena_path_mark','trap_plate']);
export const isRelief=(w,g)=>g.meshes.some(i=>['hill','cliff','cliff_stratum'].includes(w.meshes[i].category));
export const isFloor=(w,g)=>!g.colliders.length&&g.meshes.every(i=>FLAT.has(w.meshes[i].category)||w.meshes[i].s[1]<=.06&&!(w.meshes[i].r||[]).some(v=>Math.abs(v)>.01));
export const unbreakableIds=(world,{relief=true,floor=true}={})=>world.destructibles.filter(g=>relief&&isRelief(world,g)||floor&&isFloor(world,g)).map(g=>g.id);
