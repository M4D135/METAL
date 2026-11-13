// RESTE-P4: exact rewrites of the remaining per-step full-roster loops (on top of the cumulative R1 build).
export const simLoops=[
 // 1. no jump pad in the world: checkPad() has no side effect, skip the roster pass
 ['      for(const e of s.enemies)if(alive(e))checkPad(e);','      if(s.jumpPads.length)for(const e of s.enemies)if(alive(e))checkPad(e);'],
 // 2. moveSpeed: hypot only for bodies that moved (hypot(0,0)/dt === 0)
 ['if(dt>0)for(let i=0;i<s.enemies.length;i++)s.enemies[i].moveSpeed=Math.hypot(s.enemies[i].x-starts[2*i],s.enemies[i].z-starts[2*i+1])/dt;',
  'if(dt>0)for(let i=0;i<s.enemies.length;i++){const e=s.enemies[i],mx=e.x-starts[2*i],mz=e.z-starts[2*i+1];e.moveSpeed=mx===0&&mz===0?0:Math.hypot(mx,mz)/dt;}'],
 // 3. director: counting loops instead of filter().length (no closure, no array)
 ['    function updateDirector(dt){','    function dangerCount(){let n=0;const list=s.enemies;for(let i=0;i<list.length;i++){const e=list[i];if(e.hp>0&&e.deployed!==false&&!e.sleeping&&e.seen&&Math.hypot(e.x-p.x,e.z-p.z)<25)n++;}return n;}\n    function activeMechanisms(){let n=0;const list=s.mechanisms;for(let i=0;i<list.length;i++)if(list[i].active)n++;return n;}\n    function bossAliveNow(){const list=s.enemies;for(let i=0;i<list.length;i++){const e=list[i];if(e.type===3&&e.hp>0)return true;}return false;}\n    function updateDirector(dt){'],
 ['s.mechanisms.filter(m=>m.active).length*.5+Math.min(1,s.kills/Math.max(1,s.enemies.length))','activeMechanisms()*.5+Math.min(1,s.kills/Math.max(1,s.enemies.length))'],
 ['const danger=Math.min(1,s.enemies.filter(e=>alive(e)&&!e.sleeping&&e.seen&&Math.hypot(e.x-p.x,e.z-p.z)<25).length/5)','const danger=Math.min(1,dangerCount()/5)'],
 ['      s.bossAlive=s.enemies.some(e=>e.type===3&&e.hp>0);','      s.bossAlive=bossAliveNow();'],
 // 4. neighbour grid: lists are emptied and reused instead of Map.clear() + new arrays (same membership, same order)
 ['      neighbors.clear();\n      for(const e of s.enemies)if(alive(e)){const key=(Math.floor(e.x/8)+32768)*65536+(Math.floor(e.z/8)+32768);let list=neighbors.get(key);if(!list)neighbors.set(key,list=[]);list.push(e);}',
  '      for(let k=0;k<neighborUsed.length;k++)neighborUsed[k].length=0;neighborUsed.length=0;const all=s.enemies;\n      for(let i=0;i<all.length;i++){const e=all[i];if(e.hp>0&&e.deployed!==false){const key=(Math.floor(e.x/8)+32768)*65536+(Math.floor(e.z/8)+32768);let list=neighbors.get(key);if(!list)neighbors.set(key,list=[]);if(!list.length)neighborUsed.push(list);list.push(e);}}'],
 ['    const neighbors=new Map();','    const neighbors=new Map(),neighborUsed=[];'],
 // 5. encounter selection: typed scratch, insertion sort on (key,id), flags instead of Set/Map (total order => same result as Array.sort)
 [`      const candidates=s.enemies.filter(e=>{
        if(!alive(e)||giant(e)||!e.encounterReleased||e.bossWave&&!e.bossReleased)return false;
        const q=enemyEncounter.get(e.id);if(!q)return true;
        if(e.returning){if(Math.hypot(e.x-p.x,e.z-p.z)<12&&sight(e.x,e.z,p.x,p.z,eyeHeight(e),p.y+1.45)){e.returning=false;e.quietTime=0;remember(e,p.x,p.z,'engage',8,p.y+1.45);}else return false;}
        return e.hasMemory||inEncounter(q,8)||e.combatEnabled&&e.quietTime<5;
      });{const keys=candidates.map(e=>Math.hypot(e.x-p.x,e.z-p.z)-(e.combatEnabled?8:0)),order=candidates.map((e,i)=>i).sort((i,j)=>keys[i]-keys[j]||candidates[i].id-candidates[j].id),copy=candidates.slice();for(let i=0;i<order.length;i++)candidates[i]=copy[order[i]];}
      const selected=new Set(),locals=new Map();
      for(const e of candidates){if(selected.size>=maxCombat)break;const q=enemyEncounter.get(e.id),n=locals.get(q)||0;if(q&&n>=(q.maxActive||6))continue;selected.add(e.id);locals.set(q,n+1);}
      for(const e of s.enemies)if(!giant(e)){
        const enabled=selected.has(e.id);if(e.combatEnabled&&!enabled&&alive(e)&&enemyEncounter.has(e.id)){e.returning=true;clearEvidence(e);}
        e.combatEnabled=enabled;
      }`,
 `      const roster=s.enemies,total=roster.length;if(selKey.length<total){selKey=new Float64Array(total);selFlag=new Uint8Array(total);selLocal=new Int32Array(s.encounters.length+1);}
      let count=0,nan=false;selCand.length=0;
      for(let i=0;i<total;i++){const e=roster[i];
        if(!alive(e)||giant(e)||!e.encounterReleased||e.bossWave&&!e.bossReleased)continue;
        const q=enemyEncounter.get(e.id);
        if(q){
          if(e.returning){if(Math.hypot(e.x-p.x,e.z-p.z)<12&&sight(e.x,e.z,p.x,p.z,eyeHeight(e),p.y+1.45)){e.returning=false;e.quietTime=0;remember(e,p.x,p.z,'engage',8,p.y+1.45);}else continue;}
          if(!(e.hasMemory||inEncounter(q,8)||e.combatEnabled&&e.quietTime<5))continue;
        }
        selCand.push(e);count++;
      }
      // keys are computed after the filter pass, exactly like the original map() (remember() above may run first)
      for(let i=0;i<count;i++){const e=selCand[i],k=Math.hypot(e.x-p.x,e.z-p.z)-(e.combatEnabled?8:0);selKey[i]=k;if(k!==k)nan=true;}
      if(nan){const keys=Array.from(selKey.subarray(0,count)),copy=selCand.slice(),order=copy.map((e,i)=>i).sort((i,j)=>keys[i]-keys[j]||copy[i].id-copy[j].id);for(let i=0;i<count;i++)selCand[i]=copy[order[i]];}
      else for(let i=1;i<count;i++){const e=selCand[i],k=selKey[i];let j=i-1;while(j>=0&&(selKey[j]>k||selKey[j]===k&&selCand[j].id>e.id)){selCand[j+1]=selCand[j];selKey[j+1]=selKey[j];j--;}selCand[j+1]=e;selKey[j+1]=k;}
      selFlag.fill(0,0,total);selLocal.fill(0);let chosen=0;
      for(let i=0;i<count;i++){if(chosen>=maxCombat)break;const e=selCand[i],q=enemyEncounter.get(e.id),qi=q?encounterIndex.get(q):s.encounters.length,n=selLocal[qi];if(q&&n>=(q.maxActive||6))continue;if(!selFlag[e.id]){selFlag[e.id]=1;chosen++;}selLocal[qi]=n+1;}
      for(let i=0;i<total;i++){const e=roster[i];if(giant(e))continue;
        const enabled=selFlag[e.id]===1;if(e.combatEnabled&&!enabled&&alive(e)&&enemyEncounter.has(e.id)){e.returning=true;clearEvidence(e);}
        e.combatEnabled=enabled;
      }`],
 ['    function updateEncounters(dt){','    let selKey=new Float64Array(0),selFlag=new Uint8Array(0),selLocal=new Int32Array(1);const selCand=[],encounterIndex=new Map(s.encounters.map((q,i)=>[q,i]));\n    function updateEncounters(dt){'],
];
export const simLoopsPatch=()=>simLoops;
