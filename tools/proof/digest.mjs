import {createHash} from 'node:crypto';
export const DIGEST_VERSION='fnv1a32-float64le-state-v1';
export const FNV_OFFSET=2166136261;

export function hasher(seed=FNV_OFFSET) {
  let hash=seed>>>0;const bytes=new Uint8Array(8),view=new DataView(bytes.buffer);
  const byte=value=>{hash=Math.imul(hash^(value&255),16777619)>>>0;};
  const word=value=>{for(let i=0;i<4;i++)byte(value>>>(i*8));};
  const text=value=>{const data=Buffer.from(value,'utf8');word(data.length);for(const value of data)byte(value);};
  const number=value=>{view.setFloat64(0,value,true);for(const value of bytes)byte(value);};
  function value(item){
    if(item===undefined){byte(0);return;}if(item===null){byte(1);return;}
    if(typeof item==='boolean'){byte(item?3:2);return;}if(typeof item==='number'){byte(4);number(item);return;}
    if(typeof item==='string'){byte(5);text(item);return;}
    if(Array.isArray(item)){byte(6);word(item.length);for(const element of item)value(element);return;}
    throw new TypeError('Digest expects an explicit scalar or array field');
  }
  return {byte,word,text,number,value,result:()=>hash,hex:()=>hash.toString(16).padStart(8,'0')};
}

const PLAYER=['x','y','z','yaw','pitch','hp','heat','overheated','dash','dashing','pulseCooldown','airborne','airVX','airVY','airVZ','airTime','padId'];
const ENEMY=['id','type','x','y','z','baseY','hp','maxHp','yaw','active','deployed','combatEnabled','sleeping','cooldown','hurt','stun','phase','goalX','goalZ','path','pathAt','moveSpeed','planWait','thinkWait','senseWait','memory','alert','seen','lastSeenX','lastSeenY','lastSeenZ','awareness','tactic','attackState','windup','windupMax','burstLeft','burstWait','rushTime','rushX','rushZ','rushHit','bossClock','bossStep','weakPointOpen','weakTimer','airborne','airVX','airVY','airVZ','airTime'];
const DEBRIS=['id','sourceId','shape','material','x','y','z','vx','vy','vz','size','rotation','angularVelocity','age','resting','mass','seed','settleTime','impactWait'];
const PROJECTILE=['id','kind','x','y','z','vx','vy','vz','dx','dy','dz','age','life','owner','damage','power','radius'];
const STATE=['time','elapsed','won','dead','kills','shots','hits','relays','weapon','score','combo','comboTime','destructionRevision'];
// Field order is part of DIGEST_VERSION. Do not allocate/encode thousands of
// repeated field names between measured steps and accidentally provoke GC.
function fields(hash,object,keys){for(const key of keys)hash.value(object?.[key]);}
function collection(hash,label,items,keys){hash.text(label);hash.word(items?.length||0);for(const item of items||[])fields(hash,item,keys);}

export function stateDigest(state) {
  const hash=hasher();hash.text(DIGEST_VERSION);fields(hash,state,STATE);fields(hash,state.player,PLAYER);
  collection(hash,'enemies',state.enemies,ENEMY);collection(hash,'debris',state.debris,DEBRIS);
  collection(hash,'projectiles',state.projectiles,PROJECTILE);collection(hash,'bullets',state.bullets,PROJECTILE);
  // Events are observed before the host clears them, like game.js. aiStats is
  // deliberately excluded so enabling counters cannot change the state proof.
  hash.text(JSON.stringify(state.events));return hash.result();
}

export function chainDigest(previous,current){const hash=hasher(previous);hash.word(current);return hash.result();}
export const hex=value=>(value>>>0).toString(16).padStart(8,'0');
export function snapshotDigest(sim){
  const text=JSON.stringify(sim.snapshot()),fnv=hasher();for(const byte of Buffer.from(text,'utf8'))fnv.byte(byte);
  return {sha256:createHash('sha256').update(text).digest('hex'),fnv1a32:fnv.hex(),bytes:Buffer.byteLength(text)};
}
