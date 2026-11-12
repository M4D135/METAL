// Sauts de caméra : la caméra suit p.y sans lissage (game.js:720) ; move() (simulation.js:260-270)
// pose p.y sur la nouvelle hauteur jusqu'à 0,42 m d'un coup. Compte les marches franchies au sol.
// node steps.mjs <ferro>
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const root=process.argv[2];const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation}=ctx.window;
for(const [label,idx,opts] of [['classic-0',0],['classic-1',1],['campaign-0',0,{campaign:true,campaignVersion:2}],['campaign-5',5,{campaign:true,campaignVersion:2}],['campaign-9',9,{campaign:true,campaignVersion:2}],['campaign-15',15,{campaign:true,campaignVersion:2}]]){
  const world=FWorld.create(96,idx,opts),sim=FSimulation.create(world,{armorSystem:true});const s=sim.state,p=s.player;
  // les ennemis ne gênent pas la mesure : on les retire du jeu
  for(const e of s.enemies){e.hp=0;}
  let lastY=p.y,snaps=[],frames=0,slope=0,dist=0,lx=p.x,lz=p.z;
  for(let i=0;i<60*120;i++){ // 2 min, marche aléatoire : avance + virages réguliers + petits rebonds sur les murs
    const blocked=s.locomotion?.blocked;
    sim.step(1/60,{moveY:1,moveX:Math.sin(i/70)*.5,sprint:true,lookX:blocked?.9:Math.sin(i/230)*.01,lookY:0});frames++;
    dist+=Math.hypot(p.x-lx,p.z-lz);lx=p.x;lz=p.z;
    if(s.dead||s.won)break;
    const dy=p.y-lastY;lastY=p.y;
    if(!p.airborne&&Math.abs(dy)>.06)snaps.push(+dy.toFixed(2));else if(!p.airborne&&Math.abs(dy)>.002)slope++;
  }
  const big=snaps.filter(v=>Math.abs(v)>=.15);
  console.log(label.padEnd(12),'distance',dist.toFixed(0)+' m','marches >6 cm/image',snaps.length,'dont >=15 cm',big.length,'max',Math.max(0,...snaps.map(Math.abs)).toFixed(2)+' m','par minute',(snaps.length/(frames/3600)).toFixed(1),'exemples',JSON.stringify(big.slice(0,8)));
}
