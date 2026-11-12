// Same scripted circle/tour player as the node benches, run inside a real Chrome page.
(function(){
  const out=[];const q=(a,p)=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*p))];};
  const SC=[['legacy-s0',0,undefined,'circle',1800],['v2-w10',9,{campaign:true,campaignVersion:2},'tour',3600],['v2-w16',15,{campaign:true,campaignVersion:2},'tour',3600]];
  for(let rep=0;rep<2;rep++)for(const [label,idx,opts,driver,STEPS] of SC){
    let t=performance.now();const w=FWorld.create(96,idx,opts);const gen=performance.now()-t;
    t=performance.now();const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const init=performance.now()-t;
    const s=sim.state,enc=(s.encounters||[]).filter(q=>!w.rooms?.[q.zoneId]?.bossArena);let at=0;
    const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},times=[];
    for(let i=0;i<STEPS;i++){input.moveX=Math.sin(i/90);input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;
      if(driver==='tour'){s.player.hp=Math.max(s.player.hp,60);if(enc.length&&i%420===0){const e=enc[at++%enc.length];s.player.x=e.trigger.x;s.player.z=e.trigger.z;s.player.y=sim.ground(e.trigger.x,e.trigger.z);}}
      const t0=performance.now();sim.step(1/60,input);times.push(performance.now()-t0);s.events.length=0;if(s.dead)break;}
    const big=times.map((v,i)=>[i,v]).filter(x=>x[1]>8);
    out.push({label:label+'#'+rep,driver,steps:times.length,genMs:+gen.toFixed(0),simInitMs:+init.toFixed(0),avg:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3),p99:+q(times,.99).toFixed(2),p999:+q(times,.999).toFixed(2),max:+Math.max(...times).toFixed(1),over8:big.length,over16:times.filter(v=>v>16).length,spikes:big.slice(0,12).map(x=>x[0]+':'+x[1].toFixed(1)).join(' ')});
  }
  document.body.textContent='RESULT'+JSON.stringify(out)+'END';
})();
