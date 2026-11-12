// Contre-vérification DEMO-07 : survie du pilote selon difficulté et réduction de dégâts dans la simulation (sans aide hors simulation).
// usage : node surv.mjs indexMonde minutes difficulté incoming(1|.35) assist(0|1)
import {loadMain} from '../demo/load.mjs';import {runSession,plausibleLoadout,W} from '../demo/session.mjs';
const [idx='15',min='6',diff='1',inc='1',assist='0']=process.argv.slice(2);
const Wx=+inc===1?W:loadMain({patches:{simulation:[['amount*=stats.incomingMultiplier;','amount*=stats.incomingMultiplier*'+inc+';']]}});
const o=runSession({minutes:+min,startIndex:+idx,startLoadout:+idx>0?plausibleLoadout(+idx):null,difficulty:+diff,assist:assist==='1',record:false,memoryEveryS:1e9,W:Wx,wallLimitMs:230000});
const deathsAt=[];
console.log(JSON.stringify({world:+idx+1,minutes:+(o.steps/3600).toFixed(1),difficulty:+diff,incoming:+inc,assist:assist==='1',won:o.worldsWon,opened:o.worlds.length,deaths:o.deaths,restoresRefused:o.restoresRefused,restoresOk:o.restoresOk,stalls:o.stalls,exceptions:o.exceptions.length,assistHp:+o.assistHp.toFixed(0),
 worlds:o.worlds.map(w=>({i:w.index+1,won:w.won,s:w.seconds,deaths:w.deaths,boss:w.bossHpLeft+'/'+w.bossMaxHp,hp:w.hp})),events:{hurt:o.events.hurt||0,shieldBlock:o.events.shieldBlock||0,dead:o.events.dead||0}}));
