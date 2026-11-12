// Exact rewrites of the per-identity loops that run every step (simulation.js 673d6b2).
const I=[];
// flat id lists per encounter, computed once (waves are immutable after create; restore only assigns state fields)
I.push(["    const encounterMap=new Map(s.encounters.map(q=>[q.id,q])),enemyEncounter=new Map();",
        "    const encounterMap=new Map(s.encounters.map(q=>[q.id,q])),enemyEncounter=new Map(),encounterIds=s.encounters.map(q=>q.waves.flatMap(w=>w.enemyIds));"]);
I.push([`      for(const q of s.encounters){const ids=q.waves.flatMap(w=>w.enemyIds);q.total=ids.length;q.remaining=ids.filter(id=>s.enemies[id].hp>0).length;q.active=ids.filter(id=>alive(s.enemies[id])&&s.enemies[id].combatEnabled).length;}
      Object.assign(s.aiStats,{reserve:s.enemies.filter(e=>e.hp>0&&!present(e)).length,combat:s.enemies.filter(e=>alive(e)&&!giant(e)&&e.combatEnabled&&(!e.bossWave||e.bossReleased)).length,combatCap:maxCombat});`,
`      for(let n=0;n<s.encounters.length;n++){const q=s.encounters[n],ids=encounterIds[n];let remaining=0,active=0;for(let k=0;k<ids.length;k++){const e=s.enemies[ids[k]];if(e.hp>0){remaining++;if(present(e)&&e.combatEnabled)active++;}}q.total=ids.length;q.remaining=remaining;q.active=active;}
      let reserve=0,combat=0;for(const e of s.enemies){if(e.hp>0&&!present(e))reserve++;if(alive(e)&&!giant(e)&&e.combatEnabled&&(!e.bossWave||e.bossReleased))combat++;}
      s.aiStats.reserve=reserve;s.aiStats.combat=combat;s.aiStats.combatCap=maxCombat;`]);
I.push([`        for(const q of s.encounters){
          if(campaign&&q.requiresTrophy&&trophyState(q.requiresTrophy)?.phase!=='trial')continue;
          const ids=q.waves.flatMap(w=>w.enemyIds),remaining=ids.filter(id=>s.enemies[id].hp>0);
          if(!remaining.length){`,`        for(let qn=0;qn<s.encounters.length;qn++){const q=s.encounters[qn];
          if(campaign&&q.requiresTrophy&&trophyState(q.requiresTrophy)?.phase!=='trial')continue;
          const ids=encounterIds[qn];let remainingCount=0;for(let k=0;k<ids.length;k++)if(s.enemies[ids[k]].hp>0)remainingCount++;
          if(!remainingCount){`]);
// candidates sorted on precomputed keys: same comparator values, same comparison sequence (index sort)
I.push(["      }).sort((a,c)=>(Math.hypot(a.x-p.x,a.z-p.z)-(a.combatEnabled?8:0))-(Math.hypot(c.x-p.x,c.z-p.z)-(c.combatEnabled?8:0))||a.id-c.id);",
        "      });{const keys=candidates.map(e=>Math.hypot(e.x-p.x,e.z-p.z)-(e.combatEnabled?8:0)),order=candidates.map((e,i)=>i).sort((i,j)=>keys[i]-keys[j]||candidates[i].id-candidates[j].id),copy=candidates.slice();for(let i=0;i<order.length;i++)candidates[i]=copy[order[i]];}"]);
// neighbour grid with numeric keys (same membership, same order)
I.push(["const key=Math.floor(e.x/8)+','+Math.floor(e.z/8);let list=neighbors.get(key);","const key=(Math.floor(e.x/8)+32768)*65536+(Math.floor(e.z/8)+32768);let list=neighbors.get(key);"]);
I.push(["        const list=neighbors.get(ix+','+iz);if(list)for(const e of list)result.push(e);","        const list=neighbors.get((ix+32768)*65536+(iz+32768));if(list)for(const e of list)result.push(e);"]);
// updateEnemies: reusable start buffer, explicit timer decrements, counting loops
I.push(["rebuildNeighbors();const starts=s.enemies.map(e=>[e.x,e.z]);","rebuildNeighbors();if(enemyStarts.length<s.enemies.length*2)enemyStarts=new Float64Array(s.enemies.length*2);const starts=enemyStarts;for(let i=0;i<s.enemies.length;i++){starts[2*i]=s.enemies[i].x;starts[2*i+1]=s.enemies[i].z;}"]);
I.push(["        for(const key of ['senseWait','thinkWait','shareWait','alertWait','coverWait','planWait'])e[key]=Math.max(-.05,e[key]-dt);",
        "        e.senseWait=Math.max(-.05,e.senseWait-dt);e.thinkWait=Math.max(-.05,e.thinkWait-dt);e.shareWait=Math.max(-.05,e.shareWait-dt);e.alertWait=Math.max(-.05,e.alertWait-dt);e.coverWait=Math.max(-.05,e.coverWait-dt);e.planWait=Math.max(-.05,e.planWait-dt);"]);
I.push(["s.enemies[i].moveSpeed=Math.hypot(s.enemies[i].x-starts[i][0],s.enemies[i].z-starts[i][1])/dt;","s.enemies[i].moveSpeed=Math.hypot(s.enemies[i].x-starts[2*i],s.enemies[i].z-starts[2*i+1])/dt;"]);
I.push(["      Object.assign(s.aiStats,{awake,dormant,reserve,alive:s.enemies.filter(e=>e.hp>0).length,pathSearches:routeSearches,pathDeferred:routeDeferred});",
        "      {let living=0;for(const e of s.enemies)if(e.hp>0)living++;const st=s.aiStats;st.awake=awake;st.dormant=dormant;st.reserve=reserve;st.alive=living;st.pathSearches=routeSearches;st.pathDeferred=routeDeferred;}"]);
I.push(["    function updateEnemies(dt){","    let enemyStarts=new Float64Array(0);\n    function updateEnemies(dt){"]);
export const identityV2={simulation:I};
export const identityPatch=()=>identityV2;
