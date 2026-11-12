// DEMO-06 : pilote v1 (sans masque de disques) contre v2 sur le monde 4. usage : node pad.mjs v1|v2 [index=3] [minutes=7]
const [which='v2',idx='3',min='7']=process.argv.slice(2);
const {runSession,plausibleLoadout}=await import(which==='v1'?'./session-v1.mjs':'../demo/session.mjs');
let pads=0;const o=runSession({minutes:+min,startIndex:+idx,startLoadout:plausibleLoadout(+idx),record:false,memoryEveryS:1e9,wallLimitMs:240000,maxWorlds:1});
console.log(JSON.stringify({pilot:which,world:+idx+1,minutes:+(o.steps/3600).toFixed(1),won:o.worldsWon,stalls:o.stalls,deaths:o.deaths,jumpPadEvents:o.events.jumpPad||0,worlds:o.worlds.map(w=>({i:w.index+1,won:w.won,s:w.seconds,stalls:w.stalls,stallLog:w.stallLog,pilot:w.pilot&&{astar:w.pilot.astar,astarFail:w.pilot.astarFail,edgeTests:w.pilot.edgeTests,padRoutes:w.pilot.padRoutes}}))}));
