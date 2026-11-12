// Contre-vérification SAUT-01/02/04 : (A) métadonnées des murets, (B) coût d'une brèche en 0.8.0 non modifiée,
// (C) la proposition réelle (clip lié au destructibleId, via localSolids) et non le prototype (boîtes statiques).
import {loadFast,WORLDS} from '../saut/lib.mjs';import {physPatches} from '../saut/phys.mjs';
const part=process.argv[2]||'ABC';
function proposalPatches(){
  const P=physPatches({});
  const a=P.simulation.find(([from])=>typeof from==='string'&&from.startsWith('function actorBlocked'));
  a[1]+=`
      if(e===p&&Q&&__clipOn){if(!__clipIds){__clipIds=new Set((world.outdoorBoundaries||[]).map(b=>world.meshes[b.mesh]?.destructibleId).filter(v=>v!==undefined));}
        for(const q of localSolids(x,z))if(q.destructibleId!==undefined&&__clipIds.has(q.destructibleId)&&q.minY<y+1.8&&(__stump<=0||q.maxY-q.minY>__stump)&&discBox(x,z,r,q)){__clipHit++;return true;}}`;
  const v=P.simulation.find(([from])=>typeof from==='string'&&from.startsWith('let velocityX=0'));
  v[1]+='let __clipIds=null,__clipOn=false,__clipHit=0,__stump=0;';
  const r=P.simulation.find(([from])=>typeof from==='string'&&from.startsWith('return {state:s'));
  r[1]=r[1].replace('return {__I,','__I.clipOn=(v,st=0)=>{__clipOn=v;__stump=st;};__I.clipHits=()=>__clipHit;return {__I,');
  return P;
}
const W0=loadFast(),WP=loadFast({patches:proposalPatches()});
const mk=(W,label)=>{const e=WORLDS.find(w=>w[0]===label);const world=W.FWorld.create(96,e[1],e[2]);return world;};
const authoredAt=(world,x,z)=>{let best=null;for(const f of world.walkable)if(!f.substrate&&!f.fallback&&Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2){const h=(f.y||0)+(x-f.x)*(f.slopeX||0)+(z-f.z)*(f.slopeZ||0);if(best===null||h>best)best=h;}return best;};

if(part.includes('A')){
  console.log('== A. métadonnées des murets');
  for(const label of ['v2-00','v2-01','v2-02','v2-03','v2-04','v2-05','legacy-0','legacy-1','legacy-2']){
    const world=mk(W0,label),sim=W0.FSimulation.create(world,{});
    let noId=0,multi=0,zero=0,above=0,aboveSamples=0,kinds={},heights={};
    for(const b of world.outdoorBoundaries){
      const m=world.meshes[b.mesh],id=m?.destructibleId;if(id===undefined){noId++;continue;}
      const cs=sim.destruction.colliders.filter(c=>c.destructibleId===id);if(cs.length>1)multi++;if(!cs.length)zero++;
      const g=(world.destructibles||[]).find(g=>String(g.id)===String(id));kinds[g?.kind+':'+g?.strength]=(kinds[g?.kind+':'+g?.strength]||0)+1;
      const c=cs[0];if(!c)continue;const h=+(c.maxY-c.minY).toFixed(2);heights[h]=(heights[h]||0)+1;
      // endroits où le joueur 0.8.0 tient debout AU-DESSUS du muret, dans son emprise élargie de 0,28 m : le clip sans plafond les lui retire
      let hit=false;for(let x=c.minX-.27;x<=c.maxX+.27;x+=.3)for(let z=c.minZ-.27;z<=c.maxZ+.27;z+=.3){const h2=authoredAt(world,x,z);if(h2!==null&&h2>=c.maxY-.06&&!sim.blocked(x,z,.28,h2)){hit=true;aboveSamples++;}}
      if(hit)above++;
    }
    console.log(label,'stage',world.stage,'murets',world.outdoorBoundaries.length,'sansId',noId,'multiColliders',multi,'sansCollider',zero,'genres',JSON.stringify(kinds),'hauteurs',JSON.stringify(heights),'| murets dont l\'emprise recouvre un sol praticable plus haut:',above,'('+aboveSamples+' points)');
  }
}

// trouve des murets au sol (base ~ sol de la cour) avec le côté intérieur
function candidates(world,sim,n=6){
  const out=[];
  for(const b of world.outdoorBoundaries){const c=world.colliders.find(c=>c.mesh===b.mesh);if(!c)continue;const alongX=(c.maxX-c.minX)>(c.maxZ-c.minZ),cx=(c.minX+c.maxX)/2,cz=(c.minZ+c.maxZ)/2;
    for(const side of [-1,1]){const ix=alongX?cx:cx+side*2.6,iz=alongX?cz+side*2.6:cz,ox=alongX?cx:cx-side*2.2,oz=alongX?cz-side*2.2:cz;
      const hi=authoredAt(world,ix,iz),ho=authoredAt(world,ox,oz);
      if(hi!==null&&Math.abs(hi-c.minY)<.05&&ho===null&&!sim.blocked(ix,iz,.28,hi)){let clear=true;for(let t=.3;t<2.6;t+=.3){const x=alongX?cx:cx+side*t,z=alongX?cz+side*t:cz;if(t>.6&&sim.blocked(x,z,.28,hi))clear=false;}
        if(clear)out.push({c,alongX,cx,cz,side,ix,iz,ox,oz,y:hi});}}
    if(out.length>=n)break;}
  return out;
}
const yawTo=(dx,dz)=>Math.atan2(dx,-dz);

if(part.includes('B')){
  console.log('== B. 0.8.0 non modifiée : coût d\'une brèche dans un muret avec l\'arme de départ, puis sortie à pied');
  for(const label of ['v2-00','v2-01','v2-02']){
    const world=mk(W0,label);const probe=W0.FSimulation.create(world,{});const list=candidates(world,probe,3);
    for(const k of list.slice(0,2)){
      const sim=W0.FSimulation.create(world,{}),s=sim.state,p=s.player;p.x=k.ix;p.z=k.iz;p.y=k.y;p.yaw=yawTo(k.cx-k.ix,k.cz-k.iz);
      const mid=(k.c.minY+k.c.maxY)/2;p.pitch=Math.atan2(mid-(k.y+1.62),2.6-(k.alongX?(k.c.maxZ-k.c.minZ):(k.c.maxX-k.c.minX))/2);
      const ammo0=JSON.stringify(s.inventory?.ammo||null),w0=s.weapon;let shots=0,t=0,open=-1;
      for(let i=0;i<600;i++){sim.step(1/60,{fire:true,weapon:s.weapon,moveX:0,moveY:0});t+=1/60;shots+=s.events.filter(e=>e.name==='shot'||e.name==='fire').length;s.events.length=0;p.hp=sim.stats.maxHp;
        if(!sim.blocked(k.cx,k.cz,.28,k.y)){open=t;break;}}
      let out=null;if(open>=0){p.pitch=0;for(let i=0;i<400&&!s.dead;i++){sim.step(1/60,{moveX:0,moveY:1,sprint:true,weapon:s.weapon});s.events.length=0;p.hp=sim.stats.maxHp;if(!p.airborne&&authoredAt(world,p.x,p.z)===null&&Math.abs(p.y+.25)<.05){out=[+p.x.toFixed(1),+p.y.toFixed(2),+p.z.toFixed(1)];break;}}}
      console.log(label,'stage',world.stage,'muret h',(k.c.maxY-k.c.minY).toFixed(2),'arme',w0,'munitions avant',ammo0,'après',JSON.stringify(s.inventory?.ammo||null),'| ouvert après',open<0?'JAMAIS (10 s)':open.toFixed(2)+' s','tirs',shots,'| sortie à pied sur le substrat:',JSON.stringify(out),'mort',s.dead);
    }
  }
}

if(part.includes('C')){
  console.log('== C. proposition réelle (clip par destructibleId) : sauts contre un muret, puis brèche');
  for(const label of ['v2-00','v2-01','v2-02']){
    const world=mk(WP,label);const probe=WP.FSimulation.create(world,{});const list=candidates(world,probe,4);
    for(const clip of [false,true]){
      let tries=0,outs=0,onCrest=0,deaths=0,hits=0;
      for(const k of list)for(const back of [2.6,4,6])for(const jumpAt of [0,4,8,12,16,20,24,30,36,44])for(const lat of [-.8,0,.8]){
        const sim=WP.FSimulation.create(world,{}),s=sim.state,p=s.player,I=sim.__I;I.clipOn(clip);
        const sx=k.alongX?k.cx+lat:k.cx+k.side*back,sz=k.alongX?k.cz+k.side*back:k.cz+lat;if(authoredAt(world,sx,sz)===null||sim.blocked(sx,sz,.28,k.y))continue;
        p.x=sx;p.z=sz;p.y=k.y;p.yaw=yawTo(k.alongX?0:-k.side,k.alongX?-k.side:0);tries++;
        const input={moveX:0,moveY:1,sprint:true};let res=0;
        for(let i=0;i<150&&!s.dead;i++){input.jump=i>=jumpAt&&(i-jumpAt)%2===0;sim.step(1/60,input);s.events.length=0;p.hp=sim.stats.maxHp;
          if(!p.airborne){const a=authoredAt(world,p.x,p.z);if(a===null&&Math.abs(p.y+.25)<.05){res=1;break;}
            const dxw=p.x<k.c.minX?k.c.minX-p.x:p.x>k.c.maxX?p.x-k.c.maxX:0,dzw=p.z<k.c.minZ?k.c.minZ-p.z:p.z>k.c.maxZ?p.z-k.c.maxZ:0;if(Math.abs(p.y-k.c.maxY)<.05&&dxw*dxw+dzw*dzw<.28*.28){res=2;}}}
        if(s.dead)deaths++;else if(res===1)outs++;else if(res===2)onCrest++;hits+=I.clipHits();
      }
      console.log(label,'stage',world.stage,'h',(list[0].c.maxY-list[0].c.minY).toFixed(2),'clip',clip,'essais',tries,'sorties sur substrat',outs,'fin sur la crête',onCrest,'morts',deaths,'contacts clip',hits);
    }
    // brèche réelle au pistolet (tir en avançant) puis passage et retour, avec le clip de la proposition
    for(const variant of ['sans clip','clip (proposition telle quelle)']){
      const res=[];
      for(const k of list.slice(0,3)){
        const sim=WP.FSimulation.create(world,{}),s=sim.state,p=s.player,I=sim.__I;I.clipOn(variant!=='sans clip');
        p.x=k.ix;p.z=k.iz;p.y=k.y;p.yaw=yawTo(k.cx-k.ix,k.cz-k.iz);const H=k.c.maxY-k.c.minY;let out=-1;
        for(let i=0;i<480&&!s.dead;i++){const dist=Math.max(.6,Math.abs(k.alongX?p.z-k.cz:p.x-k.cx)-.26);p.pitch=Math.atan2(k.c.minY+H*.5-(p.y+1.62),dist);sim.step(1/60,{fire:true,weapon:s.weapon,moveX:0,moveY:1});s.events.length=0;p.hp=sim.stats.maxHp;if(!p.airborne&&authoredAt(world,p.x,p.z)===null&&Math.abs(p.y+.25)<.05){out=(i+1)/60;break;}}
        let back=-1;if(out>=0){p.pitch=0;for(let i=0;i<60;i++){sim.step(1/60,{moveX:0,moveY:1,sprint:true});s.events.length=0;}p.yaw+=Math.PI;for(let i=0;i<400&&!s.dead;i++){sim.step(1/60,{moveX:0,moveY:1,sprint:true});s.events.length=0;p.hp=sim.stats.maxHp;if(!p.airborne&&authoredAt(world,p.x,p.z)!==null&&Math.abs(p.y-k.y)<.05&&Math.hypot(p.x-k.ix,p.z-k.iz)<1.5){back=(i+1)/60;break;}}}
        res.push({'sortie par la brèche (s)':+out.toFixed(2),'retour (s)':+back.toFixed(2),mort:s.dead,contactsClip:I.clipHits()});
      }
      console.log(label,variant,JSON.stringify(res));
    }
  }
}
