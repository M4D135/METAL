// Cause des morts du pilote : on instrumente hurt() par un correctif en mémoire (aucune écriture dans le dépôt).
// usage : node cause.mjs indexMonde minutes difficulté incoming
import {loadMain} from '../demo/load.mjs';import {runSession,plausibleLoadout} from '../demo/session.mjs';
const [idx='15',min='6',diff='0',inc='1']=process.argv.slice(2);
const log=[];globalThis.__hurtLog=(amount,tag,hp,t)=>log.push({t:+t.toFixed(2),tag,amount:+amount.toFixed(1),hpAfter:+hp.toFixed(1)});
const P=[['amount*=stats.incomingMultiplier;','amount*=stats.incomingMultiplier*'+inc+';'],
 ["p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt');","p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt');globalThis.__hurtLog(amount,globalThis.__tag||'?',p.hp,s.time);"],
 ['a.hitPlayer=true;hurt(a.damage);',"a.hitPlayer=true;globalThis.__tag='boss:'+a.kind;hurt(a.damage);globalThis.__tag='';"],
 ['e.rushHit=true;hurt(16,true,{x:e.x,y:e.y,z:e.z});',"e.rushHit=true;globalThis.__tag='rush';hurt(16,true,{x:e.x,y:e.y,z:e.z});globalThis.__tag='';"],
 ['if(e===p)hurt(amount);else damageEnemy(e,amount*.18,{x,y,z,credit:false});',"if(e===p){globalThis.__tag='env';hurt(amount);globalThis.__tag='';}else damageEnemy(e,amount*.18,{x,y,z,credit:false});"],
 ['hazardWait=.65;hurt(8);',"hazardWait=.65;globalThis.__tag='hazard';hurt(8);globalThis.__tag='';"],
 ['hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z});',"globalThis.__tag='bullet';hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z});globalThis.__tag='';"]];
const Wx=loadMain({patches:{simulation:P}});
const o=runSession({minutes:+min,startIndex:+idx,startLoadout:+idx>0?plausibleLoadout(+idx):null,difficulty:+diff,assist:false,record:false,memoryEveryS:1e9,W:Wx,wallLimitMs:230000});
const by={};for(const h of log){const b=by[h.tag]||(by[h.tag]={n:0,sum:0,max:0,kills:0});b.n++;b.sum+=h.amount;b.max=Math.max(b.max,h.amount);if(h.hpAfter===0)b.kills++;}
for(const k in by)by[k].sum=+by[k].sum.toFixed(0);
const deaths=log.map((h,i)=>h.hpAfter===0?log.slice(Math.max(0,i-5),i+1):null).filter(Boolean);
console.log(JSON.stringify({world:+idx+1,difficulty:+diff,incoming:+inc,deaths:o.deaths,hurts:log.length,bySource:by,lastHitsBeforeEachDeath:deaths}));
