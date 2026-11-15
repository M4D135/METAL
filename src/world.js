/* FERRO — deterministic architecture, constructed entirely from primitives. */
(function () {
  'use strict';
  // sin, cos, atan, atan2 and hypot come from FMath (src/fmath.js, loaded before
  // this file): the same bits on every platform, so a seed builds the same world
  // on x86-64, on arm64, in Chrome and in JavaScriptCore (Safari). hypot2 and
  // hypot3 keep the arity and the argument order of the former Math.hypot calls.
  // Math keeps only exact functions.
  const FMath = window.FMath;
  if (!FMath) throw new Error('FWorld: charger src/fmath.js avant src/world.js');
  // FPassages est lu au chargement, comme FMath : un banc qui installe `window`
  // le temps d'exécuter les modules puis le retire doit quand même pouvoir créer
  // un monde (checks/checkpoint.test.mjs, LOAD-01).
  const FPassages = window.FPassages, MetalProfiles = window.MetalProfiles;
  if (!FPassages) throw new Error('FWorld: charger src/passages.js avant src/world.js');
  const TAU = Math.PI * 2;
  const themes = [
    { title: 'La lisière rouillée', main: [0.12, 0.82, 0.78], alt: [1, 0.64, 0.24], wall: [0.33, 0.39, 0.36] },
    { title: 'La carrière des braises', main: [1, 0.35, 0.07], alt: [0.30, 0.68, 0.88], wall: [0.42, 0.29, 0.23] },
    { title: 'Les jardins du veilleur', main: [0.20, 0.67, 1], alt: [0.67, 0.42, 1], wall: [0.33, 0.36, 0.46] }
  ];
  // Different circulation graphs, outdoor silhouettes and built landmarks. The
  // traversable terraces are joined by ramps; lift shortcuts retain alternate routes.
  const layouts = [
    { id: 'woodland-maintenance-loops', xs: [-26, 0, 26], zs: [26, 0, -26], aperture: 5.2, outdoors:[0,1,3,6,7],
      edges: [[0,1],[1,2],[0,3],[1,4],[2,5],[3,6],[4,5],[5,8],[6,7],[7,8]],
      relays: [2,4,6], exit: 8,
      names: ['Lisière des pins','Cour des turbines','Archives de maintenance','Sentier des fougères','Relais de contrôle','Atelier abandonné','Bosquet des antennes','Jardin des pompes','Ascenseur de la carrière'] },
    { id: 'quarry-double-gallery', xs: [-42, -14, 14, 42], zs: [16, -16], aperture: 6, outdoors:[0,1,3,4,6],
      edges: [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[0,4],[2,6],[3,7]],
      relays: [3,5,6], exit: 7,
      names: ['Balcon de la carrière','Cour du convoyeur','Creuset principal','Faille des échangeurs','Sentier des scories','Halle des presses','Bassin de refroidissement','Ascenseur des jardins'] },
    { id: 'garden-observatory-hub', xs: [-29, 0, 29], zs: [29, 0, -29], aperture: 6, outdoors:[0,1,3,5,7],
      edges: [[0,1],[0,3],[1,2],[1,4],[2,5],[3,4],[3,6],[4,5],[4,7],[5,8],[6,7],[7,8]],
      relays: [2,4,6], exit: 8,
      names: ['Jardin des brumes','Verger des condensateurs','Relais de blindage','Clairière des stèles','Observatoire suspendu','Jardin des bobines','Relais de sûreté','Allée du veilleur','Arène du veilleur'] }
  ];
  function randomFor(seed, stage) {
    let n = 2166136261;
    for (const c of String(seed) + ':' + stage) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return function () {
      n |= 0; n = n + 0x6D2B79F5 | 0;
      let t = Math.imul(n ^ n >>> 15, 1 | n);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function create(seed, stage, options = {}) {
    const campaign=options?.campaign===true,index=campaign?Math.max(0,Math.min(17,Math.floor(stage||0))):null;
    stage = campaign?index%3:Math.max(0, Math.min(2, Math.floor(stage || 0)));
    const rand = randomFor(seed, campaign?index:stage), theme = themes[stage], original = layouts[stage];
    const layout = {...original, xs:original.xs.map(x=>x*1.6), zs:original.zs.map(z=>z*1.6)};
    const levels = [[0,0,3.2,0,3.2,3.2,3.2,6.4,6.4],[0,0,3.2,6.4,0,6.4,3.2,6.4],[0,0,3.2,0,3.2,6.4,3.2,6.4,6.4]][stage];
    const liftEdges = [[[1,4],[6,7]],[[1,2],[2,3]],[[1,4],[4,7]]][stage];
    const mechanisms=[], doors=[], lifts=[], jumpPads=[], surfaces=[];
    const meshes = [], lights = [], colliders = [], rooms = [], corridors = [], connections = [];
    const cores = [], enemies = [], pickups = [], machinery = [], hazards = [], trees=[], outdoorBoundaries=[], aperture = layout.aperture;
    let outdoorContext=false,regionContext='';
    const doorHeight = [3.7,4.8,4.4][stage];
    const mesh = (shape, p, s, mat, r, emissive, color) => {
      const m = { shape, p, s, mat };
      if (r) m.r = r;
      if (emissive) m.emissive = emissive;
      if (color) m.color = color;
      m.outdoor=outdoorContext;if(regionContext)m.region=regionContext;
      meshes.push(m); return m;
    };
    const box = (x, y, z, w, h, d, mat, solid, color, emit) => {
      const m=mesh('box', [x, y, z], [w, h, d], mat, null, emit, color);
      if (solid) {m.solid=true;colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y - h / 2, maxY: y + h / 2, mesh:meshes.length-1 });}
      return m;
    };
    const pipe = (x, y, z, length, radius, axis, mat) => mesh('cylinder', [x, y, z], [radius * 2, length, radius * 2], mat, axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : null);
    const light = (x, y, z, color, power) => lights.push({ p: [x, y, z], color, power, region:regionContext });
    const mark=(m,category,region)=>{m.category=category;if(region!==undefined)m.region=region;return m;};
    function limb(a,b,radius,mat=10,category='branch',region) {
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=FMath.hypot3(dx,dy,dz);
      return mark(mesh('cylinder',[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[radius*2,length,radius*2],mat,
        [FMath.atan2(dz,FMath.hypot2(dx,dy)),0,FMath.atan2(-dx,dy)]),category,region);
    }
    function tree(x,z,height,species,region,solid=true) {
      const width=species==='pine'?.72:species==='birch'?.45:.86,lean=(rand()-.5)*.6;
      const color=species==='birch'?[.57,.58,.49]:stage===1?[.33,.24,.16]:[.27,.23,.16];
      const first=meshes.length;
      mark(box(x,1.45,z,width,2.9,width,10,solid,color),'trunk',region);
      limb([x,2.2,z],[x+lean,height*.92,z+lean*.4],width*.38,10,'trunk',region).color=color;
      // Root flare stays within a compact, visibly grounded tree footprint.
      for(let i=0;i<5;i++) {
        const a=i*TAU/5+rand()*.25;
        limb([x,.25,z],[x+FMath.cos(a)*.64,.065,z+FMath.sin(a)*.64],.09,10,'root',region);
      }
      if(species==='pine') {
        for(let k=0;k<4;k++) {
          const y=height*(.47+k*.135),spread=height*(.52-k*.085);
          mark(mesh('octa',[x+lean*k/4,y,z],[spread,height*.47,spread],11,[0,rand()*TAU,0],0,[.15+k*.018,.30+k*.023,.20+k*.012]),'canopy',region);
          for(let q=0;q<3;q++) {
            const a=q*TAU/3+k*1.2;
            limb([x,y-.35,z],[x+FMath.cos(a)*spread*.34,y-.02,z+FMath.sin(a)*spread*.34],.055,10,'branch',region);
          }
        }
      } else {
        const bare=species==='dead',count=bare?5:6;
        for(let i=0;i<count;i++) {
          const a=i*TAU/count+.45,reach=height*(.23+rand()*.10),y=height*(.58+rand()*.22);
          const bx=x+FMath.cos(a)*reach+lean,bz=z+FMath.sin(a)*reach;
          limb([x+lean*.4,height*(.40+i*.035),z],[bx,y,bz],bare?.10:.12,10,'branch',region);
          limb([bx,y,bz],[bx+FMath.cos(a+.4)*.65,y+.65,bz+FMath.sin(a+.4)*.65],.045,10,'twig',region);
          if(!bare) {
            const green=species==='birch'?[.38,.46,.22]:stage===2?[.28,.41,.32]:[.22,.38,.23];
            mark(mesh('sphere',[bx,y+.35,bz],[height*.47,height*.35,height*.44],11,[0,a,0],0,green),'canopy',region);
            mark(mesh('octa',[bx+.3,y+.72,bz-.25],[height*.39,height*.31,height*.37],11,[.2,a+.5,.1],0,green.map(v=>v*1.13)),'canopy',region);
          }
        }
      }
      trees.push({x,z,height,species,region,solid,mesh:first,meshCount:meshes.length-first,phase:rand()*TAU});
    }
    function boulder(x,z,w,h,d,region,solid=true) {
      // A low square rock core is the exact collision shape; faceted caps sit
      // above it and never hide an invisible larger rectangle around the player.
      mark(box(x,h*.34,z,w*.72,h*.68,d*.72,9,solid),'rock_core',region);
      mark(mesh('octa',[x,h*.66,z],[w,h*.95,d],9,[.1,rand()*TAU,.08],0,stage===1?[.52,.38,.24]:[.36,.41,.37]),'boulder',region);
      mark(mesh('octa',[x+w*.20,h*.34,z-d*.14],[w*.7,h*.67,d*.8],9,[0,rand()*TAU,.15]),'boulder',region);
    }
    function boundary(x,z,length,alongX,region,side) {
      const height=stage===1?1.55:stage===2?.94:.72,thickness=stage===1?.8:.52;
      const m=mark(box(x,height/2,z,alongX?length:thickness,height,alongX?thickness:length,9,true,
        stage===1?[.42,.30,.20]:stage===2?[.36,.42,.43]:[.35,.38,.30]),'boundary',region);
      outdoorBoundaries.push({x,z,length,alongX,height,thickness,region,side,mesh:meshes.length-1});
      mark(box(x,height+.045,z,alongX?length+.05:thickness+.12,.09,alongX?thickness+.12:length+.05,stage===1?9:3,false),'boundary_cap',region);
      const posts=Math.max(1,Math.ceil(length/(stage===2?2.5:3.2)));
      for(let j=0;j<=posts;j++) {
        const t=(j/posts-.5)*Math.max(0,length-.18),px=x+(alongX?t:0),pz=z+(alongX?0:t);
        mark(box(px,height+.38,pz,.10,.75,.10,stage===2?1:0,false),'fence_post',region);
        if(stage===1)mark(mesh('octa',[px,.86,pz],[1.3,2.1,1.2],9,[0,j*.45,0]),'retaining_rock',region);
      }
      for(const y of [height+.17,height+.62])mark(box(x,y,z,alongX?length:.07,.065,alongX?.07:length,stage===2?1:0,false),'fence_rail',region);
      return m;
    }
    function lamp(x,z,region,tall=3.25) {
      mark(box(x,tall/2,z,.16,tall,.16,1,true),'lamp_post',region);
      mark(box(x,tall,z,.55,.18,.55,0,false),'lamp_head',region);
      mark(box(x,tall-.11,z,.44,.06,.44,5,false,theme.alt,.9),'lamp_glow',region);
      light(x,tall-.35,z,theme.alt,stage===2?7:4.5);
    }
    function exterior(r) {
      const region='room-'+r.id,ground=stage===1?[.43,.32,.20]:stage===2?[.24,.33,.27]:[.29,.35,.23];
      mark(box(r.x,-.22,r.z,r.w+.48,.44,r.d+.48,8,false,ground),'outdoor_floor',region);
      // Paths terminate at actual doors; dead ends become broad planting areas.
      for(const side of ['n','s','e','w']) {
        const alongX=side==='n'||side==='s',sign=side==='n'||side==='w'?-1:1,extent=alongX?r.w:r.d;
        const edgeX=r.x+(alongX?0:sign*r.w/2),edgeZ=r.z+(alongX?sign*r.d/2:0);
        const segments=r.openings[side]?[[ -(extent+aperture)/4,(extent-aperture)/2],[(extent+aperture)/4,(extent-aperture)/2]]:[[0,extent+.48]];
        for(const [offset,length] of segments)boundary(edgeX+(alongX?offset:0),edgeZ+(alongX?0:offset),length,alongX,region,side);
        if(r.openings[side]) {
          const length=(alongX?r.d:r.w)/2;
          mark(box(r.x+(alongX?0:sign*length/2),.007,r.z+(alongX?sign*length/2:0),alongX?4.3:length,.012,alongX?length:4.3,9,false,
            stage===1?[.49,.42,.31]:[.48,.47,.38]),'trail',region);
          for(const q of [-1,1]) {
            const px=edgeX+(alongX?q*(aperture/2+.33):0),pz=edgeZ+(alongX?0:q*(aperture/2+.33));
            mark(box(px,.75,pz,.31,1.5,.31,1,false),'gate_post',region);
            mark(box(px,1.49,pz,.34,.08,.34,4,false,theme.main,.45),'gate_beacon',region);
          }
        }
        const globalSide=(side==='w'&&r.x===layout.xs[0])||(side==='e'&&r.x===layout.xs[layout.xs.length-1])||(side==='s'&&r.z===layout.zs[0])||(side==='n'&&r.z===layout.zs[layout.zs.length-1]);
        if(globalSide&&!r.openings[side]) {
          // Hills and treelines are beyond the visible retaining barrier. Their
          // sculpted height is scenery, never an invisible walking elevation.
          for(let j=0;j<4;j++) {
            const t=(j/3-.5)*extent*.83,px=edgeX+(alongX?t:sign*(3.8+rand()*2)),pz=edgeZ+(alongX?sign*(3.8+rand()*2):t);
            if(stage===1) {
              const h=4.8+rand()*5;
              mark(mesh('octa',[px,h*.3,pz],[7+rand()*3,h,6+rand()*4],9,[0,rand()*TAU,.13],0,[.48,.34,.24]),'cliff',region);
              mark(mesh('box',[px,h*.32,pz],[5.7,h*.7,4.2],9,[0,rand()*.45,0],0,[.43,.30,.21]),'cliff_stratum',region);
            } else {
              mark(mesh('octa',[px,-.45,pz],[9,3.2+rand()*2,8],8,[0,rand()*TAU,0],0,ground),'hill',region);
              tree(px,pz,6+rand()*3.2,stage===0?'pine':'broadleaf',region,false);
            }
          }
        }
      }
      mark(mesh('cylinder',[r.x,.008,r.z],[5.6,.012,5.6],9,null,0,stage===1?[.49,.42,.31]:[.48,.47,.38]),'trail',region);
      // Corner groves and real cover leave >5 m wide circulation axes and all
      // objectives, initial enemy positions and warning vents unobstructed.
      for(const q of [-1,1])for(const k of [-1,1]) {
        const x=r.x+q*(r.w/2-3.0),z=r.z+k*(r.d/2-3.1);
        if(stage===1) {
          boulder(x,z,2.8+rand()*.6,1.9+rand()*1.2,2.4+rand()*.8,region);
          if(q===-1&&k===1)tree(x-q*1.3,z-k*1.8,4.3+rand()*1.1,'dead',region);
          if(q===1&&k===-1)tree(x-q*1.4,z-k*1.5,4.1+rand(),'pine',region);
        } else {
          const species=stage===0?(q===k?'pine':'birch'):(q===-1?'broadleaf':'birch');
          tree(x,z,5.7+rand()*2.1,species,region);
          if(q===k)boulder(x-q*1.5,z+k*.5,1.65,1.05,1.5,region);
        }
      }
      // Distinct industrial / archaeological landmarks occupy one side of each
      // outdoor place rather than repeating an identical kit in every room.
      const sx=r.x-r.w/2+1.4,sz=r.z+1.4;
      if(stage===0) {
        if(r.id===1||r.id===7) {
          const z=r.z-6.1;
          mark(box(r.x-5.1,.8,z,2.2,1.6,2.3,0,true),'pump_housing',region);
          mark(mesh('cylinder',[r.x-5.1,2.15,z],[1.6,1.15,1.6],1),'pump_tank',region);
          mark(mesh('ring',[r.x-5.1,2.68,z],[2,.18,2],0),'pump_tank',region);
          for(const q of [-1,1])limb([r.x-5.1+q*.5,1.7,z],[r.x-5.1+q*.5,1.7,z-2.2],.12,1,'pump_pipe',region);
          machinery.push({type:'fan',x:r.x-5.1,y:2.74,z,size:1.45,speed:.4,axis:'y'});
        } else {
          mark(box(sx,.7,sz,1.3,1.4,2.1,0,true),'supply_cache',region);
          mark(box(sx,.74,sz-1.06,1,.17,.025,4,false,theme.main,.35),'cache_screen',region);
          mark(box(sx,1.47,sz,1.45,.14,2.25,1,false),'cache_lid',region);
        }
        if(r.id===6) {
          const x=r.x+6,z=r.z-6;
          mark(box(x,3,z,.38,6,.38,1,true),'antenna',region);
          for(let j=0;j<3;j++)mark(box(x,4+j*.65,z,2.6-j*.5,.11,.11,0,false),'antenna',region);
          mark(mesh('sphere',[x,6.1,z],[.22,.22,.22],5,null,.6,theme.alt),'antenna_beacon',region);
        }
      } else if(stage===1) {
        const x=r.x-6.3,z=r.z-5.9;
        if(r.id===1||r.id===3) {
          for(const q of [-1,1])mark(box(x+q*2.1,2.3,z,.45,4.6,.7,1,true),'gantry_support',region);
          mark(box(x,4.6,z,5,.45,.9,1,false),'gantry_beam',region);
          for(let j=0;j<8;j++)mark(box(x+(j-3.5)*.55,4.9,z,.12,.14,1.05,0,false),'gantry_track',region);
          limb([x,4.45,z],[x,2.65,z],.065,0,'gantry_cable',region);
          mark(mesh('ring',[x,2.52,z],[.55,.1,.55],1,[Math.PI/2,0,0]),'gantry_hook',region);
        } else {
          mark(box(x,1,z,2.8,2,2,1,true),'ore_cart',region);
          for(const q of [-1,1])for(const k of [-1,1])mark(mesh('cylinder',[x+q*1.45,.4,z+k*.7],[.63,.14,.63],0,[0,0,Math.PI/2]),'ore_wheel',region);
          for(let j=0;j<4;j++)mark(mesh('octa',[x+(j%2-.5)*1.1,2.1,z+(Math.floor(j/2)-.5)*.8],[1.2,.8,1.0],9,[0,j,0]),'ore',region);
        }
        if(r.id===6) {
          mark(box(r.x+5.6,.45,r.z-5.5,3.8,.9,3.1,9,true),'basin',region);
          mark(box(r.x+5.6,.92,r.z-5.5,3.3,.025,2.6,12,false,[.21,.33,.35]),'water',region);
        }
      } else {
        const x=r.x-6.5,z=r.z-5.8;
        if(r.id===1||r.id===7) {
          for(const q of [-1,1]) {
            mark(box(x+q*1.65,1.8,z,.65,3.6,.65,3,true,[.46,.48,.43]),'ruin_column',region);
            mark(box(x+q*1.65,3.65,z,.9,.18,.9,1,false),'ruin_capital',region);
          }
          mark(box(x,3.83,z,4.3,.32,.8,3,false,[.46,.48,.43]),'ruin_arch',region);
          mark(mesh('sphere',[x,3.96,z],[3.3,.38,1.3],11,null,0,[.23,.37,.27]),'arch_ivy',region);
        } else {
          mark(box(x,.5,z,2.3,1,2.3,3,true,[.43,.47,.43]),'monument_base',region);
          mark(mesh('octa',[x,2.2,z],[1.5,3.1,1.5],9,[0,.3,0],0,[.41,.49,.52]),'monument',region);
          mark(mesh('ring',[x,2.5,z],[2.3,.13,2.3],1,[.5,.3,.4]),'monument_orbit',region);
          mark(mesh('sphere',[x,3.7,z],[.4,.4,.4],4,null,.4,theme.main),'monument_glow',region);
        }
        for(const q of [-1,1]) {
          const px=r.x+q*6,pz=r.z+6.0;
          mark(box(px,.3,pz,3.4,.6,1.4,9,true),'raised_bed',region);
          mark(box(px,.61,pz,3,.03,1,8,false,[.24,.25,.17]),'bed_earth',region);
          for(let j=0;j<4;j++)mark(mesh('octa',[px+(j-1.5)*.7,1.08,pz],[.95,.95,.8],11,[0,j,0],0,[.28,.45,.31]),'shrub',region);
        }
      }
      lamp(r.x+r.w/2-.9,r.z-2.8,region,stage===1?4:3.25);
      lamp(r.x-r.w/2+.9,r.z+3.8,region,stage===1?4:3.25);
    }
    function outsidePath(c,horizontal,length) {
      const region='corridor-'+(corridors.length-1);
      mark(box(c.x,-.22,c.z,c.w,.44,c.d,8,false,stage===1?[.43,.32,.20]:[.29,.35,.23]),'outdoor_floor',region);
      mark(box(c.x,.007,c.z,horizontal?length:4.3,.012,horizontal?4.3:length,9,false,stage===1?[.49,.42,.31]:[.48,.47,.38]),'trail',region);
      for(const q of [-1,1]) {
        const x=c.x+(horizontal?0:q*(aperture/2+.24)),z=c.z+(horizontal?q*(aperture/2+.24):0);
        // Short retaining sections follow a ramp without a single tall wall
        // obscuring its entire lower end. Their solids remain exact visible boxes.
        const segments=Math.max(1,Math.ceil(length/4.5));
        for(let j=0;j<segments;j++) {
          const offset=((j+.5)/segments-.5)*length;
          boundary(x+(horizontal?offset:0),z+(horizontal?0:offset),length/segments+.015,horizontal,region,q<0?'left':'right');
        }
        if(length>7)lamp(x, z,region,2.8);
      }
    }
    for (let row = 0; row < layout.zs.length; row++) for (let col = 0; col < layout.xs.length; col++) {
      const id = row * layout.xs.length + col;
      let w, d, h, archetype;
      if (stage === 0) {
        w = 14.4 + rand() * 1.7; d = 14.6 + rand() * 1.5; h = 5.4 + rand() * 0.6;
        archetype = id === 0 ? 'airlock' : id % 2 ? 'workshop' : 'service';
      } else if (stage === 1) {
        const large = id === 2 || id === 5;
        w = (large ? 18 : 15.1) + rand(); d = (large ? 18 : 15.8) + rand(); h = large ? 8.4 : 6.7;
        archetype = large ? 'furnace' : id % 2 ? 'valves' : 'boiler';
      } else {
        w = (id === 4 ? 21 : id === 8 ? 22 : 15) + rand() * 0.8;
        d = (id === 4 ? 21 : id === 8 ? 20 : 15) + rand() * 0.8;
        h = id === 4 ? 10 : id === 8 ? 8.6 : 6.6;
        archetype = id === 4 ? 'reactor' : id === 8 ? 'arena' : 'capacitor';
      }
      const outdoor=layout.outdoors.includes(id);
      if(outdoor){w=(stage===0?21.8:stage===1?22.6:23.3)+rand()*.9;d=(stage===0?22.1:stage===1?24.1:23.5)+rand()*.9;h=0;archetype=stage===0?(id===0?'woodland':'forest-yard'):stage===1?'quarry-yard':'garden';}
      rooms.push({ id, x: layout.xs[col], z: layout.zs[row], y:levels[id], w, d, h, name: layout.names[id], archetype, outdoor, openings: {} });
    }
    for (const [aId, bId] of layout.edges) {
      const a = rooms[aId], b = rooms[bId];
      if (a.x < b.x) { a.openings.e = true; b.openings.w = true; }
      else if (a.x > b.x) { a.openings.w = true; b.openings.e = true; }
      else if (a.z > b.z) { a.openings.n = true; b.openings.s = true; }
      else { a.openings.s = true; b.openings.n = true; }
    }
    // The colossal guardian has its own open-air branch, outside the compact
    // service rooms. This opening is authored with the wall, never hidden later.
    rooms[[5,3,5][stage]].openings.e=true;
    // Wall segments include solid collision; inset panels are kept inside those bounds.
    function wall(r, side, opening) {
      const alongX = side === 'n' || side === 's';
      const extent = alongX ? r.w : r.d;
      const sign = side === 'n' || side === 'w' ? -1 : 1;
      const edgeX = alongX ? r.x : r.x + sign * r.w / 2;
      const edgeZ = alongX ? r.z + sign * r.d / 2 : r.z;
      const segments = opening ? [
        [-(extent + aperture) / 4, (extent - aperture) / 2],
        [(extent + aperture) / 4, (extent - aperture) / 2]
      ] : [[0, extent + 0.48]];
      for (const [offset, length] of segments) {
        const x = edgeX + (alongX ? offset : 0), z = edgeZ + (alongX ? 0 : offset);
        box(x, r.h / 2, z, alongX ? length : 0.66, r.h, alongX ? 0.66 : length, 3, true, theme.wall);
        // Recessed wall cladding and narrow warm industrial edge lamps.
        const ix = x + (alongX ? 0 : -sign * 0.331), iz = z + (alongX ? -sign * 0.331 : 0);
        box(ix, 2.25, iz, alongX ? Math.max(0.8, length - 0.45) : 0.018, 2.25, alongX ? 0.018 : Math.max(0.8, length - 0.45), 0, false);
        box(ix, 0.55, iz, alongX ? Math.max(0.8, length - 0.22) : 0.025, 0.055, alongX ? 0.025 : Math.max(0.8, length - 0.22), 5, false, theme.alt, 0.45);
        box(ix, 3.68, iz, alongX ? Math.max(0.6, length - 0.8) : 0.03, 0.085, alongX ? 0.03 : Math.max(0.6, length - 0.8), 4, false, theme.main, 0.75);
        const divisions = Math.max(1, Math.floor(length / 2.4));
        for (let i = 0; i < divisions; i++) {
          const k = (i + 0.5) / divisions * length - length / 2;
          box(ix + (alongX ? k : 0), 2.25, iz + (alongX ? 0 : k), alongX ? 0.05 : 0.035, 2.5, alongX ? 0.035 : 0.05, 1, false);
          if (stage === 1) {
            // Deep-looking glowing furnace inspection slots with a solid back plate.
            const px = ix + (alongX ? k : 0), pz = iz + (alongX ? 0 : k);
            box(px, 1.9, pz, alongX ? 0.75 : 0.04, 0.72, alongX ? 0.04 : 0.75, 5, false, theme.main, 0.7);
            for (const j of [-1,0,1]) box(px + (alongX ? j * 0.23 : 0), 1.9, pz + (alongX ? 0 : j * 0.23), alongX ? 0.075 : 0.06, 0.85, alongX ? 0.06 : 0.075, 0, false);
          } else if (stage === 2) {
            box(ix + (alongX ? k : 0), 2.25, iz + (alongX ? 0 : k), alongX ? 0.14 : 0.04, 1.65, alongX ? 0.04 : 0.14, 4, false, theme.main, 0.55);
          }
        }
      }
      if (opening) {
        box(edgeX, (r.h + doorHeight) / 2, edgeZ, alongX ? aperture : 0.48, r.h - doorHeight, alongX ? 0.48 : aperture, 0, true);
        box(edgeX, doorHeight+.02, edgeZ, alongX ? aperture + 0.12 : 0.58, 0.10, alongX ? 0.58 : aperture + 0.12, 4, false, theme.main, 1);
        for (const q of [-1, 1]) {
          const px = edgeX + (alongX ? q * (aperture / 2 + 0.15) : 0);
          const pz = edgeZ + (alongX ? 0 : q * (aperture / 2 + 0.15));
          box(px, doorHeight/2, pz, alongX ? 0.23 : 0.65, doorHeight, alongX ? 0.65 : 0.23, 1, false);
          box(px + (alongX ? 0 : -sign * 0.325), 2.9, pz + (alongX ? -sign * 0.325 : 0), alongX ? 0.11 : 0.025, 0.65, alongX ? 0.025 : 0.11, 5, false, theme.alt, 0.75);
        }
      }
    }
    for (const r of rooms) {
      regionContext='room-'+r.id;
      if(r.outdoor){outdoorContext=true;exterior(r);outdoorContext=false;continue;}
      mark(box(r.x, -0.22, r.z, r.w + 0.48, 0.44, r.d + 0.48, 2, false),'floor',regionContext);
      mark(box(r.x, r.h + 0.17, r.z, r.w + 0.5, 0.34, r.d + 0.5, 0, true),'ceiling',regionContext);
      for (const side of ['n','s','e','w']) wall(r, side, r.openings[side]);
      // Three overhead ribs and four supply lines create depth above the player.
      for (const k of [-1, 0, 1]) {
        box(r.x, r.h - 0.35, r.z + k * r.d * 0.3, r.w, 0.45, 0.3, 1, false);
        box(r.x, r.h - 0.61, r.z + k * r.d * 0.3, r.w * 0.55, 0.06, 0.16, 4, false, theme.main, 0.75);
      }
      for (const q of [-1, 1]) {
        pipe(r.x + q * (r.w / 2 - 1), r.h - 0.9, r.z, r.d, 0.17, 'z', 1);
        pipe(r.x + q * (r.w / 2 - 1.5), r.h - 0.9, r.z, r.d, 0.10, 'z', 0);
        for (const k of [-1, 1]) {
          const px = r.x + q * (r.w / 2 - 0.65), pz = r.z + k * (r.d / 2 - 0.65);
          box(px, r.h / 2, pz, 0.85, r.h, 0.85, 1, true);
          box(px, 0.13, pz, 1.15, 0.26, 1.15, 0, true);
        }
      }
      // Thin floor inlays show the circulation axes without obstructing movement.
      for (const q of [-1, 1]) {
        box(r.x + q * 2, 0.012, r.z, 0.065, 0.018, r.d - 1, 5, false, theme.alt, 0.25);
        box(r.x, 0.015, r.z + q * 2, r.w - 1, 0.018, 0.065, 5, false, theme.alt, 0.25);
      }
      // A pair of genuine solid equipment stacks leave the entire central cross free.
      for (const q of [-1, 1]) {
        const x = r.x + q * (r.w / 2 - 2), z = r.z + (r.id % 2 ? -1 : 1) * (r.d / 2 - 2);
        const h = (stage === 1 ? 2.5 : stage === 2 ? 1.9 : 1.1) + rand() * 0.55;
        box(x, h / 2, z, 1.65, h, 1.6, r.id % 2 ? 1 : 0, true);
        box(x, h + 0.04, z, 1.72, 0.08, 1.67, 1, false);
        box(x, h * 0.72, z - Math.sign(z - r.z) * 0.805, 0.9, 0.10, 0.018, 4, false, theme.main, 0.8);
        if (stage === 1) {
          pipe(x, h + 0.9, z, 1.7, 0.46, 'y', 1);
          mesh('ring', [x, h + 1.65, z], [1.25,0.16,1.25], 0);
          box(x, 1.2, z - Math.sign(z-r.z)*0.81, 0.9, 0.65, 0.03, 5, false, theme.main, 0.95);
        } else if (stage === 2) {
          mesh('sphere', [x,h+0.35,z], [1,0.7,1], 4, null, 0.65, theme.main);
          mesh('ring', [x,h+0.34,z], [1.35,0.12,1.35], 1);
        } else {
          // Pallet feet and loose upper case read as maintenance equipment.
          box(x, 0.075, z, 1.95, 0.15, 1.85, 1, true);
          box(x + q*0.12, h+0.23, z, 1.1,0.38,1,0,false);
        }
      }
      decorate(r);
      light(r.x, 3.5, r.z, theme.main, r.id === 4 ? 13 : 10);
      light(r.x - 4.5, 2.6, r.z + 3.6, theme.alt, 6);
    }
    function decorate(r) {
      if (stage === 0) {
        const closed = ['n','w','s','e'].find(side=>!r.openings[side]);
        if (closed) {
          const axis = closed==='n'||closed==='s'?'z':'x', sign=closed==='n'||closed==='w'?-1:1;
          const x=r.x+(axis==='x'?sign*(r.w/2-.52):0),z=r.z+(axis==='z'?sign*(r.d/2-.52):0),rot=axis==='z'?[Math.PI/2,0,0]:[0,0,Math.PI/2];
          mesh('ring',[x,2.85,z],[2.8,.28,2.8],1,rot);
          machinery.push({type:'fan',x,y:2.85,z,size:2.35,speed:.8+rand()*.6,axis});
        }
        if (r.id%2) {
          machinery.push({type:'fan',x:r.x,y:r.h-.9,z:r.z,size:2.8,speed:.9,axis:'y'});
          mesh('ring',[r.x,r.h-.9,r.z],[3.2,.2,3.2],0);
          pipe(r.x,4.2,r.z+3,r.w-1.5,.28,'x',1);
          for (const q of [-1,1]) mesh('ring',[r.x+q*3,4.2,r.z+3],[.85,.12,.85],0,[0,0,Math.PI/2]);
        }
        // Open service recesses along solid side-wall segments, framed in bronze.
        for (const q of [-1,1]) {
          const x=r.x+q*(r.w/2-.75),z=r.z-3.9;
          box(x,1.05,z,.75,2.1,1.55,0,true);
          box(x-q*.385,1.45,z,.025,.55,1.1,4,false,theme.main,.45);
          for(let k=0;k<3;k++)box(x-q*.4,.8+k*.18,z,.035,.045,1,1,false);
        }
      } else if (stage === 1) {
        // Boiler headers, heavy suspended presses and side-mounted valve wheels.
        for (const q of [-1,1]) {
          const x=r.x+q*(r.w/2-1.7),z=r.z-2.9;
          box(x,1.65,z,1.3,3.3,1.6,0,true);
          pipe(x,4.25,z,2.2,.46,'y',1);
          mesh('ring',[x-q*.69,1.75,z],[1.1,.16,1.1],6,[0,0,Math.PI/2],.15);
          pipe(x,5.3,r.z,r.d-2,.22,'z',1);
          machinery.push({type:'piston',x:r.x+q*3.5,y:4.25,z:r.z,size:1.4,speed:.8+(r.id%3)*.2,axis:'y'});
          box(r.x+q*3.5,5.5,r.z,1.1,1.2,1.1,0,false);
        }
        if (r.archetype==='furnace') {
          mesh('ring',[r.x,6.15,r.z],[6,.35,6],1);
          mesh('ring',[r.x,6.05,r.z],[5.3,.15,5.3],5,null,1.1,theme.main);
          for(let i=0;i<8;i++){
            const a=i*TAU/8;
            pipe(r.x+FMath.cos(a)*2.85,7.2,r.z+FMath.sin(a)*2.85,2.1,.1,'y',0);
          }
          machinery.push({type:'fan',x:r.x,y:6.1,z:r.z,size:4.8,speed:.35,axis:'y'});
        }
      } else {
        if (r.archetype==='reactor'||r.archetype==='arena') {
          const cy=r.archetype==='reactor'?5.3:5.8,diameter=r.archetype==='reactor'?8:6.5;
          mesh('ring',[r.x,cy,r.z],[diameter,.3,diameter],1);
          mesh('ring',[r.x,cy-.14,r.z],[diameter-.6,.13,diameter-.6],4,null,1.2,theme.main);
          mesh('ring',[r.x,cy+1.3,r.z],[diameter-1,.2,diameter-1],0);
          for(let i=0;i<8;i++){
            const a=i*TAU/8,px=r.x+FMath.cos(a)*diameter*.47,pz=r.z+FMath.sin(a)*diameter*.47;
            pipe(px,(cy+r.h)/2,pz,r.h-cy,.1,'y',1);
            mesh('octa',[px,cy+.6,pz],[.3,1,.3],4,null,.9,theme.main);
          }
          machinery.push({type:'reactor',x:r.x,y:cy+.3,z:r.z,size:3.3,speed:.25,axis:'y'});
          light(r.x,cy-.6,r.z,theme.alt,10);
          // The boss arena has genuine cover, with broad clear paths between pillars.
          if(r.archetype==='arena')for(const q of [-1,1])for(const k of [-1,1]){
            const x=r.x+q*5.8,z=r.z+k*5;
            box(x,1.15,z,1.1,2.3,1.1,0,true);
            box(x,2.35,z,1.4,.1,1.4,1,false);
            box(x,1.6,z+.56,.14,1,.025,4,false,theme.main,.6);
          }
        } else {
          for(const q of [-1,1]) {
            const x=r.x+q*(r.w/2-1.5),z=r.z-3.5;
            box(x,1.5,z,1.15,3,1.2,0,true);
            mesh('cylinder',[x,3.45,z],[.8,.9,.8],4,null,.6,theme.main);
            mesh('ring',[x,3.75,z],[1.3,.15,1.3],1);
          }
          if(r.id%2===0)machinery.push({type:'reactor',x:r.x,y:4.6,z:r.z,size:2,speed:.3,axis:'y'});
          for(const k of [-1,1])box(r.x,4.8,r.z+k*2.6,r.w-.6,.3,.34,3,false,theme.wall);
        }
      }
    }
    function liftPath(c,a,b,horizontal,index) {
      outdoorContext=true;
      const minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y),shaft=3.6;
      const aLow=a.y<b.y,axisSign=horizontal?1:-1,lowSign=aLow?-axisSign:axisSign;
      const length=horizontal?c.w:c.d,halfS=shaft/2;
      const at=(u,v=0)=>({x:c.x+(horizontal?u:v),z:c.z+(horizontal?v:u)});
      const low=at(lowSign*(halfS+1.1)),high=at(-lowSign*(halfS+1.1));
      const l={id:c.liftId,x:c.x,z:c.z,w:horizontal?shaft:aperture,d:horizontal?aperture:shaft,axis:horizontal?'x':'z',minY,maxY,speed:1.6,requires:'mechanism-'+index,lowerCall:{...low,y:minY},upperCall:{...high,y:maxY}};
      lifts.push(l);c.slopeX=0;c.slopeZ=0;c.y=minY;c.lowSign=lowSign;c.axis=horizontal?'x':'z';
      const fixed=m=>{m.fixedHeight=true;return m;};
      for(const sign of [-1,1]) {
        const len=(length-shaft)/2,center=sign*(halfS+len/2),p=at(center),y=sign===lowSign?minY:maxY;
        const f={...p,w:horizontal?len:c.w,d:horizontal?c.d:len,y,slopeX:0,slopeZ:0};surfaces.push(f);
        const floor=fixed(mark(box(p.x,y-.22,p.z,f.w,.44,f.d,2,false),'lift_dock',regionContext));floor.ground=true;
        for(const q of [-1,1]) {
          const edge=at(center,q*(aperture/2+.24));
          const m=fixed(mark(box(edge.x,y+.5,edge.z,horizontal?len:.48,1,horizontal?.48:len,9,true),'boundary',regionContext));
          outdoorBoundaries.push({x:edge.x,z:edge.z,length:len,alongX:horizontal,height:1,thickness:.48,region:regionContext,side:q,mesh:meshes.length-1});
          fixed(mark(box(edge.x,y+1.06,edge.z,horizontal?len:.55,.12,horizontal?.55:len,1,false),'dock_rail',regionContext));
        }
        for(const q of [-1,1]) {
          const p=at(sign*(halfS+.7),q*(aperture/2-.13));
          fixed(mark(box(p.x,y+1.05,p.z,.16,2.1,.16,1,false),'lift_indicator',regionContext));
          fixed(mark(box(p.x,y+1.97,p.z,.2,.14,.2,5,false,theme.alt,.7),'lift_indicator',regionContext));
        }
        for(let j=0;j<8;j++) {
          const p=at(sign*(halfS+.3),(j-3.5)*aperture/9);
          fixed(mark(box(p.x,y+.014,p.z,horizontal?.23:.12,.025,horizontal?.12:.23,5,false,theme.alt,.25),'dock_warning',regionContext));
        }
      }
      surfaces.push({x:c.x,z:c.z,w:l.w,d:l.d,y:minY,slopeX:0,slopeZ:0,liftId:l.id});
      const floor=fixed(mark(box(c.x,minY-.22,c.z,l.w,.44,l.d,0,false),'lift_shaft_floor',regionContext));floor.ground=true;
      for(const q of [-1,1]) {
        const p=at(0,q*(aperture/2+.24)),h=maxY-minY+1.2;
        fixed(mark(box(p.x,minY+h/2,p.z,horizontal?shaft:.48,h,horizontal?.48:shaft,0,true),'lift_shaft',regionContext));
        for(const sign of [-1,1]) {
          const p=at(sign*(halfS-.2),q*(aperture/2+.04));
          fixed(mark(box(p.x,minY+(maxY-minY+3)/2,p.z,.14,maxY-minY+3,.14,1,false),'lift_guide',regionContext));
          for(let j=0;j<10;j++)fixed(mark(box(p.x,minY+.3+j*(maxY-minY+2.4)/9,p.z,.22,.07,.22,3,false),'lift_guide_clamp',regionContext));
        }
        const p2=at(0,q*(aperture/2+.30));
        machinery.push({type:'piston',x:p2.x,y:minY+1.8,z:p2.z,size:.8,speed:.55,axis:'y',fixedHeight:true});
      }
      outdoorContext=false;
    }
    function connect(a, b, horizontal) {
      const start = horizontal ? a.x + a.w / 2 : a.z - a.d / 2;
      const end = horizontal ? b.x - b.w / 2 : b.z + b.d / 2;
      const length = Math.abs(end - start) + 0.5;
      const x = horizontal ? (start + end) / 2 : a.x;
      const z = horizontal ? a.z : (start + end) / 2;
      const w = horizontal ? length : aperture + 0.48, d = horizontal ? aperture + 0.48 : length;
      const ceiling = doorHeight+.2;
      const outdoor=a.outdoor||b.outdoor;
      const gap=length-.5,dy=b.y-a.y;
      const liftIndex=liftEdges.findIndex(e=>e.includes(a.id)&&e.includes(b.id));
      const c={x,z,w,d,outdoor,y:(a.y+b.y)/2,slopeX:horizontal?dy/gap:0,slopeZ:horizontal?0:-dy/gap};
      regionContext='corridor-'+corridors.length;
      if(liftIndex>=0)c.liftId='lift-'+liftIndex;
      corridors.push(c);
      connections.push({ from: a.id, to: b.id, x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: aperture, y1:a.y, y2:b.y, ...(liftIndex>=0?{liftId:c.liftId}:{}) });
      if(liftIndex>=0){liftPath(c,a,b,horizontal,liftIndex);return;}
      surfaces.push({x,z,w,d,y:c.y,slopeX:c.slopeX,slopeZ:c.slopeZ});
      if(outdoor){outdoorContext=true;outsidePath({x,z,w,d},horizontal,length);outdoorContext=false;return;}
      mark(box(x, -0.22, z, w, 0.44, d, 2, false),'floor',regionContext);
      // A stepped physical roof follows the sloping passage. Short matching
      // visible boxes give airborne bodies a real ceiling at every height.
      const roofSections=Math.max(1,Math.ceil(length/2.5)),roofLength=length/roofSections;
      for(let j=0;j<roofSections;j++){
        const u=((j+.5)/roofSections-.5)*length;
        mark(box(x+(horizontal?u:0),ceiling+.15,z+(horizontal?0:u),horizontal?roofLength+.01:w,.3,horizontal?d:roofLength+.01,0,true),'ceiling',regionContext);
      }
      for (const q of [-1, 1]) {
        box(x + (horizontal ? 0 : q * (aperture / 2 + 0.24)), ceiling/2, z + (horizontal ? q * (aperture / 2 + 0.24) : 0), horizontal ? length : 0.48, ceiling, horizontal ? 0.48 : length, 0, true);
        box(x + (horizontal ? 0 : q * (aperture / 2 - 0.02)), 0.32, z + (horizontal ? q * (aperture / 2 - 0.02) : 0), horizontal ? length : 0.05, 0.06, horizontal ? 0.05 : length, 4, false, theme.main, 0.8);
        pipe(x + (horizontal ? 0 : q * (aperture/2-.5)), ceiling-.45, z + (horizontal ? q * (aperture/2-.5) : 0), length, 0.12, horizontal ? 'x' : 'z', 1);
      }
      const ribs=Math.max(1,Math.floor(length/3));
      for(let i=0;i<ribs;i++){
        const offset=(i+.5)/ribs*length-length/2,px=x+(horizontal?offset:0),pz=z+(horizontal?0:offset);
        box(px, ceiling-.15, pz, horizontal ? 0.22 : aperture + 0.3, 0.3, horizontal ? aperture + 0.3 : 0.22, 1, false);
        box(px, ceiling-.34, pz, horizontal ? 0.18 : 2.6, 0.07, horizontal ? 2.6 : 0.18, 5, false, theme.alt, .9);
      }
      light(x, 2.7, z, theme.alt, 6);
    }
    for (const [aId,bId] of layout.edges) {
      let a=rooms[aId],b=rooms[bId];
      const horizontal=a.z===b.z;
      if((horizontal&&a.x>b.x)||(!horizontal&&a.z<b.z))[a,b]=[b,a];
      connect(a,b,horizontal);
    }
    for (const [i, roomId] of layout.relays.entries()) cores.push({ id:i, x:rooms[roomId].x, y:rooms[roomId].y, z:rooms[roomId].z });
    const spawn={x:rooms[0].x,y:rooms[0].y,z:rooms[0].z+3.2,yaw:0};
    const exitRoom=rooms[layout.exit],exit={x:exitRoom.x,y:exitRoom.y,z:exitRoom.z-exitRoom.d*.27};
    // Health caches and solid firing positions support the larger, distributed
    // garrisons. Clear central crosses remain available to both player and AI.
    for(const r of rooms) {
      regionContext='room-'+r.id;outdoorContext=r.outdoor;
      for(const q of [-1,1]) {
        const x=r.x+q*3.6,z=r.z-q*3.4;
        mark(box(x,.6,z,1.35,1.2,1.55,0,true),'combat_cover',regionContext);
        mark(box(x,1.24,z,1.48,.08,1.66,1,false),'cover_cap',regionContext);
        mark(box(x,.88,z+q*.79,.8,.12,.025,4,false,theme.main,.45),'cover_signal',regionContext);
      }
      for(const [dx,dz] of [[2.5,1.5],[-2.1,-1.5],[2.8,-4.7]])pickups.push({x:r.x+dx,y:r.y,z:r.z+dz,type:'health'});
      // Each hub has a visible animated mechanism, including outside areas.
      const x=r.x+3.6,z=r.z+5.4;
      mark(box(x,.48,z,1.05,.96,1.05,1,true),'ventilator_base',regionContext);
      mark(mesh('ring',[x,1.25,z],[1.35,.2,1.35],0),'ventilator_ring',regionContext);
      machinery.push({type:stage===1?'piston':'fan',x,y:1.3,z,size:1.05,speed:.5+(r.id%3)*.25,axis:'y'});
    }
    const mechanismRooms=[0,[3,4,3][stage],[5,6,5][stage]];
    const labels=[['Réseau de la lisière','Vanne des pompes','Accès de la carrière'],['Alimentation des treuils','Purge du creuset','Accès des jardins'],['Réveil des jardins','Circuit de l’observatoire','Verrou du veilleur']][stage];
    mechanismRooms.forEach((roomId,i)=>{
      const r=rooms[roomId],x=r.x+(i===0?1.45:-2.0),z=r.z+(i===0?1.4:3.0);
      const m={id:'mechanism-'+i,x,y:r.y,z,name:labels[i],kind:['breaker','valve','console'][i],yaw:0,required:true};
      mechanisms.push(m);regionContext='room-'+r.id;outdoorContext=r.outdoor;
      mark(box(x,.58,z,.72,1.16,.6,0,true),'mechanism_housing',regionContext);
      mark(box(x,1.18,z,.85,.11,.72,1,false),'mechanism_frame',regionContext);
      mark(box(x,.80,z+.308,.57,.40,.026,7,false),'mechanism_panel',regionContext);
      for(const q of [-1,1])mark(box(x+q*.32,1.48,z,.055,.55,.055,1,false),'mechanism_frame',regionContext);
      light(x,1.5,z+.3,theme.main,1.5);
    });
    // Doors occupy full corridor widths, with no static duplicate leaf. Every
    // control is reachable before its own barrier; the final gate is mandatory.
    const gateEdges=[[[0,1],[4,5],[5,8]],[[0,1],[5,6],[6,7]],[[0,1],[4,5],[7,8]]][stage];
    gateEdges.forEach((edge,i)=>{
      const index=connections.findIndex(c=>edge.includes(c.from)&&edge.includes(c.to)),c=corridors[index],link=connections[index];
      const horizontal=link.z1===link.z2;
      const y=c.y;
      doors.push({id:'door-'+i,x:c.x,y,z:c.z,w:horizontal?.34:aperture,d:horizontal?aperture:.34,h:3.1,requires:'mechanism-'+i});
      regionContext='corridor-'+index;outdoorContext=c.outdoor;
      for(const q of [-1,1])mark(box(c.x+(horizontal?0:q*(aperture/2+.08)),1.8,c.z+(horizontal?q*(aperture/2+.08):0),horizontal?.55:.16,3.6,horizontal?.16:.55,1,false),'gate_jamb',regionContext);
      // The bridge across the opening stays well above head height.
      mark(box(c.x,3.6,c.z,horizontal?.65:aperture+.4,.2,horizontal?aperture+.4:.65,0,false),'gate_header',regionContext);
    });
    // Auto-launch pads have real unobstructed ballistic arcs. Their destinations
    // are fixed terraces with alternate walking routes, never moving platforms.
    // The first one sits visibly ahead of the entry, outside the initial trigger.
    const padRoutes=[
      [[0,3,0,-8.4,0,5.4,1.5],[3,6,0,-8.4,0,5.4,1.65],[1,4,0,-8.4,0,5.4,1.5]],
      [[0,4,0,-8.4,0,5.4,1.5],[4,5,8.4,0,-5.4,0,1.75],[2,6,0,-8.4,0,5.4,1.5]],
      [[0,3,0,-8.4,0,5.4,1.5],[3,4,8.4,0,-5.4,0,1.45],[5,8,0,-8.4,0,5.4,1.5]]
    ][stage];
    padRoutes.forEach(([from,to,dx,dz,tx,tz,flightTime],i)=>{
      const a=rooms[from],b=rooms[to],x=a.x+dx,z=a.z+dz,target={x:b.x+tx,y:b.y,z:b.z+tz};
      const yaw=FMath.atan2(target.x-x,z-target.z),c=FMath.cos(yaw),sn=FMath.sin(yaw);
      const pad={id:'pad-'+i,x,y:a.y,z,r:1.15,target,flightTime,yaw};jumpPads.push(pad);
      regionContext='room-'+a.id;outdoorContext=a.outdoor;
      mark(mesh('cylinder',[x,.035,z],[2.45,.07,2.45],0,null,0,[.20,.24,.27]),'jump_pad_base',regionContext);
      mark(mesh('cylinder',[x,.075,z],[1.94,.035,1.94],7),'jump_pad_deck',regionContext);
      mark(mesh('ring',[x,.086,z],[2.28,.11,2.28],1,null,0,[.42,.36,.25]),'jump_pad_rim',regionContext);
      for(const v of [.30,-.10,-.50])for(const q of [-1,1]){
        const u=q*.12,px=x+c*u-sn*v,pz=z+sn*u+c*v;
        mark(mesh('box',[px,.106,pz],[.075,.018,.36],4,[0,-yaw+q*.58,0],.65,theme.main),'jump_pad_arrow',regionContext);
      }
      for(let j=0;j<3;j++){
        const angle=j*TAU/3+.4,px=x+FMath.cos(angle)*1.10,pz=z+FMath.sin(angle)*1.10;
        mark(mesh('box',[px,.06,pz],[.34,.08,.30],1,[0,-angle,0],0,[.43,.38,.29]),'jump_pad_clamp',regionContext);
        mark(mesh('box',[px,.105,pz],[.20,.018,.075],5,[0,-angle,0],.45,theme.alt),'jump_pad_signal',regionContext);
      }
      for(let j=0;j<6;j++){
        const angle=j*TAU/6;
        mark(mesh('cylinder',[x+FMath.cos(angle)*.90,.11,z+FMath.sin(angle)*.90],[.055,.03,.055],3),'jump_pad_bolt',regionContext);
      }
      regionContext='room-'+b.id;outdoorContext=b.outdoor;
      mark(mesh('ring',[target.x,.024,target.z],[3.55,.045,3.55],4,null,.22,theme.main),'jump_landing',regionContext);
    });
    // Vent danger is avoidable: all central circulation axes remain clear even
    // when every vent is hot. Players may take the outer corners at their risk.
    if(stage>0)for(const [i,roomId] of (stage===1?[1,2,5,6]:[2,3,4,5,6]).entries()){
      const r=rooms[roomId],x=r.x+(i%2?-1:1)*4.35,z=r.z+3.65,rad=stage===1?.82:.95;
      outdoorContext=r.outdoor;regionContext='room-'+r.id;
      hazards.push({type:'vent',x,y:r.y,z,r:rad,period:6.8+stage*.5+(i%3)*.6,active:1.45+stage*.15,phase:(i*1.7+rand()*1.1)});
      mesh('cylinder',[x,.023,z],[rad*2+.35,.045,rad*2+.35],0);
      mesh('ring',[x,.055,z],[rad*2+.48,.11,rad*2+.48],1);
      for(let j=-2;j<=2;j++)box(x+j*.25,.055,z,.10,.045,rad*1.5,7,false);
      for(const q of [-1,1])box(x+q*(rad+.21),.035,z,.07,.04,rad*1.5,5,false,theme.main,.45);
    }
    outdoorContext=false;regionContext='room-'+exitRoom.id;
    // Low energy rails frame the exit without putting a solid door on its trigger.
    for (const q of [-1, 1]) box(exit.x + q * 1.8, 1.5, exit.z, 0.16, 3, 0.35, 4, true, theme.main, 1);
    box(exit.x, 3, exit.z, 3.75, 0.16, 0.35, 4, false, theme.main, 1);
    const bounds={minX:Math.floor(Math.min(...rooms.map(r=>r.x-r.w/2))-.8),maxX:Math.ceil(Math.max(...rooms.map(r=>r.x+r.w/2))+.8),minZ:Math.floor(Math.min(...rooms.map(r=>r.z-r.d/2))-.8),maxZ:Math.ceil(Math.max(...rooms.map(r=>r.z+r.d/2))+.8)};
    const environments=[
      {biome:'woodland',skyTop:[.055,.105,.14],skyBottom:[.20,.25,.22],fog:[.15,.205,.18],sunDirection:[-.48,.78,.36],sunColor:[.48,.62,.59],ambient:[.18,.23,.20],wind:.7,weather:'pollen'},
      {biome:'quarry',skyTop:[.11,.07,.08],skyBottom:[.35,.16,.09],fog:[.23,.13,.09],sunDirection:[-.65,.56,-.36],sunColor:[.66,.33,.15],ambient:[.22,.15,.12],wind:1.1,weather:'ash'},
      {biome:'garden',skyTop:[.025,.035,.08],skyBottom:[.14,.16,.26],fog:[.10,.135,.22],sunDirection:[.42,.45,-.79],sunColor:[.36,.48,.74],ambient:[.14,.18,.26],wind:.45,weather:'motes'}
    ];
    const environment={...environments[stage],outdoorZones:rooms.concat(corridors).filter(r=>r.outdoor).map(({x,z,w,d})=>({x,z,w,d}))};
    const [sunX,sunY,sunZ]=environment.sunDirection,sunLength=FMath.hypot3(sunX,sunY,sunZ);
    environment.sunDirection=environment.sunDirection.map(v=>v/sunLength);
    const world={ seed, stage, generation:6, topologyId:layout.id, title: theme.title, meshes, lights, colliders, rooms, corridors, connections, spawn, exit, cores, enemies, pickups, machinery, hazards, trees, outdoorBoundaries, environment, bounds, mechanisms, doors, lifts, jumpPads, walkable:rooms.map(({x,z,w,d,y})=>({x,z,w,d,y,slopeX:0,slopeZ:0})).concat(surfaces) };
    if(campaign)Object.assign(world,{campaign:true,...(options.campaignVersion===2?{campaignVersion:2}:{}),index,chapter:Math.floor(index/3),chapterTitle:['L’Éveil des forges','La Garde de fer','La Chasse mécanique','Les Forges brisées','La Fournaise','Le Dernier signal'][Math.floor(index/3)]});
    if(campaign)world.campaignProfile=campaignProfile(world);
    detailWorld(world,theme,aperture,doorHeight);
    naturalDetails(world,theme);
    elevateWorld(world);
    arenaWorld(world,theme,aperture);
    demolitionWorld(world,theme,options?.legacyTraps===true);
    shopsWorld(world,theme);
    reinforcementBays(world,theme);
    suppliesWorld(world);
    populate(world);
    armoryWorld(world);
    if(campaign){campaignArmory(world);campaignTrophies(world,theme);campaignArmor(world);}
    polishTrees(world);
    demolitionMetadata(world,options?.legacyTraps===true);
    if(options?.profiles===true){if(!MetalProfiles)throw new Error("Load profiles.js before creating a class expedition");MetalProfiles.world(world);}
    world.detailStats.added=world.meshes.length-world.detailStats.base;
    world.detailStats.tiers=[0,1,2].map(level=>world.meshes.filter(m=>(m.detail||0)===level).length);
    return world;
  }
  // This independent art pass does not consume the layout/combat RNG. Interior
  // fittings remain attached to existing solids, flat on the floor or overhead;
  // open-air rooms and links deliberately receive none of this ceiling network.
  function detailWorld(w,theme,aperture,doorHeight) {
    const rand=randomFor('FERRO-detail-03:'+w.seed,w.campaign===true?w.index:w.stage),out=w.meshes,baseCount=out.length;
    const ambience=[],categories={},roomCounts={};
    const axes={x:[0,0,-Math.PI/2],y:[0,0,0],z:[Math.PI/2,0,0]};
    let owner='',outside=false;
    function add(shape,p,s,mat=0,r=[0,0,0],detail=1,category='pipe',emissive=0,color) {
      const mesh={shape,p,s,mat,r,detail,category,outdoor:outside,region:owner};
      if(emissive)mesh.emissive=emissive;if(color)mesh.color=color;
      out.push(mesh);categories[category]=(categories[category]||0)+1;
      if(owner)roomCounts[owner]=(roomCounts[owner]||0)+1;
      return mesh;
    }
    const box=(p,s,mat=0,detail=1,category='panel',r=[0,0,0],emissive=0,color)=>add('box',p,s,mat,r,detail,category,emissive,color);
    function tube(a,b,radius,mat=1,category='pipe',detail=1) {
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=FMath.hypot3(dx,dy,dz);
      if(length<.005)return;
      return add('cylinder',[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[radius*2,length,radius*2],mat,
        [FMath.atan2(dz,FMath.hypot2(dx,dy)),0,FMath.atan2(-dx,dy)],detail,category);
    }
    function flange(p,radius,axis,bolts=true) {
      const rotation=axes[axis];
      add('cylinder',p,[radius*2.8,.075,radius*2.8],1,rotation,1,'flange');
      add('ring',p,[radius*3.3,.14,radius*3.3],0,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0],1,'flange');
      if(bolts)for(let j=0;j<4;j++) {
        const a=j*TAU/4+.785,c=FMath.cos(a)*radius*1.2,s=FMath.sin(a)*radius*1.2;
        const at=axis==='x'?[p[0]+.045,p[1]+c,p[2]+s]:axis==='z'?[p[0]+c,p[1]+s,p[2]+.045]:[p[0]+c,p[1]+.045,p[2]+s];
        add('cylinder',at,[.065,.035,.065],3,rotation,2,'bolt');
      }
    }
    function elbow(cx,y,cz,radius,start,end,thickness,mat=1) {
      for(let j=0;j<5;j++) {
        const a=start+(end-start)*j/5,b=start+(end-start)*(j+1)/5;
        tube([cx+FMath.cos(a)*radius,y,cz+FMath.sin(a)*radius],[cx+FMath.cos(b)*radius,y,cz+FMath.sin(b)*radius],thickness,mat,'elbow');
      }
    }
    function surface(x,z,nx,nz) {
      const tx=nz,tz=-nx;
      const at=(u,y,d=0)=>[x+tx*u+nx*d,y,z+tz*u+nz*d];
      const plate=(u,y,d,width,height,depth,mat,category,detail=1,emit=0,color)=>
        box(at(u,y,d),nx?[depth,height,width]:[width,height,depth],mat,detail,category,[0,0,0],emit,color);
      const bolt=(u,y,d=.06)=>add('cylinder',at(u,y,d),[.055,.024,.055],1,nx?axes.x:axes.z,2,'bolt');
      return {at,plate,bolt,nx,nz,tx,tz};
    }
    function gauge(s,u,y) {
      const rot=s.nx?axes.x:axes.z;
      add('cylinder',s.at(u,y,.055),[.34,.07,.34],0,rot,1,'gauge');
      add('cylinder',s.at(u,y,.096),[.28,.014,.28],3,rot,2,'gauge',0,[.56,.61,.55]);
      for(let k=0;k<8;k++) {
        const a=(k/7*1.5+.25)*Math.PI;
        s.plate(u+FMath.cos(a)*.11,y+FMath.sin(a)*.11,.108,.024,.024,.012,0,'gauge',2);
      }
      const a=.4+rand()*1.9,centre=s.at(u+FMath.sin(a)*.043,y+FMath.cos(a)*.043,.12);
      box(centre,s.nx?[.016,.13,.018]:[.018,.13,.016],6,2,'gauge',s.nx?[a,0,0]:[0,0,-a]);
    }
    function servicePanel(s,u,y,width,screen,room) {
      s.plate(u,y,.018,width,1.08,.035,1,'panel');
      s.plate(u,y,.042,width-.09,.98,.025,0,'panel');
      for(const q of [-1,1])for(const k of [-1,1])s.bolt(u+q*(width/2-.09),y+k*.44,.067);
      if(screen) {
        s.plate(u-.12,y+.1,.062,width*.68,.57,.022,7,'screen');
        s.plate(u-.12,y+.1,.076,width*.61,.48,.012,4,'screen',1,.14,theme.main.map(c=>c*.2));
        for(let j=0;j<4;j++) {
          const len=.22+rand()*width*.27;
          s.plate(u-width*.27+len/2,y+.25-j*.105,.086,len,.018,.012,4,'screen',len<=.3?2:1,.48,theme.main);
        }
        for(let j=0;j<4;j++)s.plate(u-width*.26+j*.16,y-.32,.067,.09,.065,.025,j===3?5:3,'switch',2,j===3?.4:0);
        // At most one animated display per room; its normal avoids wall clipping.
        if(!ambience.some(a=>a.type==='screen'&&a.room===room.id)) {
          const p=s.at(u-.12,y+.1,.096);
          ambience.push({type:'screen',x:p[0],y:p[1],z:p[2],phase:rand()*TAU,scale:1,color:theme.main,normal:[s.nx,0,s.nz],width:width*.58,height:.44,room:room.id});
        }
      } else {
        for(let j=0;j<7;j++)s.plate(u,y-.33+j*.11,.07,width-.3,.035,.075,7,'louver');
        s.plate(u,y+.56,.055,width-.15,.085,.04,3,'panel',1,0,theme.wall);
      }
    }
    function cableTray(r,x,z,length,axis,drop=0) {
      const y=r.h-.78-drop,width=.64,alongX=axis==='x';
      for(const q of [-1,1])box([x+(alongX?0:q*width/2),y,z+(alongX?q*width/2:0)],alongX?[length,.15,.065]:[.065,.15,length],0,1,'cable_tray');
      const rungs=Math.ceil(length/.8);
      for(let j=0;j<=rungs;j++) {
        const p=(j/rungs-.5)*length;
        box([x+(alongX?p:0),y-.07,z+(alongX?0:p)],alongX?[.07,.055,width]:[width,.055,.07],1,1,'cable_tray');
      }
      for(let k=-1;k<=1;k++) {
        const a=[x+(alongX?-length/2:k*.16),y+.025,z+(alongX?k*.16:-length/2)],b=[x+(alongX?length/2:k*.16),y+.025,z+(alongX?k*.16:length/2)];
        const cable=tube(a,b,.037,k===0?1:7,'cable');
        if(k===1)cable.color=[.12,.25,.27];
      }
      for(const q of [-1,0,1]) {
        const px=x+(alongX?q*length*.38:0),pz=z+(alongX?0:q*length*.38);
        for(const k of [-1,1])box([px+(alongX?0:k*.43),(y+r.h)/2,pz+(alongX?k*.43:0)],[.05,r.h-y,.05],1,1,'support');
        box([px,y-.11,pz],alongX?[.1,.07,.94]:[.94,.07,.1],1,1,'support');
      }
    }
    function drain(x,z,length,axis) {
      const alongX=axis==='x';
      box([x,.012,z],alongX?[length,.018,.44]:[.44,.018,length],7,1,'floor_drain');
      for(const q of [-1,1])box([x+(alongX?0:q*.25),.026,z+(alongX?q*.25:0)],alongX?[length+.1,.02,.055]:[.055,.02,length+.1],1,1,'floor_drain');
      const slats=Math.ceil(length/.23);
      for(let i=0;i<=slats;i++) {
        const d=(i/slats-.5)*length;
        box([x+(alongX?d:0),.027,z+(alongX?0:d)],alongX?[.065,.018,.4]:[.4,.018,.065],0,1,'floor_drain');
        if(i%5===0)for(const q of [-1,1])add('cylinder',[x+(alongX?d:q*.25),.044,z+(alongX?q*.25:d)],[.045,.012,.045],3,[0,0,0],2,'bolt');
      }
    }
    function wallDetails(r,side) {
      const alongX=side==='n'||side==='s',sign=side==='n'||side==='w'?-1:1,extent=alongX?r.w:r.d;
      const nx=alongX?0:-sign,nz=alongX?-sign:0;
      const x=r.x+(alongX?0:sign*(r.w/2-.343)),z=r.z+(alongX?sign*(r.d/2-.343):0),s=surface(x,z,nx,nz);
      const spans=r.openings[side]?[[ -(extent+aperture)/4,(extent-aperture)/2],[(extent+aperture)/4,(extent-aperture)/2]]:[[0,extent-.6]];
      // Convert the room's world-facing span coordinates to this wall's tangent.
      for(const [offset,length] of spans) {
        const u=offset*(alongX?s.tx:s.tz),panelWidth=Math.min(1.65,length-.5);
        servicePanel(s,u,2.08,panelWidth,(r.id+(side==='n'?0:side==='s'?1:2))%3===0,r);
        gauge(s,u+(length>4?1.28:0),length>4?1.58:3.0);
        // Twin supply lines run along solid sections, never across a doorway.
        for(const y of [.83,3.12]) {
          tube(s.at(u-length/2+.22,y,.075),s.at(u+length/2-.22,y,.075),.048,y<1?7:1,'pipe');
          for(let j=0;j<Math.ceil(length/1.8);j++) {
            const cu=u-length/2+.35+j*(length-.7)/Math.max(1,Math.ceil(length/1.8)-1);
            s.plate(cu,y,.076,.08,.22,.15,0,'clamp');
            s.bolt(cu,y+.085,.16);
          }
        }
        // Identification strips consist of actual small geometry, not a font asset.
        for(let j=0;j<5;j++)s.plate(u-panelWidth*.3+j*.13,2.75,.035,.065,.11,.025,j===0?5:3,'marker',2,j===0?.2:0);
        if(length>6) {
          const ventU=u-length*.31;
          s.plate(ventU,r.h-1.8,.015,1.7,.9,.03,7,'vent');
          for(let j=0;j<8;j++)s.plate(ventU,r.h-2.15+j*.1,.06,1.6,.035,.10,1,'louver');
          for(const q of [-1,1])s.plate(ventU+q*.88,r.h-1.8,.045,.06,1.02,.1,0,'vent');
        }
      }
      if(r.openings[side]) {
        // Mechanical jambs occupy the existing wall face. Teeth sit above heads.
        for(const q of [-1,1]) {
          const u=q*(aperture/2+.15);
          s.plate(u,doorHeight/2,.015,.22,doorHeight-.16,.035,0,'door_mechanism');
          tube(s.at(u,.3,.07),s.at(u,doorHeight-.3,.07),.05,3,'door_mechanism');
          for(const y of [.45,1.55,doorHeight-.45]) {
            s.plate(u,y,.07,.26,.16,.09,1,'door_mechanism');
            for(const k of [-1,1])s.bolt(u+k*.085,y,.126);
          }
          const at=s.at(u,doorHeight-.1,.08);
          add('sphere',at,[.13,.13,.13],5,[0,0,0],1,'beacon',.7,theme.alt);
        }
        s.plate(0,doorHeight+.27,.025,aperture+.3,.35,.07,1,'door_mechanism');
        for(let j=0;j<8;j++)s.plate((j-3.5)*aperture/8,doorHeight+.21,.075,.15,.12,.06,7,'door_mechanism');
        for(const q of [-1,1])s.bolt(q*aperture*.42,doorHeight+.31,.08);
        const threshold=s.at(0,.025,.1);
        box(threshold,alongX?[aperture,.025,.45]:[.45,.025,aperture],7,1,'threshold');
        for(let j=0;j<12;j++) {
          const p=s.at((j-5.5)*aperture/12,.042,.1);
          box(p,alongX?[.06,.015,.4]:[.4,.015,.06],1,1,'threshold');
        }
      }
    }
    for(const r of w.rooms) {
      if(r.outdoor)continue;
      owner='room-'+r.id;
      // A complete overhead network with flanges, hanger clamps and rounded bends.
      for(const q of [-1,1]) {
        const z=r.z+q*(r.d/2-1.15),y=r.h-1.13,left=r.x-r.w/2+1.45,right=r.x+r.w/2-1.45;
        tube([left,y,z],[right,y,z],w.stage===1?.17:.12,1,'pipe');
        const joints=Math.max(3,Math.ceil((right-left)/2.6));
        for(let j=0;j<=joints;j++) {
          const x=left+(right-left)*j/joints;
          flange([x,y,z],w.stage===1?.17:.12,'x');
          box([x,(y+r.h)/2,z],[.065,r.h-y,.065],0,1,'support');
          box([x,y-.18,z],[.14,.07,.5],0,1,'clamp');
        }
        for(const side of [-1,1])elbow(r.x+side*(r.w/2-1.45),y,z-q*.35,.35,q*Math.PI/2,side>0?0:q*Math.PI,.12);
        // Cable bundles remain separate from the fluid pipework.
        cableTray(r,r.x+q*1.25,r.z,r.d-1.7,'z');
        drain(r.x+q*(r.w/2-2.75),r.z,r.d*.46,'z');
      }
      cableTray(r,r.x,r.z-3.2,r.w-2.1,'x',.42);
      for(const side of ['n','s','e','w'])wallDetails(r,side);
      // Equipment footprints already have physical collision: add readable panels,
      // cable glands, inspection hatches and bolted ribs to their existing fronts.
      for(const q of [-1,1]) {
        const x=r.x+q*(r.w/2-2),sign=r.id%2?-1:1,z=r.z+sign*(r.d/2-2);
        const body=w.colliders.find(c=>Math.abs((c.minX+c.maxX)/2-x)<.01&&Math.abs((c.minZ+c.maxZ)/2-z)<.01&&Math.abs(c.maxX-c.minX-1.65)<.01);
        if(!body)continue;
        const s=surface(x,z-sign*.807,0,-sign),y=Math.min(body.maxY-.2,1.32);
        s.plate(0,y,.025,1.28,.45,.035,7,'equipment');
        for(let j=0;j<5;j++)s.plate(-.43+j*.22,y,.054,.12,.29,.025,j===0?4:0,'equipment',1,j===0?.4:0);
        for(const a of [-1,1])for(const b of [-1,1])s.bolt(a*.69,Math.max(.25,body.maxY/2+b*(body.maxY/2-.15)),.048);
        // The riser stays inside the existing machine's horizontal footprint.
        const pipeX=x+q*.38,pipeZ=z+sign*.32,top=r.h-1.45;
        tube([pipeX,body.maxY+.08,pipeZ],[pipeX,top,pipeZ],w.stage===1?.14:.075,w.stage===2?0:1,'riser');
        for(let k=0;k<3;k++)flange([pipeX,body.maxY+.25+(top-body.maxY-.4)*k/2,pipeZ],w.stage===1?.14:.075,'y',k!==1);
        for(const k of [-1,1])box([x+k*.71,body.maxY+.08,z],[.075,.15,1.45],1,1,'equipment');
        // Flat hazard paint outlines the machine footprint and can be walked over.
        for(let k=0;k<6;k++)box([x+(k-2.5)*.29,.026,z-sign*1.02],[.11,.012,.32],5,1,'hazard_marking',[0,-sign*.5,0],.08,theme.alt);
        if(q===1) {
          const type=w.stage===1?'steam':w.stage===2?'sparks':'drip';
          const mouth=[pipeX,Math.max(3.0,Math.min(top-.25,3.8)),pipeZ-sign*.15];
          tube([pipeX,mouth[1],pipeZ],mouth,.075,0,'nozzle');
          ambience.push({type,x:mouth[0],y:mouth[1],z:mouth[2],phase:rand()*TAU,scale:w.stage===1?.65:.34,color:w.stage===1?[.44,.53,.53]:theme.alt,room:r.id});
        }
      }
      // High wall ventilation cabinets add depth behind their louver faces.
      for(const q of [-1,1]) {
        const x=r.x+q*(r.w/2-.85),z=r.z+2.8,y=r.h-2.15;
        box([x,y,z],[.65,.82,1.8],0,1,'vent');
        for(let j=0;j<9;j++)box([x-q*.34,y-.3+j*.075,z],[.08,.025,1.62],1,1,'louver');
        for(const k of [-1,1])box([x-q*.36,y,z+k*.9],[.12,.94,.075],1,1,'vent');
      }
      // Stage-specific silhouettes complement the common construction vocabulary.
      if(w.stage===0) {
        for(const q of [-1,1]) {
          const x=r.x+q*(r.w/2-.75),z=r.z-3.9,s=surface(x-q*.39,z,-q,0);
          gauge(s,.35,1.27);
          for(let j=0;j<4;j++)s.plate(-.44+j*.27,.57,.035,.11,.1,.035,j===3?5:3,'switch',2,j===3?.4:0);
          for(let j=0;j<4;j++)tube([x-q*.1,2.1,z+(j-1.5)*.2],[x-q*.1,r.h-.5,z+(j-1.5)*.2],.025,j%2?7:1,'cable');
        }
      } else if(w.stage===1) {
        for(const q of [-1,1]) {
          const x=r.x+q*(r.w/2-1.7),z=r.z-2.9,s=surface(x-q*.67,z,-q,0);
          gauge(s,.49,2.65);
          for(let j=0;j<6;j++) {
            const a=j*TAU/6,at=s.at(FMath.cos(a)*.35,1.75+FMath.sin(a)*.35,.025);
            add('cylinder',at,[.05,.04,.05],3,axes.x,2,'bolt');
          }
          for(const k of [-1,1])tube([x+k*.35,3.25,z],[x+k*.35,4.7,z],.055,0,'pipe');
          flange([x,4.65,z],.46,'y');
        }
        for(let j=-1;j<=1;j++)tube([r.x+j*.34,r.h-1.15,r.z-r.d/2+.8],[r.x+j*.34,r.h-1.15,r.z+r.d/2-.8],.11,1,'header');
      } else {
        const ringY=r.archetype==='reactor'?5.3:r.archetype==='arena'?5.8:4.5,diameter=r.archetype==='reactor'?8:r.archetype==='arena'?6.5:3.1;
        for(let j=0;j<12;j++) {
          const a=j*TAU/12,x=r.x+FMath.cos(a)*diameter*.5,z=r.z+FMath.sin(a)*diameter*.5;
          box([x,ringY,z],[.25,.36,.42],0,1,'reactor_fins',[0,-a,0]);
          box([x,ringY-.21,z],[.12,.045,.32],4,1,'reactor_fins',[0,-a,0],.45,theme.main);
          for(const q of [-1,1])add('cylinder',[x,ringY+q*.21,z],[.065,.035,.065],1,[0,0,0],2,'bolt');
        }
      }
    }
    // Corridors use the same systems at a smaller scale, including dense frame
    // detailing: the player sees the improvement while travelling, not only at hubs.
    for(let index=0;index<w.corridors.length;index++) {
      if(w.corridors[index].outdoor||w.corridors[index].liftId)continue;
      owner='corridor-'+index;
      const c=w.corridors[index],link=w.connections[index],alongX=link.z1===link.z2,length=alongX?c.w:c.d,height=doorHeight+.2;
      const along=(u,v,y)=>[c.x+(alongX?u:v),y,c.z+(alongX?v:u)];
      for(const q of [-1,1]) {
        const v=q*(aperture/2-.012),s=alongX?surface(c.x,c.z+v,0,-q):surface(c.x+v,c.z,-q,0);
        tube(along(-length/2+.1,q*(aperture/2-.48),height-.72),along(length/2-.1,q*(aperture/2-.48),height-.72),.07,7,'cable');
        const ribs=Math.max(2,Math.ceil(length/1.9));
        for(let j=0;j<ribs;j++) {
          const u=(j+.5)/ribs*length-length/2,p=along(u,q*(aperture/2-.5),height-.45);
          flange(p,.12,alongX?'x':'z',j%2===0);
          s.plate(u*(alongX?s.tx:s.tz),1.65,.01,.16,2.7,.04,1,'support');
          for(const y of [.48,1.45,2.6])s.bolt(u*(alongX?s.tx:s.tz),y,.06);
        }
        const u=0;
        s.plate(u,1.95,.025,Math.min(1.5,length-.6),.82,.04,7,'vent');
        for(let j=0;j<6;j++)s.plate(u,1.7+j*.1,.065,Math.min(1.32,length-.8),.035,.08,1,'louver');
      }
      const cRoom={h:height};
      cableTray(cRoom,c.x,c.z,length-.2,alongX?'x':'z');
      drain(c.x,c.z,Math.min(1.5,length*.4),alongX?'z':'x');
      // Narrow ceiling conduits and crossing brackets give the shadow lights edges.
      for(const q of [-1,1])tube(along(-length/2,q*.65,height-.42),along(length/2,q*.65,height-.42),.045,1,'pipe');
      const p=along(0,aperture/2-.13,2.65);
      add('sphere',p,[.12,.12,.12],4,[0,0,0],1,'beacon',.8,theme.main);
      if(index%2===0)ambience.push({type:'beacon',x:p[0],y:p[1],z:p[2],phase:rand()*TAU,scale:.12,color:theme.main});
    }
    for(const h of w.hazards) {
      owner='vent';
      outside=w.environment.outdoorZones.some(r=>Math.abs(h.x-r.x)<=r.w/2&&Math.abs(h.z-r.z)<=r.d/2);
      for(let j=0;j<12;j++) {
        const a=j*TAU/12,r=h.r+.37,x=h.x+FMath.cos(a)*r,z=h.z+FMath.sin(a)*r;
        box([x,.028,z],[.12,.018,.28],5,1,'hazard_marking',[0,-a,0],.12,theme.alt);
        if(j%2===0)add('cylinder',[h.x+FMath.cos(a)*(h.r+.15),.06,h.z+FMath.sin(a)*(h.r+.15)],[.065,.025,.065],3,[0,0,0],2,'bolt');
      }
    }
    w.ambience=ambience;
    w.detailStats={base:baseCount,added:out.length-baseCount,tiers:[out.filter(m=>!m.detail).length,out.filter(m=>m.detail===1).length,out.filter(m=>m.detail===2).length],categories,regions:roomCounts};
  }
  // Organic shapes use the same small primitive library as the machinery. The
  // main trees, cliffs, retaining walls and landmark cover were created above as
  // detail 0; this pass adds optional, non-solid vegetation and surface scatter.
  function naturalDetails(w,theme) {
    const rand=randomFor('FERRO-nature-04:'+w.seed,w.campaign===true?w.index:w.stage),out=w.meshes,stats=w.detailStats;
    let region='';
    const green=w.stage===1?[.35,.36,.20]:w.stage===2?[.28,.43,.31]:[.29,.43,.21];
    function add(shape,p,s,mat,category,r=[0,0,0],detail=1,color,emissive=0) {
      const m={shape,p,s,mat,r,detail,category,outdoor:true,region};
      if(color)m.color=color;if(emissive)m.emissive=emissive;
      out.push(m);stats.categories[category]=(stats.categories[category]||0)+1;
      stats.regions[region]=(stats.regions[region]||0)+1;
      return m;
    }
    const patch=(x,z,sx,sz,mat=8,color)=>add('octa',[x,.013,z],[sx,.018,sz],mat,'ground_patch',[0,rand()*TAU,0],1,color);
    function grass(x,z,dry=false) {
      const a=rand()*TAU,height=(dry?.30:.34)+rand()*.24;
      for(let j=0;j<4;j++)add('octa',[x+FMath.cos(a+j*1.6)*.09,height*.44,z+FMath.sin(a+j*1.6)*.09],
        [.055,height,.15],11,'grass',[.12+rand()*.25,a+j*1.6,(rand()-.5)*.7],1,dry?[.45,.40,.25]:green);
    }
    function fern(x,z,size=1) {
      for(let j=0;j<7;j++) {
        const a=j*TAU/7,dx=FMath.cos(a),dz=FMath.sin(a);
        add('octa',[x+dx*.23*size,.28*size,z+dz*.23*size],[.12*size,.68*size,.19*size],11,'fern',[.7,a,.24],1,green);
        for(const q of [-1,1])add('octa',[x+dx*.27*size+dz*q*.10,.25*size,z+dz*.27*size-dx*q*.10],
          [.12*size,.27*size,.045*size],11,'fern_leaf',[.65,a+q*.65,0],2,green.map(c=>c*1.11));
      }
    }
    function shrub(x,z,size=1) {
      for(let j=0;j<3;j++)add(j===1?'sphere':'octa',[x+FMath.cos(j*2.1)*.25*size,.38*size,z+FMath.sin(j*2.1)*.25*size],
        [size,.9*size,size*.9],11,'undergrowth',[0,rand()*TAU,0],1,green.map(c=>c*(.85+j*.1)));
    }
    function pebble(x,z) {
      const size=.08+rand()*.20;
      add('octa',[x,size*.24,z],[size,size*.48,size*.76],9,'pebble',[0,rand()*TAU,.12],2,w.stage===1?[.57,.43,.30]:[.42,.47,.39]);
    }
    function safePlant(x,z) {
      return !w.hazards.some(h=>FMath.hypot2(h.x-x,h.z-z)<h.r+.55)&&!w.colliders.some(c=>
        c.minY<1&&c.maxY>.05&&x>c.minX-.15&&x<c.maxX+.15&&z>c.minZ-.15&&z<c.maxZ+.15);
    }
    for(const room of w.rooms) {
      if(!room.outdoor)continue;
      region='room-'+room.id;
      const corner=()=>{
        const q=rand()<.5?-1:1,k=rand()<.5?-1:1;
        return [room.x+q*(4.3+rand()*(room.w/2-5.4)),room.z+k*(4.9+rand()*(room.d/2-6))];
      };
      // Large tonal patches blend paths, moss, leaf fall and bare ground without
      // changing floor height or relying on imported textures.
      for(let j=0;j<18;j++) {
        const [x,z]=corner();
        patch(x,z,1.1+rand()*2.2,1+rand()*1.8,8,w.stage===1?[.38+rand()*.12,.29,.19]:[.22+rand()*.09,.32+rand()*.07,.19]);
      }
      for(let j=0;j<(w.stage===1?35:56);j++) {
        const [x,z]=corner();if(safePlant(x,z))grass(x,z,w.stage===1);
      }
      for(let j=0;j<(w.stage===1?5:15);j++) {
        const [x,z]=corner();if(safePlant(x,z))fern(x,z,.78+rand()*.20);
      }
      for(let j=0;j<(w.stage===1?4:10);j++) {
        const [x,z]=corner();if(safePlant(x,z))shrub(x,z,.6+rand()*.45);
      }
      // A grounded bed of small pebbles and leaves carries the detail down from
      // canopy height. None is large enough to imply an impassable obstacle.
      for(let j=0;j<86;j++) {
        const x=room.x+(rand()-.5)*(room.w-1.4),z=room.z+(rand()-.5)*(room.d-1.4);
        if(!safePlant(x,z))continue;
        if(j%3===0)pebble(x,z);
        else {
          const s=.10+rand()*.18;
          add('octa',[x,.035,z],[s,.035,s*.55],w.stage===1?9:11,'leaf_litter',[.1,rand()*TAU,.15],2,w.stage===2?[.47,.44,.27]:[.43,.34,.18]);
        }
      }
      // Local ecologies distinguish the sectors: dry scrub and mineral seams,
      // bracken and fallen wood, or flowers and hanging ivy amongst ruins.
      if(w.stage===0) {
        for(let j=0;j<12;j++) {
          const [x,z]=corner();
          add('box',[x,.035,z],[.7+rand()*.7,.035,.045],10,'fallen_twig',[0,rand()*TAU,0],1,[.30,.24,.15]);
        }
        for(const t of w.trees.filter(t=>t.region===region&&t.solid)) {
          for(let j=0;j<5;j++) {
            const a=rand()*TAU,x=t.x+FMath.cos(a)*(.4+rand()*.25),z=t.z+FMath.sin(a)*(.4+rand()*.25);
            add('cylinder',[x,.08,z],[.04,.15,.04],3,'mushroom',[0,0,0],2,[.64,.59,.43]);
            add('sphere',[x,.16,z],[.18,.09,.18],5,'mushroom',[0,0,0],2,[.60,.35,.15]);
          }
        }
      } else if(w.stage===1) {
        for(let j=0;j<15;j++) {
          const [x,z]=corner();
          add('octa',[x,.09,z],[.23,.18,.16],9,'mineral',[0,rand()*TAU,.3],2,[.60,.44,.23]);
          for(let k=0;k<3;k++)add('box',[x+(k-1)*.11,.022,z],[.055,.018,.31],1,'ore_seam',[0,.4,0],2,[.51,.31,.17]);
        }
      } else {
        for(let j=0;j<24;j++) {
          const [x,z]=corner();if(!safePlant(x,z))continue;
          const h=.18+rand()*.14;
          add('cylinder',[x,h*.5,z],[.025,h,.025],10,'flower_stem',[0,0,0],2,green);
          add('sphere',[x,h,z],[.15,.08,.15],11,'flower',[0,rand()*TAU,0],2,j%3?[.56,.48,.70]:[.81,.67,.38]);
        }
        for(const t of w.trees.filter(t=>t.region===region&&t.solid))for(let j=0;j<9;j++) {
          const a=j*1.6;
          add('octa',[t.x+FMath.cos(a)*.24,.35+j*.21,t.z+FMath.sin(a)*.24],[.27,.19,.09],11,'ivy',[.2,a,.5],2,green);
        }
        if(room.id===0||room.id===5) {
          add('cylinder',[room.x+4.9,.021,room.z-5.4],[2,.025,1.2],12,'puddle',[0,.4,0],1,[.23,.35,.39]);
          for(let j=0;j<7;j++)grass(room.x+4+rand()*1.8,room.z-6.25+rand()*.25);
        }
      }
      // Insets and rivets give outdoor machinery the same construction language
      // as the interiors, while being safely attached to the actual solid body.
      const solids=w.colliders.filter(c=>{
        const m=w.meshes[c.mesh];return m.region===region&&['supply_cache','pump_housing','ore_cart','monument_base','basin'].includes(m.category);
      });
      for(const body of solids) {
        const x=(body.minX+body.maxX)/2,z=body.maxZ+.012,y=Math.min(1,body.maxY*.65),width=Math.min(1.4,body.maxX-body.minX-.16);
        add('box',[x,y,z],[width,.28,.022],0,'outdoor_fitting');
        for(let j=0;j<4;j++)add('box',[x+(j-1.5)*width*.2,y,z+.018],[.08,.16,.018],j?1:4,'outdoor_fitting',[0,0,0],2,j?undefined:theme.main,j?0:.4);
        for(const q of [-1,1])add('cylinder',[x+q*width*.42,y,z+.025],[.06,.025,.06],3,'bolt',[Math.PI/2,0,0],2);
      }
    }
    for(const [i,c] of w.corridors.entries()) {
      if(!c.outdoor||c.liftId)continue;
      region='corridor-'+i;
      const alongX=c.w>c.d,length=alongX?c.w:c.d,half=(alongX?c.d:c.w)/2;
      for(const q of [-1,1])for(let j=0;j<Math.max(4,Math.ceil(length*2));j++) {
        const d=(j/Math.max(3,Math.ceil(length*2)-1)-.5)*Math.max(.1,length-.4);
        const x=c.x+(alongX?d:q*(half-.60)),z=c.z+(alongX?q*(half-.60):d);
        grass(x,z,w.stage===1);pebble(x+(rand()-.5)*.3,z+(rand()-.5)*.3);
      }
    }
    stats.added=out.length-stats.base;
    stats.tiers=[out.filter(m=>!m.detail).length,out.filter(m=>m.detail===1).length,out.filter(m=>m.detail===2).length];
    w.natureStats={trees:w.trees.length,playableTrees:w.trees.filter(t=>t.solid).length,species:[...new Set(w.trees.map(t=>t.species))],
      outdoorRooms:w.rooms.filter(r=>r.outdoor).length,outdoorPaths:w.corridors.filter(c=>c.outdoor).length,
      vegetation:out.filter(m=>m.mat===11).length,rocks:out.filter(m=>m.category==='boulder'||m.category==='cliff').length};
  }
  // Art is authored in local floor coordinates, then lifted as a coherent region.
  // Ramps are actual tilted boxes with coplanar floor markings. Retaining walls
  // remain vertical visible solids, matching their exact axis-aligned colliders.
  function elevateWorld(w) {
    // Assemblies may share a local position. Each mesh receives altitude once.
    for(const m of w.meshes)m.p=m.p.slice();
    const regions=new Map(w.rooms.map(r=>['room-'+r.id,r]));
    w.corridors.forEach((c,i)=>regions.set('corridor-'+i,c));
    const at=(r,x,z)=>{
      if(!r)return 0;
      if(r.liftId){const l=w.lifts.find(l=>l.id===r.liftId),u=r.axis==='x'?x-r.x:z-r.z;return u*r.lowSign< -1.8?l.maxY:l.minY;}
      return (r.y||0)+(x-r.x)*(r.slopeX||0)+(z-r.z)*(r.slopeZ||0);
    };
    const regionAt=(x,z)=>w.rooms.concat(w.corridors).find(r=>Math.abs(x-r.x)<=r.w/2+.3&&Math.abs(z-r.z)<=r.d/2+.3);
    for(const m of w.meshes) {
      if(m.fixedHeight){delete m.fixedHeight;continue;}
      const r=regions.get(m.region)||regionAt(m.p[0],m.p[2]);
      if(!r)continue;
      const y=at(r,m.p[0],m.p[2]),k=r.slopeX||r.slopeZ||0,axis=r.slopeX?0:2;
      const ground=['floor','outdoor_floor','trail'].includes(m.category)&&m.shape==='box';
      if(ground){m.ground=true;m.surface='architecture';}
      if(m.solid) {
        // A continuous vertical skirt follows both ends of each ramp. Narrow
        // posts only grow by the small height change across their footprint.
        const span=m.s[axis]*Math.abs(k);
        m.p[1]+=y;m.s[1]+=span;
      } else if(k&&m.shape==='box'&&(!(m.r)||m.r.every(v=>Math.abs(v)<1e-8))&&(ground||m.s[axis]>(axis===0?r.w:r.d)*.55)) {
        const angle=FMath.atan(k),cos=FMath.cos(angle),thickness=m.s[1];
        m.p[1]+=y+(ground?thickness/2-thickness/(2*cos):0);
        m.s[axis]/=cos;m.r=axis===0?[0,0,angle]:[-angle,0,0];
      } else if(k&&m.shape==='cylinder'&&m.s[1]>(axis===0?r.w:r.d)*.55) {
        const dx=axis===0?1:0,dz=axis===2?1:0;
        m.p[1]+=y;m.s[1]*=Math.sqrt(1+k*k);
        m.r=[FMath.atan2(dz,FMath.hypot2(dx,k)),0,FMath.atan2(-dx,k)];
      } else m.p[1]+=y;
    }
    for(const c of w.colliders) {
      const m=w.meshes[c.mesh];
      c.minX=m.p[0]-m.s[0]/2;c.maxX=m.p[0]+m.s[0]/2;
      c.minY=m.p[1]-m.s[1]/2;c.maxY=m.p[1]+m.s[1]/2;
      c.minZ=m.p[2]-m.s[2]/2;c.maxZ=m.p[2]+m.s[2]/2;
    }
    for(const l of w.lights)l.p[1]+=at(regions.get(l.region)||regionAt(l.p[0],l.p[2]),l.p[0],l.p[2]);
    for(const a of w.machinery.concat(w.ambience||[])) {
      if(a.fixedHeight){delete a.fixedHeight;continue;}
      a.y+=at(a.room===undefined?regionAt(a.x,a.z):w.rooms[a.room],a.x,a.z);
    }
    for(const t of w.trees)t.y=at(regions.get(t.region),t.x,t.z);
    for(const b of w.outdoorBoundaries){const m=w.meshes[b.mesh];b.y=m.p[1]-m.s[1]/2;b.height=m.s[1];}
    w.routeLength=w.connections.reduce((n,c)=>n+FMath.hypot3(c.x2-c.x1,c.z2-c.z1,c.y2-c.y1),0);
  }
  function floorHeight(world,x,z) {
    let fallback=null;
    for(const r of world.walkable||world.rooms.concat(world.corridors||[]))if(Math.abs(x-r.x)<=r.w/2+1e-7&&Math.abs(z-r.z)<=r.d/2+1e-7){if(r.substrate||r.fallback){fallback=r.y||0;continue;}return (r.y||0)+(x-r.x)*(r.slopeX||0)+(z-r.z)*(r.slopeZ||0);}
    return fallback;
  }
  // A separate botanical pass preserves the layout RNG, every collider and all
  // mesh identities. Existing pieces become a bent trunk, connected forks and
  // irregular leaf clusters; the scene gains no additional draw instances.
  function polishTrees(w){
    for(const t of w.trees){
      const random=randomFor('METAL-botanical:'+w.seed+':'+t.mesh,w.campaign===true?w.index:w.stage),parts=w.meshes.slice(t.mesh,t.mesh+t.meshCount);
      const originals=parts.map(m=>({...m,p:m.p.slice(),s:m.s.slice(),r:(m.r||[0,0,0]).slice()}));
      const endpoints=m=>{const [rx,ry,rz]=m.r,cx=FMath.cos(rx),sx=FMath.sin(rx),cy=FMath.cos(ry),sy=FMath.sin(ry),cz=FMath.cos(rz),sz=FMath.sin(rz),axis=[cz*sy*sx-sz*cx,sz*sy*sx+cz*cx,cy*sx];return [-1,1].map(q=>m.p.map((v,i)=>v+q*axis[i]*m.s[1]/2));};
      const wood=t.species==='birch'?[.57,.58,.49]:t.species==='dead'?[.35,.29,.23]:[.27,.23,.16];
      const segment=(m,a,b,diameter,category)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];m.shape='cylinder';m.p=a.map((v,i)=>(v+b[i])/2);m.s=[diameter,FMath.hypot3(dx,dy,dz),diameter];m.r=[FMath.atan2(dz,FMath.hypot2(dx,dy)),0,FMath.atan2(-dx,dy)];m.category=category;m.mat=10;m.color=wood.map(v=>v*(.91+random()*.15));};
      const [base,top]=endpoints(originals[1]),bend=base.map((v,i)=>v+(top[i]-v)*.54),angle=random()*TAU;
      bend[0]+=FMath.cos(angle)*.14;bend[2]+=FMath.sin(angle)*.14;
      segment(parts[1],base,bend,originals[1].s[0],'trunk');
      segment(parts[2],bend,top,originals[1].s[0]*.63,'trunk');
      const spine=y=>{const a=y<=bend[1]?base:bend,b=y<=bend[1]?bend:top,q=Math.max(0,Math.min(1,(y-a[1])/(b[1]-a[1])));return [a[0]+(b[0]-a[0])*q,y,a[2]+(b[2]-a[2])*q];};
      const branches=originals.flatMap((m,i)=>m.category==='branch'?[i]:[]),crowns=originals.flatMap((m,i)=>m.category==='canopy'?[i]:[]);
      if(t.species==='pine'){
        for(let k=0;k<4;k++){
          const canopy=parts[crowns[k]],old=originals[crowns[k]],spread=old.s[0],direction=t.phase+k*2.399+(random()-.5)*.42;
          canopy.shape='foliage';canopy.s=[old.s[0],old.s[1]*.74,old.s[2]];
          const y=Math.min(top[1]-.1,Math.max(t.y+2.25,old.p[1]-.35)),a=spine(y),hub=[a[0]+FMath.cos(direction)*spread*.19,y+.21,a[2]+FMath.sin(direction)*spread*.19];
          segment(parts[branches[k*3]],a,hub,.13-k*.016,'branch');
          for(let j=0;j<2;j++){const q=direction+(j?.55:-.62),reach=spread*(j?.37:.40),end=[a[0]+FMath.cos(q)*reach,y+.27+j*.12,a[2]+FMath.sin(q)*reach];segment(parts[branches[k*3+j+1]],hub,end,.078-k*.009,'twig');}
        }
      }else{
        const bare=t.species==='dead';
        for(const [j,i] of branches.entries()){
          const [oldA,joint]=endpoints(originals[i]),[,tip]=endpoints(originals[i+1]),a=spine(Math.max(t.y+2.3,oldA[1])),dx=joint[0]-a[0],dz=joint[2]-a[2],length=FMath.hypot2(dx,dz)||1,bow=(random()-.5)*t.height*.10;
          const knee=a.map((v,k)=>v+(joint[k]-v)*.58);knee[0]-=dz/length*bow;knee[2]+=dx/length*bow;knee[1]+=.10+random()*.10;
          segment(parts[i],a,knee,originals[i].s[0], 'branch');
          segment(parts[i+1],knee,tip,originals[i].s[0]*.54,'twig');
          if(!bare){
            parts[i+2].shape='foliage';
            if(j%2){
              const fork=knee.map((v,k)=>v+(tip[k]-v)*.34),end=[joint[0]-dz/length*.58,joint[1]+.42,joint[2]+dx/length*.58];
              segment(parts[i+3],fork,end,.068,'twig');
            }else{parts[i+3].shape='foliage';parts[i+3].s=originals[i+3].s.map((v,k)=>v*(k===1?.81:.73));}
          }
        }
      }
      t.modelVersion=2;
    }
    w.natureStats.vegetation=w.meshes.filter(m=>m.mat===11).length;
    w.natureStats.treeModelVersion=2;
  }
  function arenaWorld(w,theme,aperture){
    const access=w.rooms[[5,3,5][w.stage]],edge=access.x+access.w/2,gap=13,size=60;
    const arena={id:w.rooms.length,x:edge+gap+size/2,z:access.z,y:access.y,w:size,d:size,h:0,outdoor:true,bossArena:true,archetype:'colossal-arena',name:['L’enclos du Colosse','La fosse du Brise-siège','Le parvis du Veilleur'][w.stage],openings:{w:true}};
    const c={x:edge+gap/2,z:access.z,w:gap+.5,d:aperture+.48,y:access.y,slopeX:0,slopeZ:0,outdoor:true,arenaPath:true};
    const corridorId=w.corridors.length;w.rooms.push(arena);w.corridors.push(c);w.connections.push({from:access.id,to:arena.id,x1:access.x,z1:access.z,x2:arena.x,z2:arena.z,width:aperture,y1:access.y,y2:arena.y});
    w.walkable.push({x:arena.x,z:arena.z,w:size,d:size,y:arena.y,slopeX:0,slopeZ:0},{...c});
    w.environment.outdoorZones.push({x:arena.x,z:arena.z,w:size,d:size},{x:c.x,z:c.z,w:c.w,d:c.d});
    w.bossArena={x:arena.x,y:arena.y,z:arena.z,r:28,room:arena.id};
    w.environment.longViewZones=[{x:arena.x,z:arena.z,w:size,d:size,range:100}];
    const add=(p,s,mat,category,region,solid=false,extra={})=>{
      const m={shape:'box',p,s,mat,category,region,outdoor:true,structural:true,...extra};w.meshes.push(m);
      if(solid){m.solid=true;w.colliders.push({minX:p[0]-s[0]/2,maxX:p[0]+s[0]/2,minY:p[1]-s[1]/2,maxY:p[1]+s[1]/2,minZ:p[2]-s[2]/2,maxZ:p[2]+s[2]/2,mesh:w.meshes.length-1});}return m;
    };
    const groundColor=w.stage===1?[.39,.30,.22]:[.28,.33,.28],region='room-'+arena.id;
    for(let x=-30;x<30;x+=10)for(let z=-30;z<30;z+=10)add([arena.x+x+5,arena.y-.22,arena.z+z+5],[10,.44,10],8,'outdoor_floor',region,false,{ground:true,surface:'architecture',color:groundColor});
    add([c.x,c.y-.22,c.z],[c.w,.44,c.d],2,'floor','corridor-'+corridorId,false,{ground:true,surface:'architecture'});
    function boundary(x,z,wid,depth,owner){
      add([x,arena.y+.5,z],[wid,1,depth],9,'boundary',owner,true,{color:groundColor.map(v=>v*1.2)});
      w.outdoorBoundaries.push({x,z,y:arena.y,length:Math.max(wid,depth),alongX:wid>depth,height:1,thickness:Math.min(wid,depth),region:owner,mesh:w.meshes.length-1});
      add([x,arena.y+1.08,z],[wid+.04,.16,depth+.04],1,'arena_rail',owner);
    }
    for(const side of [-1,1]){
      boundary(c.x,c.z+side*(aperture/2+.24),c.w,.48,'corridor-'+corridorId);
      for(let x=-25;x<=25;x+=10)boundary(arena.x+x,arena.z+side*30,10,.52,region);
      for(let z=-25;z<=25;z+=10)if(side===1||Math.abs(z)>5)boundary(arena.x+side*30,arena.z+z,.52,10,region);
      if(side===-1){const length=10-aperture/2;for(const sign of [-1,1])boundary(arena.x-30,arena.z+sign*(aperture/2+length/2),.52,length,region);}
    }
    // Flat segmented inlays describe a vast ceremonial machine circle without
    // adding obstacles or one enormous mesh to the spatial render index.
    for(const radius of [12,20,26])for(let i=0;i<72;i++){
      const a=i*TAU/72,length=TAU*radius/72*.72;
      add([arena.x+FMath.cos(a)*radius,arena.y+.014,arena.z+FMath.sin(a)*radius],[.075,.022,length],i%6===0?4:1,'arena_inlay',region,false,{r:[0,-a,0],emissive:i%6===0?.17:0,color:i%6===0?theme.main:undefined});
    }
    for(const side of [-1,1])for(let i=0;i<13;i++){
      const x=edge+(i+.5)*gap/13,z=c.z+side*(aperture/2+.24);
      add([x,c.y+1.14,z],[.08,.30,.08],1,'arena_post','corridor-'+corridorId);
      add([x,c.y+.014,c.z+side*(aperture/2-.2)],[.28,.022,.12],5,'arena_path_mark','corridor-'+corridorId,false,{color:theme.alt});
    }
    // Only the outer ring holds cover. The centre and the guardian's complete
    // motion envelope remain free of props, roofs and ordinary spawn points.
    for(const side of [-1,1])for(const z of [-20,20]){
      add([arena.x+side*26,arena.y+.65,arena.z+z],[2,1.3,3],0,'arena_cover',region,true);
      add([arena.x+side*26,arena.y+1.34,arena.z+z],[2.12,.08,3.12],1,'arena_cover_cap',region);
      w.pickups.push({x:arena.x+side*23.8,y:arena.y,z:arena.z+z,type:'health'});
    }
    for(const q of [-1,1])for(const k of [-1,1]){
      const x=arena.x+q*28,z=arena.z+k*27;
      add([x,arena.y+2.25,z],[.18,4.5,.18],1,'arena_lamp',region,true);
      add([x,arena.y+4.43,z],[.7,.12,.7],4,'arena_lamp_head',region,false,{emissive:.5,color:theme.main});
      w.lights.push({p:[x,arena.y+4.2,z],color:theme.main,power:8,region});
    }
    // Three colossal gateways frame the open arena. Their complete geometry is
    // beyond the guardian's widest movement envelope, including the sidearms.
    // Each lintel belongs to its own pair of pillars for real local collapse.
    const monumentColor=w.stage===1?[.26,.25,.23]:w.stage===2?[.42,.48,.43]:[.35,.39,.32];
    for(let i=0;i<3;i++){
      const entrance=i===2,axis=entrance?'z':'x',height=(entrance?10:18)+w.stage*(entrance?2:3),half=entrance?7:15;
      const centre={x:arena.x+(entrance?-29.4:0),z:arena.z+(entrance?0:(i===0?-29.4:29.4))},owner='arena-monument-'+i;
      for(const side of [-1,1]){
        const x=centre.x+(axis==='x'?side*half:0),z=centre.z+(axis==='z'?side*half:0);
        add([x,arena.y+height/2,z],[2.2,height,2.2],w.stage===1?0:9,'arena_pier',owner,true,{color:monumentColor});
        for(const y of [.8,height*.35,height*.68,height-.45])add([x,arena.y+y,z],[2.8,.36,2.8],1,'arena_buttress_band',owner,false,{color:monumentColor.map(v=>v*1.16)});
        add([x,arena.y+height+.34,z],[3.2,.68,3.2],w.stage===1?1:9,'arena_capstone',owner,false,{color:monumentColor});
        for(const q of [-1,1])add([x+(axis==='x'?0:q*.94),arena.y+height*.52,z+(axis==='z'?0:q*.94)],axis==='x'?[.2,height*.65,.1]:[.1,height*.65,.2],1,'arena_vertical_inlay',owner,false,{color:theme.alt});
        if(w.stage!==1)for(const q of [-1,1])add([x+q*.7,arena.y+height*.42,z+1.13],[.24,height*.52,.055],11,'arena_ivy',owner,false,{color:w.stage===2?[.22,.35,.27]:[.26,.31,.19]});
      }
      add([centre.x,arena.y+height-.7,centre.z],axis==='x'?[half*2,1.5,1.6]:[1.6,1.5,half*2],w.stage===1?0:9,'ceiling',owner,true,{color:monumentColor});
      for(const side of [-1,1])add([centre.x+(axis==='x'?side*half*.48:0),arena.y+height+.22,centre.z+(axis==='z'?side*half*.48:0)],axis==='x'?[3,.35,2.05]:[2.05,.35,3],1,'arena_lintel_coping',owner,false,{color:monumentColor.map(v=>v*1.1)});
      // Distant warning lenses supply a readable vertical landmark in all biomes.
      add([centre.x+(entrance?.86:0),arena.y+height-.65,centre.z+(entrance?0:(i===0?.86:-.86))],entrance?[.08,.45,1.3]:[1.3,.45,.08],4,'arena_high_beacon',owner,false,{emissive:.22,color:theme.main});
    }
    w.bounds.maxX=Math.ceil(arena.x+30+.8);w.bounds.minZ=Math.min(w.bounds.minZ,Math.floor(arena.z-30-.8));w.bounds.maxZ=Math.max(w.bounds.maxZ,Math.ceil(arena.z+30+.8));
    w.natureStats.outdoorRooms++;w.natureStats.outdoorPaths++;
    w.detailStats.regions[region]=w.meshes.filter(m=>m.region===region).length;w.detailStats.regions['corridor-'+corridorId]=w.meshes.filter(m=>m.region==='corridor-'+corridorId).length;
    w.routeLength=w.connections.reduce((n,c)=>n+FMath.hypot3(c.x2-c.x1,c.z2-c.z1,c.y2-c.y1),0);
  }
  // A continuous, visible terrain bed makes a demolished boundary a usable
  // opening. Tiles keep the render spatial index local; no map-sized mesh.
  function demolitionWorld(w,theme,legacyTraps=false){
    const old=w.bounds,widen=7;
    w.bounds={minX:old.minX-widen,maxX:old.maxX+widen,minZ:old.minZ-widen,maxZ:old.maxZ+widen};
    const b=w.bounds,add=(shape,p,s,mat,category,extra={})=>{const m={shape,p,s,mat,category,outdoor:true,region:'terrain',structural:true,...extra};w.meshes.push(m);return m;};
    const box=(p,s,mat,category,extra={},solid=false)=>{const m=add('box',p,s,mat,category,extra);if(solid){m.solid=true;w.colliders.push({minX:p[0]-s[0]/2,maxX:p[0]+s[0]/2,minY:p[1]-s[1]/2,maxY:p[1]+s[1]/2,minZ:p[2]-s[2]/2,maxZ:p[2]+s[2]/2,mesh:w.meshes.length-1});}return m;};
    const color=w.stage===1?[.36,.29,.20]:w.stage===2?[.23,.29,.25]:[.26,.31,.21];
    w.walkable.push({x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2,w:b.maxX-b.minX,d:b.maxZ-b.minZ,y:-.25,slopeX:0,slopeZ:0,substrate:true,fallback:true});
    for(let x=b.minX;x<b.maxX;x+=10)for(let z=b.minZ;z<b.maxZ;z+=10){const dx=Math.min(10,b.maxX-x),dz=Math.min(10,b.maxZ-z);box([x+dx/2,-.55,z+dz/2],[dx,.6,dz],8,'substrate',{ground:true,surface:'architecture',terrain:true,color});}
    // The finite map ends in an exposed bedrock rim, a visible piece of the
    // carrying terrain, rather than an invisible wall behind a destroyed fence.
    for(const side of ['n','s','e','w']){
      const along=side==='n'||side==='s',low=side==='n'||side==='w',start=along?b.minX:b.minZ,end=along?b.maxX:b.maxZ;
      for(let u=start;u<end;u+=10){const length=Math.min(10,end-u),x=along?u+length/2:(low?b.minX+.45:b.maxX-.45),z=along?(low?b.minZ+.45:b.maxZ-.45):u+length/2;
        box([x,.75,z],along?[length,2,.9]:[.9,2,length],9,'terrain_edge',{terrain:true,color:color.map(v=>v*1.2)},true);
        add('octa',[x,1.4,z],along?[length,1.5,1.5]:[1.5,1.5,length],9,'terrain_edge',{terrain:true,color:color.map(v=>v*1.25)});
      }
    }
    const segmentDistance=(x,z,a,c)=>{const dx=c.x-a.x,dz=c.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));return FMath.hypot2(x-a.x-dx*t,z-a.z-dz*t);};
    const reserved=[w.spawn,w.exit,...w.cores,...w.pickups,...w.mechanisms,...w.lifts.flatMap(l=>[l.lowerCall,l.upperCall]),...w.jumpPads.flatMap(j=>[j,j.target])],chosen=[];
    function spot(room,radius,ambient=false){
      const candidates=[];for(const dx of [-4.5,4.5,-2.8,2.8,-6,6,0])for(const dz of [-1.8,1.8,-5.6,5.6,-3.4,3.4])candidates.push({x:room.x+dx,z:room.z+dz});
      return candidates.find(p=>Math.abs(p.x-room.x)<room.w/2-radius-.3&&Math.abs(p.z-room.z)<room.d/2-radius-.3&&isWalkable(w,p.x,p.z,radius)&&reserved.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>radius+1.8)&&chosen.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>radius+q.r+1)&&w.jumpPads.every(j=>segmentDistance(p.x,p.z,j,j.target)>radius+1.5)&&(!ambient||reserved.every(q=>{const dx=room.x-p.x,dz=room.z-p.z,n=FMath.hypot2(dx,dz),a={x:p.x+dx/n*.54,z:p.z+dz/n*.54},c={x:p.x+dx/n*3.46,z:p.z+dz/n*3.46};return FMath.hypot2(q.x-a.x,q.z-a.z)>3.2&&segmentDistance(q.x,q.z,a,c)>1.8;})));
    }
    w.traps=[];w.pipes=[];
    const yards=w.rooms.filter(r=>r.outdoor&&r.id!==0&&!r.bossArena);
    // Reprise exacte des mondes écrits avant les pièges massifs (base 1814b81).
    // Le mode courant reste le défaut ; aucune donnée du checkpoint ne contourne restore.
    if(legacyTraps){
      for(const [i,kind] of ['blade','press','spikes'].entries()){
        let room,point;
        for(const r of yards.slice(i).concat(yards.slice(0,i))){const q=spot(r,kind==='blade'?2.2:1.4);if(q){room=r;point=q;break;}}
        if(!point)throw new Error('No safe trap position '+w.stage+'/'+kind);
        const {x,z}=point,y=room.y,id='trap-'+i,region='room-'+room.id,assembly='trap-frame-'+i;
        const trap={id,kind,x,y:kind==='blade'?y+.84:y,baseY:y,z,w:kind==='blade'?.3:1.6,d:kind==='blade'?1.35:1.6,h:kind==='blade'?.32:kind==='press'?.65:1.1,axis:'x',travel:kind==='blade'?1.65:kind==='press'?2.6:0,period:7.8+i*.8,active:1.6+i*.15,warning:1.3,phase:2.1+i*1.7,damage:kind==='press'?24:18};
        w.traps.push(trap);chosen.push({...point,r:2.4});
        box([x,y+.015,z],[kind==='blade'?4.3:2.1,.03,2.1],0,'trap_plate',{region,assembly,color:[.17,.19,.20]});
        for(const q of [-1,1])for(let k=0;k<8;k++)box([x+(k-3.5)*.22,y+.037,z+q*1],[.12,.018,.17],5,'trap_warning',{region,assembly,color:theme.alt});
        if(kind!=='spikes'){
          const span=kind==='blade'?2.22:1.25;
          for(const q of [-1,1])box([x+q*span,y+1.8,z],[.16,3.6,.24],1,'trap_support',{region,assembly},true);
          box([x,y+3.54,z],[span*2+.25,.22,.42],0,'trap_beam',{region,assembly});
          add('cylinder',[x,y+3.36,z],[.48,.24,.48],1,'trap_motor',{region,assembly,r:[Math.PI/2,0,0]});
        }
      }
    }else{
      // Décision de David du 13/11 : plus aucun piège décoratif. Une machine est
      // posée en travers d'un passage obligatoire, calculé sur le graphe des salles
      // (lien dont le retrait déconnecte un objectif) puis complété par la tournée
      // que le joueur est bien obligé de faire. Le banc checks/traps-mandatory.mjs
      // prouve sur la grille de navigation que la barrière coupe le couloir.
      const roomOf=(x,z)=>w.rooms.find(r=>Math.abs(x-r.x)<=r.w/2+.3&&Math.abs(z-r.z)<=r.d/2+.3)?.id;
      const passageLinks=w.connections.map(c=>({from:c.from,to:c.to,x1:c.x1,z1:c.z1,x2:c.x2,z2:c.z2}));
      const passageStart=roomOf(w.spawn.x,w.spawn.z);
      const passageTargets=[...new Set([w.bossArena?w.bossArena.room:roomOf(w.exit.x,w.exit.z),roomOf(w.exit.x,w.exit.z),...w.cores.map(c=>roomOf(c.x,c.z))])].filter(id=>id!==undefined&&id!==passageStart);
      const forced=FPassages.mandatoryLinks({links:passageLinks,start:passageStart,objectives:passageTargets});
      const tour=FPassages.tourLinks({links:passageLinks,start:passageStart,objectives:passageTargets});
      const arenaPath=w.corridors.findIndex(c=>c.arenaPath);
      // Ordre d'implantation : d'abord les liens vraiment obligatoires (les retirer
      // déconnecte un objectif), ensuite la tournée. Le plafond de machines ne doit
      // jamais évincer un couloir sans alternative au profit d'un couloir de
      // confort : c'est le premier qui fait le danger obligatoire du secteur.
      const passages=[...new Set([...[arenaPath,...forced].filter(k=>k>=0),...tour.filter(k=>k>=0)])];
      const nearPassage=[w.spawn,w.exit,...w.cores,...w.mechanisms,...w.lifts.flatMap(l=>[l.lowerCall,l.upperCall]),...w.jumpPads.flatMap(j=>[j,j.target])];
      let coupe=-1;
      for(const k of passages){
        if(w.traps.length>=40)break;
        const c=w.corridors[k];
        if(!c||c.liftId)continue;
        const alongX=c.w>=c.d,cross=alongX?c.d:c.w,length=alongX?c.w:c.d;
        if(cross>9||length<6.5)continue;
        if(nearPassage.some(q=>FMath.hypot2(c.x-q.x,c.z-q.z)<6.5))continue;
        const baseY=floorHeight(w,c.x,c.z)??c.y??0;
        // Un couloir n'est un passage que si l'on ne peut pas le longer à côté : on
        // mesure la largeur réellement praticable au niveau de son sol, au ras du
        // garde-corps. Trop large, ce n'est plus un défilé : on n'y pose rien.
        const halfScan=sign=>{let u=0,prev=baseY;for(;u<7;u+=.4){const nu=u+.4,x=alongX?c.x:c.x+sign*nu,z=alongX?c.z+sign*nu:c.z,y=floorHeight(w,x,z);if(y===null||!isWalkable(w,x,z,.38)||Math.abs(y-prev)>.42)break;prev=y;}return u;};
        const half=Math.max(1.2,halfScan(-1),halfScan(1));
        if(half>5.4)continue;
        const span=2*(half+.6);
        const n=Math.max(2,Math.min(8,Math.ceil(span/1.8))),piece=span/n;
        // Les lames glissent PERPENDICULAIREMENT au couloir, chacune dans son
        // intervalle, avec une phase décalée : l'union des courses couvre toute la
        // largeur (rien ne se traverse sans risque — le banc le prouve), mais à un
        // instant donné il y a un jour entre deux lames. Une muraille continue et
        // synchrone boucherait le couloir comme un mur, ce qui n'est pas un piège.
        const bladeTravel=Math.min(piece*.9,1.6),gantry=Math.max(3.2,Math.min(length-3,5.4));
        const period=6.4+(coupe+1)*1.1,active=1.7,warningTime=1.5,phase=(coupe+1)*2.3;
        coupe++;
        const assembly='trap-frame-'+coupe,region='corridor-'+k,barrier='coupe-'+coupe,destructibleId='trap-frame-'+coupe;
        for(let j=0;j<n;j++){
          const u=-span/2+(j+.5)*piece,x=alongX?c.x:c.x+u,z=alongX?c.z+u:c.z;
          w.traps.push({id:'trap-'+coupe+'-'+j,barrier,kind:'blade',x,y:(floorHeight(w,x,z)??baseY)+.05,baseY,z,
            w:alongX?.3:piece,d:alongX?piece:.3,h:1.8,axis:alongX?'z':'x',travel:bladeTravel,period,active,warning:warningTime,phase:phase+j*period/n,damage:26,destructibleId});
          box([x,baseY+.015,z],alongX?[piece,.03,bladeTravel*2+.8]:[bladeTravel*2+.8,.03,piece],0,'trap_plate',{region,assembly,color:[.17,.19,.20]});
        }
        // La presse barre le couloir de plein fouet, les pics punissent celui qui
        // s'arrête derrière : la machine entière devient le danger du secteur.
        const offset=Math.min(gantry/2+1.15,length/2-.9);
        for(const [kind,sign,damage,depth] of [['press',-1,34,1.4],['spikes',1,24,1.2]]){
          const x=alongX?c.x+sign*offset:c.x,z=alongX?c.z:c.z+sign*offset;
          w.traps.push({id:'trap-'+coupe+'-'+kind,barrier,kind,x,y:baseY,baseY,z,
            w:alongX?depth:span,d:alongX?span:depth,h:kind==='press'?.65:1.1,axis:alongX?'x':'z',
            travel:kind==='press'?2.6:0,period,active,warning:warningTime,phase,damage,destructibleId});
          box([x,baseY+.015,z],alongX?[depth+.5,.03,span]:[span,.03,depth+.5],0,'trap_plate',{region,assembly,color:[.17,.19,.20]});
        }
        // Cadre massif : montants, rails de roulement et moteurs se voient de loin.
        // Montants hors de la zone praticable, rails et moteurs écartés du centre :
        // un couloir de plein air doit garder son ciel ouvert au point de circulation.
        const anchor=half+.45;
        for(const q of [-1,1]){
          const px=alongX?c.x:c.x+q*anchor,pz=alongX?c.z+q*anchor:c.z;
          box([px,baseY+1.9,pz],alongX?[gantry,3.8,.26]:[.26,3.8,gantry],1,'trap_frame',{region,assembly});
          box([px,baseY+3.62,pz],alongX?[gantry+.2,.22,.4]:[.4,.22,gantry+.2],1,'trap_beam',{region,assembly});
          // Lampe d'annonce : une machine qu'on ne voit pas à trente mètres n'annonce
          // rien du tout. Elle est émissive, donc lit sa couleur même à contre-jour.
          add('cylinder',[px,baseY+3.94,pz],[.17,.17,.17],4,'trap_lamp',{region,assembly,r:alongX?[0,0,Math.PI/2]:[Math.PI/2,0,0],emissive:.62,color:[1,.52,.07]});
        }
        // Barres d'alerte de part et d'autre du couloir, au-dessus des montants : la
        // coupe se lit comme une seule machine de loin, et le ciel du couloir reste
        // ouvert au point de circulation (checks/world.test.mjs l'exige).
        for(const q of [-1,1]){
          const hx=alongX?c.x:c.x+q*half*.55,hz=alongX?c.z+q*half*.55:c.z;
          box([hx,baseY+3.78,hz],alongX?[span*.42,.1,.16]:[.16,.1,span*.42],4,'trap_hazard',{region,assembly,emissive:.3,color:[.95,.5,.06]});
        }
        for(const s of [-1,1])add('cylinder',[alongX?c.x+s*(gantry/2+.55):c.x,baseY+3.3,alongX?c.z:c.z+s*(gantry/2+.55)],[.5,.28,.5],1,'trap_motor',{region,assembly,r:alongX?[0,0,Math.PI/2]:[Math.PI/2,0,0]});
        for(let j=0;j<4;j++){
          const u=-span/2+(j+.5)*span/4;
          box([alongX?c.x-offset-1.1:c.x+u,baseY+.037,alongX?c.z+u:c.z-offset-1.1],alongX?[.55,.022,.2]:[.2,.022,.55],5,'trap_warning',{region,assembly,color:theme.alt});
        }
        chosen.push({x:c.x,z:c.z,r:span/2+2});
      }
      if(!w.traps.length)throw new Error('No mandatory trap position '+w.stage+'/'+w.seed);
    }
    // Clearly marked pressure conduits. Ordinary dry service tubing can also
    // break, while these valves identify the hot, damaging gas system.
    for(let i=0;i<4;i++){
      let room,point;
      for(const r of yards.slice(i%yards.length).concat(w.rooms.filter(r=>r.id!==0&&!r.bossArena))){const q=spot(r,.7,i===3);if(q){room=r;point=q;break;}}
      if(!point)throw new Error('No safe pressure pipe position');
      const {x,z}=point,y=room.y,dx=room.x-x,dz=room.z-z,len=FMath.hypot2(dx,dz),id='pipe-'+i,region='room-'+room.id,assembly='pressure-'+i;
      const pipe={id,x,y:y+1.03,z,dx:dx/len,dy:0,dz:dz/len,length:3,radius:.45,r:1.6,delay:i===3?1.4:1,duration:i===3?3:7,damage:8,period:i===3?16:0,phase:i===3?5:0};
      pipe.nozzle=[x+pipe.dx*.46,pipe.y,z+pipe.dz*.46];
      w.pipes.push(pipe);chosen.push({...point,r:.8});
      box([x,y+.66,z],[.55,1.32,.55],0,'pressure_manifold',{region,assembly},true);
      add('cylinder',[x,y+1.03,z],[.27,2.25,.27],1,'pressure_pipe',{region,assembly,r:[0,0,Math.PI/2]});
      // The discharge has a real metal mouth, including in the unbroken scene.
      // Its rear end enters the manifold; its front cap is the physical nozzle.
      pipe.nozzleMesh=w.meshes.length;
      add('cylinder',[x+pipe.dx*.28,pipe.y,z+pipe.dz*.28],[.24,.36,.24],0,'pressure_nozzle',{region,assembly,r:[Math.PI/2,FMath.atan2(pipe.dx,pipe.dz),0]});
      for(const q of [-1,1]){
        add('cylinder',[x+q*.85,y+1.03,z],[.43,.1,.43],0,'pressure_flange',{region,assembly,r:[0,0,Math.PI/2]});
        box([x+q*.85,y+.46,z],[.12,.92,.16],1,'pressure_support',{region,assembly});
      }
      add('ring',[x,y+1.03,z+.31],[.45,.08,.45],6,'pressure_valve',{region,assembly,r:[Math.PI/2,0,0],emissive:.15});
      box([x,y+1.41,z],[.62,.09,.62],5,'pressure_warning',{region,assembly,color:theme.alt});
    }
    const stats=w.detailStats;stats.added=w.meshes.length-stats.base;stats.tiers=[w.meshes.filter(m=>!m.detail).length,w.meshes.filter(m=>m.detail===1).length,w.meshes.filter(m=>m.detail===2).length];
  }
  function demolitionMetadata(w,legacyTraps=false){
    const out=w.meshes,groups=[],owners=new Map(),byRegion=new Map(),explicit=new Map();
    const bbox=m=>{const [rx,ry,rz]=m.r||[0,0,0],a=FMath.cos(rx),b=FMath.sin(rx),c=FMath.cos(ry),d=FMath.sin(ry),e=FMath.cos(rz),f=FMath.sin(rz),r=[e*c,e*d*b-f*a,e*d*a+f*b,f*c,f*d*b+e*a,f*d*a-e*b,-d,c*b,c*a],h0=(Math.abs(r[0]*m.s[0])+Math.abs(r[1]*m.s[1])+Math.abs(r[2]*m.s[2]))/2,h1=(Math.abs(r[3]*m.s[0])+Math.abs(r[4]*m.s[1])+Math.abs(r[5]*m.s[2]))/2,h2=(Math.abs(r[6]*m.s[0])+Math.abs(r[7]*m.s[1])+Math.abs(r[8]*m.s[2]))/2;return {minX:m.p[0]-h0,maxX:m.p[0]+h0,minY:m.p[1]-h1,maxY:m.p[1]+h1,minZ:m.p[2]-h2,maxZ:m.p[2]+h2};};
    const boxes=out.map(bbox);
    // Enveloppe d'une liste d'indices de maillages : mêmes bornes et mêmes clés dans
    // le même ordre que l'ancienne union, sans tableau intermédiaire ni propagation
    // de valeurs non finies différente (Math.min/Math.max gardent leur sémantique).
    const unionOf=indices=>{let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
      for(const i of indices){const b=boxes[i];minX=Math.min(minX,b.minX);maxX=Math.max(maxX,b.maxX);minY=Math.min(minY,b.minY);maxY=Math.max(maxY,b.maxY);minZ=Math.min(minZ,b.minZ);maxZ=Math.max(maxZ,b.maxZ);}
      return {minX,maxX,minY,maxY,minZ,maxZ};};
    const distance=(p,b)=>FMath.hypot3(Math.max(b.minX-p[0],0,p[0]-b.maxX),Math.max(b.minY-p[1],0,p[1]-b.maxY),Math.max(b.minZ-p[2],0,p[2]-b.maxZ));
    // Index des colliers par maillage : même contenu et même ordre croissant que le
    // balayage complet précédent, sans parcourir tous les colliers à chaque groupe.
    const collidersByMesh=new Map();
    for(let i=0;i<w.colliders.length;i++){const mesh=w.colliders[i].mesh,known=collidersByMesh.get(mesh);if(known)known.push(i);else collidersByMesh.set(mesh,[i]);}
    const collidersOf=members=>{const found=[];for(const i of members)for(const ci of collidersByMesh.get(i)||[])found.push(ci);return found.sort((a,b)=>a-b);};
    function group(id,kind,members,colliders=[],strength=6){const g={id,kind,meshes:members,colliders,strength,region:out[members[0]].region,bounds:unionOf(members)};groups.push(g);for(const i of members)owners.set(i,g);return g;}
    for(const t of w.trees){const members=Array.from({length:t.meshCount},(_,j)=>t.mesh+j),indices=collidersOf(members);const g=group('tree-'+t.mesh,'tree',members,indices,7);t.destructibleId=g.id;}
    out.forEach((m,i)=>{if(m.assembly){if(!explicit.has(m.assembly))explicit.set(m.assembly,[]);explicit.get(m.assembly).push(i);}});
    for(const [id,members] of explicit){const machine=id.startsWith('trap-frame');group(id,id.startsWith('pressure')?'pipe':'prop',members,collidersOf(members),id.startsWith('pressure')?3:machine&&!legacyTraps?40:12);}
    for(const [ci,c] of w.colliders.entries()){
      const m=out[c.mesh];if(m.terrain||m.ground||m.indestructible||owners.has(c.mesh))continue;
      const [x,h,z]=m.s,kind=m.category==='ceiling'?'roof':m.category==='arena_pier'?'support':Math.min(x,z)<1.2&&Math.max(x,z)>2.5&&h>1.8?'wall':h>2.5&&x<1.5&&z<1.5?'support':'prop';
      const g=group('solid-'+c.mesh,kind,[c.mesh],[ci],kind==='wall'?18:kind==='roof'?16:kind==='support'?14:6);
      if(m.category==='reinforcement_baffle')g.freestanding=true;
      if(!byRegion.has(m.region))byRegion.set(m.region,[]);byRegion.get(m.region).push(g);
    }
    // Attach fittings to their actual nearby solid. Ceiling networks belong to
    // the roof, wall cladding to wall segments, roots and canopies to one tree.
    const loose=new Map();
    for(const [i,m] of out.entries()){
      if(owners.has(i)||m.terrain||m.ground||m.indestructible)continue;
      let near=null;for(const g of byRegion.get(m.region)||[]){const d=distance(m.p,g.bounds);if(near===null||d<near.d)near={g,d};}
      if(near&&near.d<(m.detail?1.45:.85)){near.g.meshes.push(i);owners.set(i,near.g);continue;}
      const key=(m.region||'free')+':'+Math.floor(m.p[0]/2)+','+Math.floor(m.p[1]/2)+','+Math.floor(m.p[2]/2)+':'+(m.mat===11?'plant':'dressing');
      if(!loose.has(key))loose.set(key,[]);loose.get(key).push(i);
    }
    for(const [key,members] of loose)group('decor-'+key,'decor',members,[],1);
    for(const g of groups){g.meshes.sort((a,b)=>a-b);g.bounds=unionOf(g.meshes);for(const i of g.meshes)out[i].destructibleId=g.id;}
    for(const roof of groups.filter(g=>g.kind==='roof')){
      const room=w.rooms.find(r=>'room-'+r.id===roof.region),base=room?.y??Math.min(...(byRegion.get(roof.region)||[]).map(g=>g.bounds.minY));
      roof.supports=groups.filter(g=>g.region===roof.region&&!g.freestanding&&['wall','support'].includes(g.kind)&&g.bounds.minY<base+.5).map(g=>g.id);roof.supportRatio=.38;roof.dependents=groups.filter(g=>g!==roof&&g.region===roof.region&&!['wall','support'].includes(g.kind)&&g.bounds.minY>base+2.7).map(g=>g.id);
    }
    const nearest=(x,y,z,region)=>groups.filter(g=>(!region||g.region===region)&&g.kind!=='decor').map(g=>({g,d:distance([x,y,z],g.bounds)})).sort((a,b)=>a.d-b.d)[0]?.g;
    for(const a of (w.machinery||[]).concat(w.ambience||[])){const g=nearest(a.x,a.y,a.z,a.room===undefined?undefined:'room-'+a.room);if(g)a.destructibleId=g.id;}
    for(const light of w.lights){if(light.trophyId)continue;const g=nearest(...light.p,light.region);if(g)light.destructibleId=g.id;}
    for(const p of w.pipes)p.destructibleId='pressure-'+p.id.slice(5);
    for(const t of w.traps)t.destructibleId=t.destructibleId||'trap-frame-'+t.id.slice(5);
    for(const m of w.mechanisms){const g=nearest(m.x,m.y+.6,m.z);if(g)m.destructibleId=g.id;}
    // Anchors are existing pressure systems and trap machinery, never invisible
    // colliders or freshly spawned props. The director may only play real cues.
    w.horrorSites=w.pipes.map(p=>({id:'horror-'+p.id,x:p.x,y:p.y-1.03,z:p.z,kind:'steam',radius:3,destructibleId:p.destructibleId})).concat(w.traps.map(t=>({id:'horror-'+t.id,x:t.x,y:t.baseY,z:t.z,kind:t.kind==='press'?'collapse':'alarm',radius:3,destructibleId:t.destructibleId}))).filter(q=>FMath.hypot2(q.x-w.spawn.x,q.z-w.spawn.z)>16);
    w.destructibles=groups;w.destructionVersion=1;
  }
  function roomDepths(w){
    const depth=new Map([[0,0]]);
    for(let pass=0;pass<w.rooms.length;pass++)for(const c of w.connections)for(const [a,b] of [[c.from,c.to],[c.to,c.from]])if(depth.has(a)&&(!depth.has(b)||depth.get(b)>depth.get(a)+1))depth.set(b,depth.get(a)+1);
    return depth;
  }
  function pointSegment(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));return FMath.hypot2(x-a.x-dx*t,z-a.z-dz*t);}
  function nearBox(x,z,b,r){return FMath.hypot2(Math.max(b.minX-x,0,x-b.maxX),Math.max(b.minZ-z,0,z-b.maxZ))<r;}
  function safeSupply(w,x,z,r=.6){
    const y=floorHeight(w,x,z);if(y===null||!isWalkable(w,x,z,r))return false;
    if(w.hazards.some(h=>Math.abs(h.y-y)<.5&&FMath.hypot2(x-h.x,z-h.z)<h.r+r+.45))return false;
    if(w.traps.some(t=>Math.abs(t.baseY-y)<.5&&FMath.hypot2(x-t.x,z-t.z)<(t.kind==='blade'?3:1.8)+r))return false;
    for(const p of w.pipes)if(Math.abs(p.y-1.03-y)<.5){const a={x:p.nozzle[0],z:p.nozzle[2]},b={x:a.x+p.dx*p.length,z:a.z+p.dz*p.length};if(FMath.hypot2(x-p.x,z-p.z)<2+r||pointSegment(x,z,a,b)<1.8+r||p.period&&FMath.hypot2(x-a.x,z-a.z)<3.2+r)return false;}
    return true;
  }
  function shopsWorld(w,theme){
    const arena=w.rooms.find(r=>r.bossArena),rooms=[w.rooms[0],w.rooms[[6,6,7][w.stage]],arena];w.shops=[];
    const reserved=[w.spawn,w.exit,...w.cores,...w.pickups,...w.mechanisms,...w.lifts.flatMap(l=>[l.lowerCall,l.upperCall]),...w.jumpPads.flatMap(p=>[p,p.target])];
    for(const [i,r] of rooms.entries()){
      const candidates=i===2?[[-23,-17],[-23,17],[-22,-23],[-22,23]]:[[-2.8,1.8],[-4.8,1.8],[4.8,-1.8],[-5.8,-4.2],[5.8,4.2],[-6.8,4.2],[6.8,-4.2]];
      let spot;
      for(const [dx,dz] of candidates){const p={x:r.x+dx,y:r.y,z:r.z+dz},front={x:p.x,y:p.y,z:p.z+1.05};if(safeSupply(w,p.x,p.z,.75)&&safeSupply(w,front.x,front.z,.42)&&[p,front].every(a=>reserved.every(q=>FMath.hypot2(a.x-q.x,a.z-q.z)>1.2))){spot=p;break;}}
      if(!spot)throw new Error('No safe workshop '+w.stage+'/'+i);
      const {x,y,z}=spot,region='room-'+r.id,add=(p,s,mat,category,extra={})=>{const m={shape:'box',p,s,mat,region,category,outdoor:r.outdoor,structural:true,indestructible:true,...extra};w.meshes.push(m);return m;};
      const mesh=w.meshes.length;add([x,y+.72,z],[1.02,1.44,.66],0,'shop_terminal',{solid:true});
      w.colliders.push({minX:x-.51,maxX:x+.51,minY:y,maxY:y+1.44,minZ:z-.33,maxZ:z+.33,mesh});
      add([x,y+.10,z],[1.18,.20,.84],1,'shop_foot');add([x,y+1.49,z],[1.12,.10,.76],1,'shop_frame');
      add([x,y+1.09,z+.342],[.76,.46,.022],7,'shop_display');
      add([x,y+1.1,z+.358],[.60,.31,.012],4,'shop_signal',{color:theme.main,emissive:.35});
      for(const q of [-1,1])add([x+q*.34,y+.65,z+.35],[.17,.08,.06],5,'shop_switch',{color:theme.alt,emissive:.25});
      const shop={id:'shop-'+i,name:['Atelier de campagne','Comptoir de maintenance','Forge du colosse'][i],x,y,z:z+1.05,terminal:{x,y,z},yaw:0,zoneId:r.id};w.shops.push(shop);reserved.push(shop,spot);
    }
  }
  // Each reserve arrives from an actual service bay, behind one opaque wall.
  // Four reusable places, spaced at least 1.5 m apart, fit the entire weapon silhouette.
  // The flood fill tests that every place has a physical way around the screen.
  function reinforcementBays(w,theme){
    const overlap=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
    const depths=roomDepths(w);
    const choose=r=>{
      const bounds={minX:r.x-r.w/2,maxX:r.x+r.w/2,minZ:r.z-r.d/2,maxZ:r.z+r.d/2};
      const boxes=w.colliders.filter(c=>c.minY<r.y+3.1&&c.maxY>r.y+.05&&overlap(c,bounds));
      const points=[w.spawn,w.exit,...w.cores,...w.mechanisms,...w.shops,...w.lifts.flatMap(l=>[l.lowerCall,l.upperCall])].filter(p=>Math.abs((p.y||0)-r.y)<.5);
      const avoid=[...w.traps.map(t=>({x:t.x,y:t.baseY,z:t.z,r:t.kind==='blade'?2.85:1.75})),...w.pipes.map(p=>({x:p.x,y:p.y-1.03,z:p.z,r:1.5})),...w.hazards.map(h=>({...h,r:h.r+.6}))].filter(p=>Math.abs(p.y-r.y)<.5);
      const step=.4,nx=Math.ceil(r.w/step),nz=Math.ceil(r.d/step),count=nx*nz,px=i=>bounds.minX+(i+.5)*step,pz=i=>bounds.minZ+(i+.5)*step;
      const free=(x,z,rad=.42)=>Math.abs(x-r.x)<r.w/2-rad-.08&&Math.abs(z-r.z)<r.d/2-rad-.08&&!boxes.some(c=>c.minY<r.y+2.2&&nearBox(x,z,c,rad));
      const base=new Uint8Array(count);for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)base[z*nx+x]=free(px(x),pz(z));
      const nearest=(p,mask)=>{const a=[];for(let i=0;i<count;i++)if(mask[i]&&FMath.hypot2(px(i%nx)-p.x,pz(Math.floor(i/nx))-p.z)<.6)a.push(i);return a;};
      const parents=w.connections.flatMap(c=>c.from===r.id?[c.to]:c.to===r.id?[c.from]:[]).filter(id=>depths.get(id)<depths.get(r.id)).sort((a,b)=>a-b),parent=w.rooms[parents[0]],preferred=[Math.sign(r.x-parent.x),Math.sign(r.z-parent.z)];
      const normals=[preferred,...[[0,1],[0,-1],[1,0],[-1,0]].filter(n=>n[0]!==preferred[0]||n[1]!==preferred[1])];
      for(const normal of normals)for(const width of [5.4,5.1,4.8])for(const depth of [4.6,3.8,3.0,2.6,5.4,6.3,7.3,8.3])for(const lateral of [0,1.4,-1.4,3.6,-3.6,4.8,-4.8]){
        const tangent=[normal[1],-normal[0]],x=r.x+normal[0]*depth+tangent[0]*lateral,z=r.z+normal[1]*depth+tangent[1]*lateral;
        const panel={minX:x-(normal[0]?.42:width)/2,maxX:x+(normal[0]?.42:width)/2,minZ:z-(normal[1]?.42:width)/2,maxZ:z+(normal[1]?.42:width)/2,minY:r.y,maxY:r.y+3.05};
        if(boxes.some(c=>overlap(panel,c))||avoid.some(p=>nearBox(p.x,p.z,panel,p.r))||points.some(p=>nearBox(p.x,p.z,panel,.7))||w.jumpPads.some(p=>pointSegment(x,z,p,p.target)<width/2+1.5))continue;
        const entries=[[-.85,1.9],[.85,1.9],[-.85,3.4],[.85,3.4]].map(([t,d])=>({x:x+normal[0]*d+tangent[0]*t,y:r.y,z:z+normal[1]*d+tangent[1]*t}));
        if(entries.some(p=>!free(p.x,p.z,.70)||avoid.some(q=>FMath.hypot2(p.x-q.x,p.z-q.z)<q.r+.6)||points.some(q=>FMath.hypot2(p.x-q.x,p.z-q.z)<.9)||w.jumpPads.some(q=>FMath.hypot2(p.x-q.x,p.z-q.z)<2||FMath.hypot2(p.x-q.target.x,p.z-q.target.z)<2)))continue;
        const mask=base.map((v,i)=>v&&!nearBox(px(i%nx),pz(Math.floor(i/nx)),panel,.42)),starts=nearest(r,mask);if(!starts.length)continue;
        const seen=new Uint8Array(count),queue=starts.slice();for(const i of starts)seen[i]=1;
        for(let j=0;j<queue.length;j++){const i=queue[j],ix=i%nx,iz=Math.floor(i/nx);for(const k of [ix?i-1:-1,ix+1<nx?i+1:-1,iz?i-nx:-1,iz+1<nz?i+nx:-1])if(k>=0&&mask[k]&&!seen[k]){seen[k]=1;queue.push(k);}}
        if(entries.some(p=>!nearest(p,seen).length))continue;
        return {x,y:r.y,z,width,normal,tangent,entries,panel};
      }
      throw new Error('No safe reinforcement bay '+w.seed+'/'+w.stage+'/'+r.id);
    };
    function openEntries(r,b){
      // Natural cover may be a full adjoining room away: layout centres are
      // 41–52 m apart. Lifts are not infantry routes; use actual walking links.
      const links=w.connections.filter(c=>!c.liftId&&(c.from===r.id||c.to===r.id)),neighbors=links.map(c=>w.rooms[c.from===r.id?c.to:c.from]).filter(q=>q&&!q.bossArena),rooms=[r,...neighbors];
      const approach=(q,room)=>FMath.hypot2(q.x-room.x,q.z-room.z)+FMath.hypot3(room.x-r.x,room.y-r.y,room.z-r.z)+4;
      const avoid=[w.spawn,w.exit,...w.cores,...w.mechanisms,...w.shops,...w.jumpPads.flatMap(q=>[q,q.target])],candidates=b.entries.map(q=>({...q,room:r.id,travel:approach(q,r),mask:0,rank:0}));
      const incoming=(b.normal[0]?r.w:r.d)/2-1.5,probes=[[r.x,r.z],[r.x-b.normal[0]*incoming,r.z-b.normal[1]*incoming],[r.x-r.w*.27,r.z+r.d*.23],[r.x+r.w*.27,r.z-r.d*.23]].filter(([x,z])=>isWalkable(w,x,z,.28)&&Math.abs((floorHeight(w,x,z)??-999)-r.y)<.08).map(([x,z])=>[x,r.y+1.62,z]);
      function covers(eye,target,boxes){
        return boxes.some(c=>{let lo=0,hi=1;for(const [i,min,max] of [[0,c.minX,c.maxX],[1,c.minY,c.maxY],[2,c.minZ,c.maxZ]]){const d=target[i]-eye[i];if(Math.abs(d)<1e-8){if(eye[i]<min||eye[i]>max)return false;}else{const a=(min-eye[i])/d,z=(max-eye[i])/d;lo=Math.max(lo,Math.min(a,z));hi=Math.min(hi,Math.max(a,z));if(lo>hi)return false;}}return hi>0&&lo<.98;});
      }
      function maskFor(q){
        const yaw=FMath.atan2(r.x-q.x,q.z-r.z),samples=[[0,0],[-.9,0],[.9,0],[0,-.9],[0,.9],[-.65,-.65],[-.65,.65],[.65,-.65],[.65,.65],[FMath.sin(yaw)*1.5,-FMath.cos(yaw)*1.5]];let mask=0;
        for(let i=0;i<probes.length;i++){
          const eye=probes[i];if(FMath.hypot2(q.x-eye[0],q.z-eye[2])<10)continue;
          const boxes=w.colliders.filter(c=>c.maxX>=Math.min(eye[0],q.x-1.5)&&c.minX<=Math.max(eye[0],q.x+1.5)&&c.maxZ>=Math.min(eye[2],q.z-1.5)&&c.minZ<=Math.max(eye[2],q.z+1.5)&&c.maxY>=Math.min(eye[1],q.y+.2)&&c.minY<=Math.max(eye[1],q.y+2.15));
          if([.2,1.1,2.15].every(h=>samples.every(([dx,dz])=>covers(eye,[q.x+dx,q.y+h,q.z+dz],boxes))))mask|=1<<i;
        }
        return mask;
      }
      const bits=n=>{let count=0;for(;n;n&=n-1)count++;return count;};
      function offer(q,room,travel=approach(q,room)){
        if(!Number.isFinite(q.y)||FMath.hypot2(q.x-r.x,q.z-r.z)>80||!isWalkable(w,q.x,q.z,.85)||Math.abs((floorHeight(w,q.x,q.z)??-999)-q.y)>.08||avoid.some(a=>FMath.hypot2(a.x-q.x,a.z-q.z)<2)||!w.walkable.some(f=>!f.substrate&&!f.fallback&&Math.abs(q.x-f.x)<=f.w/2&&Math.abs(q.z-f.z)<=f.d/2))return;
        if(candidates.some(a=>FMath.hypot2(a.x-q.x,a.z-q.z)<.2))return;
        q.room=room.id;q.travel=travel;q.mask=maskFor(q);q.rank=bits(q.mask)*20+(room!==r?3:0)+(depths.get(room.id)<depths.get(r.id)?2:0)-q.travel*.015;candidates.push(q);
      }
      for(const room of rooms)for(const sx of [-1,1])for(const sz of [-1,1])for(const inset of [2.6,4.5,1.7,6.3,7.8]){
        if(inset>Math.min(room.w,room.d)/2-1)continue;
        const q={x:room.x+sx*(room.w/2-inset),y:room.y,z:room.z+sz*(room.d/2-inset)};
        offer(q,room);
      }
      // Quarry corners can be occupied by natural rock. Existing corridor turns
      // beyond the adjacent room provide cover without planting a new baffle.
      for(const room of neighbors)for(const link of w.connections.filter(c=>!c.liftId&&(c.from===room.id||c.to===room.id))){
        const other=w.rooms[link.from===room.id?link.to:link.from];if(!other||other===r||other.bossArena)continue;
        const length=FMath.hypot2(other.x-room.x,other.z-room.z),dx=(other.x-room.x)/length,dz=(other.z-room.z)/length,near=(dx?room.w:room.d)/2,far=length-(dx?other.w:other.d)/2-1.3;
        for(const at of [near+2,near+6,near+10])if(at<far)for(const side of [-.8,.8]){const q={x:room.x+dx*at-dz*side,z:room.z+dz*at+dx*side};q.y=floorHeight(w,q.x,q.z);offer(q,room,FMath.hypot2(room.x-r.x,room.z-r.z)+at+4);}
      }
      const selected=[];let covered=0;
      while(selected.length<8){
        const q=candidates.filter(q=>selected.every(a=>FMath.hypot2(a.x-q.x,a.z-q.z)>=1.75)).sort((a,b)=>(bits(b.mask&~covered)*40+b.rank-selected.filter(q=>q.room===b.room).length*2)-(bits(a.mask&~covered)*40+a.rank-selected.filter(q=>q.room===a.room).length*2))[0];
        if(!q)break;selected.push(q);covered|=q.mask;
      }
      return (selected.length>=4?selected:candidates.slice(0,4)).map(q=>({x:q.x,y:q.y,z:q.z,travel:q.travel}));
    }
    w.encounterBays=[];
    for(const r of w.rooms.filter(r=>r.id&&!r.bossArena)){
      const b=choose(r),region='room-'+r.id,mesh=w.meshes.length,extra={outdoor:r.outdoor,region,structural:true};
      if(w.campaignVersion===2){w.encounterBays.push({zoneId:r.id,x:b.x,y:b.y,z:b.z,width:b.width,normal:b.normal,coverMesh:null,open:true,reserveEntries:b.entries.map(q=>({...q})),spawnEntries:openEntries(r,b)});continue;}
      const add=(u,y,d,s,mat,category,props={})=>{const p=[b.x+b.tangent[0]*u+b.normal[0]*d,b.y+y,b.z+b.tangent[1]*u+b.normal[1]*d];w.meshes.push({shape:'box',p,s:b.normal[0]?[s[2],s[1],s[0]]:s,mat,category,...extra,...props});};
      add(0,1.525,0,[b.width,3.05,.42],0,'reinforcement_baffle',{solid:true,color:theme.wall.map(v=>v*.72)});
      w.colliders.push({...b.panel,mesh});
      for(const q of [-1,1]){
        add(q*(b.width/2-.13),1.525,-.23,[.15,3.05,.06],1,'reinforcement_frame');
        add(0,.18,q*.23,[b.width-.10,.16,.05],1,'reinforcement_frame');
      }
      for(const q of [-1,0,1]){add(q*1.18,1.54,-.224,[.62,.07,.03],5,'reinforcement_mark',{color:theme.alt,emissive:.12});add(q*1.18,1.20,-.224,[.04,.42,.03],1,'reinforcement_mark');}
      w.encounterBays.push({zoneId:r.id,x:b.x,y:b.y,z:b.z,width:b.width,normal:b.normal,coverMesh:mesh,spawnEntries:b.entries});
    }
  }
  function suppliesWorld(w){
    const depths=roomDepths(w),initial=new Set(w.connections.flatMap(c=>c.from===0?[c.to]:c.to===0?[c.from]:[]));
    w.progression={version:1,weaponSlots:4,startWeapons:w.stage===0?[true,false,false,false]:[true,true,true,false],startAmmo:[[48,0,0,0],[72,12,4,0],[84,16,5,0]][w.stage],ammoCaps:[180,36,12,16],maxActive:[8,10,12][w.stage]};
    if(w.campaign)Object.assign(w.progression,{weaponSlots:5,startWeapons:[false,false,false,false,true],startAmmo:[0,0,0,0,1],ammoCaps:[180,36,12,16,1],maxActive:w.campaignProfile.maxActive});
    w.pickups=w.pickups.filter(p=>{const r=w.rooms.find(r=>Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.z-r.z)<r.d/2);return r&&(r.id===0||r.bossArena||FMath.hypot2(p.x-r.x-2.5,p.z-r.z-1.5)<.1);}).map((p,i)=>({...p,id:'health-'+i,kind:'health',amount:28,zoneId:w.rooms.find(r=>Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.z-r.z)<r.d/2).id}));
    const reserved=[w.spawn,w.exit,...w.cores,...w.mechanisms,...w.shops,...w.lifts.flatMap(l=>[l.lowerCall,l.upperCall]),...w.jumpPads.flatMap(p=>[p,p.target])];
    // Service-bay cover follows the real incoming corridor. A small health case
    // may move to a nearby free tile rather than force its screen to face sideways.
    for(const p of w.pickups)if(!isWalkable(w,p.x,p.z,.6)){
      const r=w.rooms[p.zoneId],candidates=[[-2.1,-1.5],[2.8,-4.7],[-.7,1.7],[1.4,-1.5],[-1.4,-3.0]];
      const q=candidates.map(([dx,dz])=>({x:r.x+dx,z:r.z+dz})).find(q=>safeSupply(w,q.x,q.z,.6)&&reserved.every(a=>FMath.hypot2(q.x-a.x,q.z-a.z)>1.2)&&w.pickups.every(a=>a===p||FMath.hypot2(q.x-a.x,q.z-a.z)>1.12)&&w.encounterBays.every(b=>b.spawnEntries.every(a=>FMath.hypot2(q.x-a.x,q.z-a.z)>1.2)));
      if(!q)throw new Error('No clear health case '+w.stage+'/'+p.zoneId);p.x=q.x;p.z=q.z;p.y=floorHeight(w,q.x,q.z);
    }
    const free=(p,radius=.65)=>safeSupply(w,p.x,p.z,radius)&&reserved.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>1.2)&&w.pickups.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>1.12)&&w.encounterBays.every(b=>b.spawnEntries.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>1.2));
    const place=(room,kind,weapon,amount,candidates,label)=>{
      const p=candidates.find(p=>free(p,kind==='weapon'?.75:.57));if(!p)throw new Error('No supply position '+w.seed+'/'+w.stage+'/'+room.id+'/'+label);
      const value={id:'supply-'+room.id+'-'+label,kind,weapon,amount,x:p.x,y:floorHeight(w,p.x,p.z),z:p.z,zoneId:room.id};w.pickups.push(value);return value;
    };
    for(const r of w.rooms.filter(r=>r.id&&!r.bossArena)){
      const parents=w.connections.flatMap(c=>c.from===r.id?[c.to]:c.to===r.id?[c.from]:[]).filter(id=>depths.get(id)<depths.get(r.id)).map(id=>w.rooms[id]).sort((a,b)=>a.id-b.id);
      const candidates=[];
      for(const parent of parents){const nx=Math.sign(parent.x-r.x),nz=Math.sign(parent.z-r.z),tx=nz,tz=-nx,extent=nx?r.w/2:r.d/2;
        for(const d of [3.7,2.4,1.0,-1.4,-2.6])for(const lateral of [-1.2,1.2,0]){const x=r.x+nx*(extent+d)+tx*lateral,z=r.z+nz*(extent+d)+tz*lateral;if(Math.abs(floorHeight(w,x,z)-r.y)<2.1)candidates.push({x,z});}
      }
      // A raised lift dock can consume an entire approach. Nearby floor cells
      // remain reachable before any mandatory combat or objective quota.
      for(const dz of [-1.5,1.5,-3,3,0,-5,5])for(const dx of [-1.5,1.5,-3,3,0,-5,5])candidates.push({x:r.x+dx,z:r.z+dz});
      if(initial.has(r.id)){
        place(r,'ammo',0,40,candidates,'cells');
        const discovery=[{x:r.x-.7,z:r.z+1.7},{x:r.x+.6,z:r.z-1.8},...candidates.slice().reverse()];
        place(r,'weapon',1,8,discovery,'fracture');
      }else{
        place(r,'ammo',0,[80,104,112][w.stage],candidates,'cells');
        place(r,'ammo',1,[12,16,16][w.stage],candidates,'shells');
        if(depths.get(r.id)===2)place(r,'weapon',2,4,candidates,'rupture');
        else place(r,'ammo',2,w.stage===0?2:3,candidates,'rockets');
      }
    }
    const arena=w.rooms.find(r=>r.bossArena);
    for(const side of [-1,1])for(const dz of [-20,20]){
      const candidates=[];for(const x of [22,20.5,23.5,21])for(const z of [dz,dz-1.4,dz+1.4,dz-2.8,dz+2.8])candidates.push({x:arena.x+side*x,z:arena.z+z});
      const key=(side<0?'w':'e')+(dz<0?'n':'s');
      place(arena,'ammo',0,[36,44,52][w.stage],candidates,'boss-cells-'+key);
      place(arena,'ammo',1,[6,8,10][w.stage],candidates,'boss-shells-'+key);
      place(arena,'ammo',2,3,candidates,'boss-rockets-'+key);
    }
  }
  // The additional equipment occupies clear tiles after the original supply
  // and patrol pass. Existing patrols, route pickups and entry cover never move.
  function armoryWorld(w){
    const depths=roomDepths(w),opening=w.rooms.filter(r=>depths.get(r.id)===1).sort((a,b)=>a.id-b.id)[0],middle=w.rooms[w.shops[1].zoneId],late=w.rooms.filter(r=>r.id&&!r.bossArena).sort((a,b)=>depths.get(b.id)-depths.get(a.id)||b.id-a.id)[0],arena=w.rooms.find(r=>r.bossArena);
    const reserved=[w.spawn,w.exit,...w.cores,...w.mechanisms,...w.shops,...w.lifts.flatMap(l=>[l.lowerCall,l.upperCall]),...w.jumpPads.flatMap(p=>[p,p.target]),...w.encounters.flatMap(e=>e.spawnEntries),...w.enemies.filter(e=>e.deployed)];
    const add=(room,kind,amount,label,preferred=[],weapon=3)=>{
      const candidates=preferred.slice();for(const z of [-1.8,1.8,-3.6,3.6,0,-5.4,5.4])for(const x of [-1.8,1.8,-3.6,3.6,0,-5.4,5.4])candidates.push({x:room.x+x,z:room.z+z});
      const point=candidates.find(p=>Math.abs(p.x-room.x)<room.w/2-1&&Math.abs(p.z-room.z)<room.d/2-1&&Math.abs(floorHeight(w,p.x,p.z)-room.y)<.01&&safeSupply(w,p.x,p.z,.75)&&reserved.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>1.65)&&w.pickups.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>1.35));
      if(!point)throw new Error('No equipment position '+w.seed+'/'+w.stage+'/'+label);
      w.pickups.push({id:'arsenal-'+label,kind,weapon,amount,x:point.x,y:room.y,z:point.z,zoneId:room.id});
    };
    add(opening,'ammo',24,'smg-cells',[],0);
    const shop=w.shops[1];add(middle,'weapon',4,'grenade-launcher',[{x:shop.x+2.1,z:shop.z},{x:shop.x-2.1,z:shop.z},{x:shop.x,z:shop.z+2.1}]);
    add(late,'ammo',4,'grenades-late');
    const outer=[];for(const x of [-22,-20.5,-23.5])for(const z of [-17.2,-15.8,17.2,15.8])outer.push({x:arena.x+x,z:arena.z+z});
    add(arena,'ammo',4,'grenades-boss',outer);
  }
  function campaignProfile(w){
    if(w.campaignVersion===2){
      const chapter=w.chapter,garrisonScale=[.55,.70,.85,1,1.15,1.30][chapter];
      return {version:2,garrison:Math.round([120,140,170][w.stage]*garrisonScale),garrisonScale,maxActive:[6,8,10,12,14,16][chapter],grenadiers:[1,3,5,7,9,11][chapter],rocketeers:[0,1,3,5,7,9][chapter],bossHp:[600,850,1200,1550,1900,2400,2900,3400,4000,4650,5300,6050,6850,7700,8600,9600,10800,12000][w.index],trialEnemies:0};
    }
    const chapter=w.chapter,percent=[35,45,55,70,85,100][chapter],garrisonScale=percent/100;
    return {version:1,garrison:Math.round([120,140,170][w.stage]*percent/100),garrisonScale,maxActive:[4,5,6,8,10,12][chapter],grenadiers:[0,2,3,5,6,8][chapter],rocketeers:[0,0,0,2,4,6][chapter],bossHpScale:[.25,.32,.45,.62,.8,1][chapter],trialEnemies:[6,9,12,15].includes(w.index)?3:0};
  }
  function campaignCounts(weights,budget){
    const sum=weights.reduce((a,b)=>a+b,0),shares=weights.map(n=>n*budget/sum),counts=shares.map(n=>Math.max(2,Math.floor(n)));
    let left=budget-counts.reduce((a,b)=>a+b,0);
    const order=shares.map((n,i)=>({i,fraction:n-Math.floor(n)})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
    for(let i=0;left>0;i++,left--)counts[order[i%order.length].i]++;
    for(let i=order.length-1;left<0;i--){const q=order[(i%order.length+order.length)%order.length];if(counts[q.i]>2){counts[q.i]--;left++;}}
    return counts;
  }
  // Campaign discoveries occupy one reserved, physically reachable equipment
  // point. The legacy racks remain untouched in worlds without the opt-in flag.
  function campaignArmory(w){
    if(w.campaignVersion===2){
      // Bosses 1, 2, 3 and 6 supply the arsenal. A duplicate grenade launcher
      // on boss 4 is a calibration; no free rack can bypass a boss reward.
      const unlock=[2,1,6,3,0];
      w.pickups=w.pickups.filter(q=>q.kind==='health'||q.kind==='ammo'&&q.weapon<4&&unlock[q.weapon]<=w.index).map(q=>q.kind==='ammo'?{...q,amount:Math.max(q.weapon===0?12:q.weapon===1?4:2,Math.round(q.amount*Math.max(.8,w.campaignProfile.garrisonScale))),requiresWeapon:q.weapon}:q);
      for(const e of w.enemies)if(e.drop&&(e.drop.weapon>=4||unlock[e.drop.weapon]>w.index))e.drop=false;
      return;
    }
    const unlock=[6,9,15,12,0],schedule=[
      {index:6,key:'smg',kind:'weapon',weapon:0,amount:60},
      {index:9,key:'shotgun',kind:'weapon',weapon:1,amount:12},
      {index:12,key:'grenade',kind:'weapon',weapon:3,amount:6},
      {index:15,key:'rocket',kind:'weapon',weapon:2,amount:4}
    ],discovery=schedule.find(q=>q.index===w.index),reserved=w.pickups.find(q=>q.id==='arsenal-grenade-launcher');
    w.pickups=w.pickups.filter(q=>q.kind==='health'||q.kind==='ammo'&&q.weapon<4&&unlock[q.weapon]<=w.index).map(q=>q.kind==='ammo'?{...q,amount:Math.max(q.weapon===0?8:q.weapon===1?2:1,Math.round(q.amount*w.campaignProfile.garrisonScale)),requiresWeapon:q.weapon}:q);
    for(const e of w.enemies)if(e.drop&&(e.drop.weapon>=4||unlock[e.drop.weapon]>w.index))e.drop=false;
    if(discovery){
      if(!reserved)throw new Error('Missing campaign equipment reservation '+w.index);
      const {key,kind,weapon,amount}=discovery;
      w.pickups.push({id:'trophy-'+key,trophyId:'trophy-'+key,kind,...(kind==='weapon'?{weapon}:{}),amount,x:reserved.x,y:reserved.y,z:reserved.z,zoneId:reserved.zoneId});
    }
  }
  // The trophy is a detour inside an existing low room. Its approach can see
  // the equipment but every reserve silhouette stays behind a real service wall.
  function campaignTrophies(w,theme){
    w.trophies=[];
    const gift=w.pickups.find(q=>q.trophyId);if(!gift)return;
    const key=gift.trophyId.slice(7),names={smg:'Mitraillette',shotgun:'Double pompe',grenade:'Lance-grenades',rocket:'Lance-roquettes'},usage={smg:'Enchaînez les rafales et surveillez la chauffe.',shotgun:'Approchez, frappez fort, reprenez votre distance.',grenade:'Faites rebondir les grenades derrière les couverts.',rocket:'Visez les groupes et gardez vos distances.'},depths=roomDepths(w);
    const reserved=[w.spawn,w.exit,...w.cores,...w.mechanisms,...w.shops,...w.lifts.flatMap(l=>[l.lowerCall,l.upperCall]),...w.jumpPads.flatMap(p=>[p,p.target]),...w.pickups.filter(q=>q!==gift),...w.enemies.filter(e=>e.deployed)];
    const segmentHit=(a,b,c)=>{let low=0,high=1;for(const [i,min,max] of [[0,c.minX,c.maxX],[1,c.minY,c.maxY],[2,c.minZ,c.maxZ]]){const d=b[i]-a[i];if(Math.abs(d)<1e-9){if(a[i]<min||a[i]>max)return false;}else{const x=(min-a[i])/d,y=(max-a[i])/d;low=Math.max(low,Math.min(x,y));high=Math.min(high,Math.max(x,y));if(low>high)return false;}}return high>0&&low<.999;};
    const safe=(p,r,rad)=>Math.abs(p.x-r.x)<r.w/2-rad-.3&&Math.abs(p.z-r.z)<r.d/2-rad-.3&&Math.abs(floorHeight(w,p.x,p.z)-r.y)<.01&&safeSupply(w,p.x,p.z,rad)&&reserved.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>rad+.7)&&w.jumpPads.every(q=>pointSegment(p.x,p.z,q,q.target)>rad+1.6);
    let chosen;
    const rooms=w.rooms.filter(r=>r.id&&!r.bossArena&&r.y===0&&depths.get(r.id)===1).sort((a,b)=>(a.id===3?-1:0)-(b.id===3?-1:0)||a.id-b.id);
    for(const r of rooms){
      const bay=w.encounterBays.find(q=>q.zoneId===r.id),screen=w.colliders.find(q=>q.mesh===bay.coverMesh);
      search:for(const d of [10,11,9,12,13,14,9.5,10.5,11.5,12.5,13.5])for(const lateral of [2.4,-2.4,3,-3,1.8,-1.8,3.6,-3.6,1.2,-1.2,0]){
        const p={x:bay.x-bay.normal[0]*d+bay.normal[1]*lateral,y:r.y,z:bay.z-bay.normal[1]*d-bay.normal[0]*lateral};
        if(Math.abs(p.x-r.x)<1.2||Math.abs(p.z-r.z)<1.2||!safe(p,r,.95))continue;
        const origin=[p.x,p.y+1.62,p.z];
        if(!bay.spawnEntries.every(q=>FMath.hypot2(q.x-p.x,q.z-p.z)>=10&&[.2,1.1,2.15].every(h=>[[0,0],[-1.5,0],[1.5,0],[0,-1.5],[0,1.5],[-.65,-.65],[-.65,.65],[.65,-.65],[.65,.65]].every(([dx,dz])=>segmentHit(origin,[q.x+dx,q.y+h,q.z+dz],screen)))))continue;
        const cache=[[-2.4,0],[2.4,0],[-2.4,1.2],[2.4,1.2],[0,2.4],[0,-2.4]].map(([u,v])=>({x:p.x+bay.normal[1]*u+bay.normal[0]*v,y:r.y,z:p.z-bay.normal[0]*u+bay.normal[1]*v})).find(q=>safe(q,r,.57));
        if(!cache)continue;chosen={r,bay,p,cache};break search;
      }
      if(chosen)break;
    }
    if(!chosen)throw new Error('No safe trophy alcove '+w.seed+'/'+w.index);
    const {r,bay,p,cache}=chosen,id=gift.trophyId,name=names[key],encounterId='trial-'+key,meshStart=w.meshes.length,region='room-'+r.id;
    Object.assign(gift,p,{zoneId:r.id});r.trophyId=id;
    const add=(shape,pos,size,mat,category,extra={})=>{w.meshes.push({shape,p:pos,s:size,mat,category,region,outdoor:r.outdoor,indestructible:true,trophyId:id,...extra});};
    add('box',[p.x,p.y+.02,p.z],[1.85,.04,1.85],1,'trophy_plinth',{solid:true,color:[.34,.30,.22]});
    w.colliders.push({minX:p.x-.925,maxX:p.x+.925,minY:p.y,maxY:p.y+.04,minZ:p.z-.925,maxZ:p.z+.925,mesh:meshStart});
    add('cylinder',[p.x,p.y+.055,p.z],[1.45,.03,1.45],3,'trophy_deck');
    add('ring',[p.x,p.y+.079,p.z],[1.68,.035,1.68],4,'trophy_signal',{color:theme.alt,emissive:.45});
    for(const side of [-1,1])for(const end of [-1,1]){
      add('box',[p.x+side*.78,p.y+.065,p.z+end*.78],[.19,.05,.19],3,'trophy_corner');
      add('box',[p.x+side*.66,p.y+.095,p.z+end*.78],[.16,.018,.055],4,'trophy_inlay',{color:theme.alt,emissive:.35});
    }
    for(let i=0;i<12;i++){const a=i*TAU/12;add('box',[p.x+FMath.cos(a)*1.14,p.y+.016,p.z+FMath.sin(a)*1.14],[.12,.022,.27],5,'trophy_floor_mark',{r:[0,-a,0],color:theme.alt,emissive:.15});}
    // A narrow portal carries the lamp from the indestructible plinth. Its
    // opening faces the service wall; the approach and pickup stay unobstructed.
    const frameBox=(pos,size,category)=>{const mesh=w.meshes.length;add('box',pos,size,3,category,{solid:true});w.colliders.push({minX:pos[0]-size[0]/2,maxX:pos[0]+size[0]/2,minY:pos[1]-size[1]/2,maxY:pos[1]+size[1]/2,minZ:pos[2]-size[2]/2,maxZ:pos[2]+size[2]/2,mesh});};
    for(const side of [-1,1]){
      const x=p.x+bay.normal[1]*side*.78,z=p.z-bay.normal[0]*side*.78;
      frameBox([x,p.y+.09,z],[.26,.10,.26],'trophy_support_foot');
      frameBox([x,p.y+1.43,z],[.12,2.68,.12],'trophy_support');
    }
    frameBox([p.x,p.y+2.74,p.z],[bay.normal[1]?1.78:.12,.10,bay.normal[0]?1.78:.12],'trophy_crossbar');
    add('ring',[p.x,p.y+2.72,p.z],[1.2,.055,1.2],1,'trophy_lamp');
    add('cylinder',[p.x,p.y+2.69,p.z],[.64,.035,.64],4,'trophy_lens',{color:theme.alt,emissive:.7});
    const lightIndex=w.lights.length;w.lights.push({p:[p.x,p.y+2.45,p.z],color:theme.alt.slice(),power:5.5,region,trophyId:id});
    w.pickups.push({id:'trial-cache-'+key,kind:'ammo',weapon:gift.weapon,requiresWeapon:gift.weapon,amount:Math.max(2,Math.ceil(gift.amount/2)),...cache,zoneId:r.id,trophyCache:id});
    const boss=w.enemies.pop(),ids=[];
    for(let i=0;i<3;i++){const point=bay.spawnEntries[i],type=key==='shotgun'||key==='rocket'?1:0;ids.push(w.enemies.length);w.enemies.push({...point,type,zoneId:r.id,squadId:1000+w.index,encounterId,wave:0,deployed:false,role:'assault',yaw:FMath.atan2(p.x-point.x,point.z-p.z),drop:{weapon:gift.weapon,amount:gift.weapon===0?4:gift.weapon===1?2:1},trophyGuard:id});}
    const bossId=w.enemies.length;w.enemies.push(boss);for(const e of w.enemies)if(e.bossWave)e.bossId=bossId;
    w.encounters.push({id:encounterId,label:'Épreuve — '+name,zoneId:r.id,trigger:{x:r.x,y:r.y,z:r.z,w:r.w+4,d:r.d+4},leashRadius:38,maxActive:3,waveGap:4,spawnEntries:bay.spawnEntries.map(q=>({...q})),waves:[{enemyIds:ids}],requiresTrophy:id});
    w.trophies.push({id,key,name,usage:usage[key],pickupId:gift.id,encounterId,grace:3,...p,zoneId:r.id,weapon:gift.weapon,meshStart,meshCount:w.meshes.length-meshStart,lightIndex,cacheId:'trial-cache-'+key,coverMesh:bay.coverMesh});
  }
  // Armor reserves are real nonblocking pickups. The shell draws their cases
  // and markers; placing them last preserves all existing supplies and trials.
  function campaignArmor(w){
    const arena=w.rooms.find(r=>r.bossArena),middle=w.shops[1],plans=[
      {id:'armor-start',amount:25,room:w.rooms[0],anchor:w.spawn},
      {id:'armor-middle',amount:25,room:w.rooms[middle.zoneId],anchor:middle},
      {id:'armor-boss',amount:50,room:arena,anchor:w.shops[2]}
    ];
    const reserved=[w.spawn,w.exit,...w.cores,...w.mechanisms,...w.shops,...w.shops.map(s=>s.terminal),...w.doors,...w.lifts.flatMap(l=>[l,l.lowerCall,l.upperCall]),...w.jumpPads.flatMap(p=>[p,p.target]),...w.encounters.flatMap(q=>q.spawnEntries),...w.trophies];
    for(const plan of plans){
      const {room:r,anchor:a}=plan,candidates=[];
      for(const [x,z] of [[2.4,0],[-2.4,0],[0,-2.4],[0,2.4],[2.4,-2.4],[-2.4,2.4]])candidates.push({x:a.x+x,z:a.z+z});
      if(r.bossArena)for(const x of [-20,20,-22,22])for(const z of [-11,11,-16,16,-20,20])candidates.push({x:r.x+x,z:r.z+z});
      for(const z of [-1.8,1.8,-3.6,3.6,-5.4,5.4,-7.2,7.2,0])for(const x of [-1.8,1.8,-3.6,3.6,-5.4,5.4,-7.2,7.2,0])candidates.push({x:r.x+x,z:r.z+z});
      const point=candidates.find(p=>Math.abs(p.x-r.x)<r.w/2-1&&Math.abs(p.z-r.z)<r.d/2-1&&Math.abs(floorHeight(w,p.x,p.z)-r.y)<.01&&safeSupply(w,p.x,p.z,.65)&&reserved.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>1.8)&&w.pickups.every(q=>FMath.hypot2(p.x-q.x,p.z-q.z)>2.1)&&w.enemies.filter(e=>e.deployed).every(e=>FMath.hypot2(p.x-e.x,p.z-e.z)>(e.bossScale?1.5*e.bossScale+1.1:1.8))&&w.jumpPads.every(q=>pointSegment(p.x,p.z,q,q.target)>2));
      if(!point)throw new Error('No safe armor reserve '+w.seed+'/'+w.index+'/'+plan.id);
      w.pickups.push({id:plan.id,kind:'armor',amount:plan.amount,x:point.x,y:r.y,z:point.z,zoneId:r.id});
    }
  }
  // All 430 IDs stay stable in the save. Only the opening patrols and the
  // colossus's six scripted guards exist physically before their wave deploys.
  function populate(w) {
    const target=w.campaign?w.campaignProfile.garrison:[120,140,170][w.stage],trialCount=w.campaign?w.campaignProfile.trialEnemies:0,depths=roomDepths(w),baseCounts=[[6,15,7,17,18,16,17,17],[8,22,24,9,22,24,24],[10,23,11,25,23,24,24,23]][w.stage],counts=w.campaign?campaignCounts(baseCounts,target-7-trialCount):baseCounts;
    const early=new Set(w.connections.flatMap(c=>c.from===0?[c.to]:c.to===0?[c.from]:[]));w.encounters=[];
    const candidates=[];
    function waveSizes(n,opening){
      if(w.campaign){const out=[],limit=[3,3,4,4,5,6][w.chapter];if(opening){let k=Math.min(n,w.chapter<2?2:3);if(n-k===1)k=k>2?k-1:k+1;out.push(k);n-=k;}const groups=Math.ceil(n/limit);for(let i=0;i<groups;i++)out.push(Math.floor(n/groups)+(i>=groups-n%groups?1:0));return out;}
      const out=[];if(opening){const k=w.stage===0?3:4;out.push(k);n-=k;}const k=Math.ceil(n/6);for(let i=0;i<k;i++)out.push(Math.floor(n/k)+(i>=k-n%k?1:0));return out;
    }
    for(const r of w.rooms.filter(r=>r.id&&!r.bossArena)){
      const bay=w.encounterBays.find(b=>b.zoneId===r.id),opening=early.has(r.id),sizes=waveSizes(counts[r.id-1],opening),patrol=[];
      if(opening)for(const dz of [0,2.4,-2.4,4.8,-4.8])for(const dx of [-2.4,0,2.4,-4.8,4.8]){
        const x=r.x+dx,z=r.z+dz;if(!safeSupply(w,x,z,.7)||FMath.hypot2(x-w.spawn.x,z-w.spawn.z)<18||(x-bay.x)*bay.normal[0]+(z-bay.z)*bay.normal[1]>-.8||w.pickups.some(p=>FMath.hypot2(x-p.x,z-p.z)<1.3)||w.mechanisms.some(p=>FMath.hypot2(x-p.x,z-p.z)<1.3)||w.jumpPads.some(p=>FMath.hypot2(x-p.x,z-p.z)<2||FMath.hypot2(x-p.target.x,z-p.target.z)<2))continue;
        patrol.push({x,y:r.y,z});
      }
      const encounter={id:'encounter-'+r.id,label:r.name,zoneId:r.id,trigger:{x:r.x,y:r.y,z:r.z,w:r.w+4,d:r.d+4},leashRadius:38,maxActive:Math.max(...sizes),waveGap:4,spawnEntries:bay.spawnEntries.map(p=>({...p})),waves:[]};
      if(w.campaignVersion===2){encounter.naturalEntries=true;encounter.leashRadius=Math.max(38,...bay.spawnEntries.map(p=>FMath.hypot2(p.x-r.x,p.z-r.z)+8));}
      if(opening&&patrol.length<sizes[0])throw new Error('No opening patrol positions '+w.stage+'/'+r.id);
      for(const [wave,n] of sizes.entries()){
        const ids=[];
        for(let j=0;j<n;j++){
          const homes=w.campaignVersion===2?bay.reserveEntries:bay.spawnEntries,index=w.enemies.length,deployed=opening&&wave===0,p=deployed?patrol[j]:homes[j%homes.length];
          const type=opening?(j%3===2?2:0):(j+wave+r.id)%3;
          const e={...p,type,zoneId:r.id,squadId:r.id*10+wave,encounterId:encounter.id,wave,deployed,role:type===1?'assault':type===2?'suppressor':['flanker','assault','suppressor'][(j+wave)%3],yaw:FMath.atan2(r.x-p.x,p.z-r.z)};
          w.enemies.push(e);ids.push(index);
        }
        encounter.waves.push({enemyIds:ids});
        if(!opening&&(depths.get(r.id)>2||wave>0))candidates.push({enemy:w.enemies[ids[0]],depth:depths.get(r.id),wave,room:r.id});
      }
      w.encounters.push(encounter);
    }
    let grenades=0,rockets=0;const grenadeGoal=w.campaign?w.campaignProfile.grenadiers:8,rocketGoal=w.campaign?w.campaignProfile.rocketeers:6;
    candidates.sort((a,b)=>a.wave-b.wave||a.depth-b.depth||a.room-b.room);
    for(const {enemy:e} of candidates){const weapon=grenades<grenadeGoal&&(grenades<=rockets||rockets===rocketGoal)?'grenade':rockets<rocketGoal?'rocket':null;if(!weapon)break;e.type=1;e.role='assault';e.weapon=weapon;if(weapon==='grenade')grenades++;else rockets++;}
    if(grenades!==grenadeGoal||rockets!==rocketGoal)throw new Error('Insufficient later heavy waves');
    const arena=w.bossArena;
    for(let i=0;i<6;i++){const a=(i+.5)*TAU/6;w.enemies.push({x:arena.x+FMath.cos(a)*26,y:arena.y,z:arena.z+FMath.sin(a)*26,type:0,zoneId:arena.room,squadId:200+Math.floor(i/3),role:'flanker',bossWave:1+Math.floor(i/3),bossId:target-1,deployed:true});}
    w.enemies.push({x:arena.x,y:arena.y,z:arena.z,type:3,boss:true,bossScale:[5.4,7.2,9][w.stage],bossKind:['colossus','siegebreaker','custodian'][w.stage],bossName:['Le Colosse de Fer','Le Brise-siège','Le Veilleur primordial'][w.stage],maxHp:w.campaignVersion===2?w.campaignProfile.bossHp:w.campaign?Math.max(30,Math.round([130,180,240][w.stage]*w.campaignProfile.bossHpScale)):[130,180,240][w.stage],arena:{...arena},zoneId:arena.room,squadId:100,role:'assault',deployed:true});
    for(const [i,e] of w.enemies.entries())e.drop=e.type===3?false:e.weapon==='rocket'?{weapon:2,amount:1}:e.weapon==='grenade'?{weapon:3,amount:1}:e.type===1?{weapon:1,amount:2}:e.type===2||i%2===0?{weapon:0,amount:4}:false;
    if(w.enemies.length!==target-trialCount)throw new Error('Incorrect finite garrison size');
  }
  function isWalkable(world, x, z, radius) {
    const r = radius === undefined ? 0.35 : radius;
    const floor=floorHeight(world,x,z);
    if(floor===null)return false;
    for (const c of world.colliders) {
      if (c.minY >= floor+1.85 || c.maxY <= floor+0.05) continue;
      const dx = Math.max(c.minX - x, 0, x - c.maxX), dz = Math.max(c.minZ - z, 0, z - c.maxZ);
      if (dx * dx + dz * dz <= r * r) return false;
    }
    return true;
  }
  function validate(world) {
    const cell = 0.5, b = world.bounds, nx = Math.ceil((b.maxX - b.minX) / cell), nz = Math.ceil((b.maxZ - b.minZ) / cell);
    const cells = new Uint8Array(nx * nz), heights = new Float32Array(nx*nz), seen = new Uint8Array(nx * nz), queue = new Int32Array(nx * nz);
    const index = (x, z) => Math.min(nz - 1, Math.max(0, Math.floor((z - b.minZ) / cell))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - b.minX) / cell)));
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x=b.minX+(ix+.5)*cell,z=b.minZ+(iz+.5)*cell,i=iz*nx+ix;
      cells[i]=isWalkable(world,x,z,.38)?1:0;heights[i]=floorHeight(world,x,z)??NaN;
    }
    let head = 0, tail = 0;
    const start = index(world.spawn.x, world.spawn.z);
    if (cells[start]) { queue[tail++] = start; seen[start] = 1; }
    while (head < tail) {
      const i = queue[head++], x = i % nx, z = Math.floor(i / nx);
      for (const j of [x > 0 ? i - 1 : -1, x < nx - 1 ? i + 1 : -1, z > 0 ? i - nx : -1, z < nz - 1 ? i + nx : -1]) {
        if (j >= 0 && cells[j] && !seen[j] && Math.abs(heights[j]-heights[i])<=.4) { seen[j] = 1; queue[tail++] = j; }
      }
    }
    const targets = [world.spawn, ...world.cores, world.exit, ...world.enemies, ...world.pickups,...(world.shops||[]),...(world.lifts||[]).flatMap(l=>[l.lowerCall,l.upperCall]),...(world.mechanisms||[]).map(m=>({x:m.x,z:m.z+.95})),...(world.jumpPads||[]).flatMap(p=>[p,p.target])];
    const errors = [];
    targets.forEach((p, i) => { if (!isWalkable(world, p.x, p.z, 0.38) || !seen[index(p.x, p.z)]) errors.push('Unreachable target ' + i); });
    if (world.meshes.length > 18000) errors.push('Mesh budget exceeded');
    if (world.colliders.length > 512) errors.push('Collider budget exceeded');
    if (world.cores.length !== 3) errors.push('Expected three relays');
    if(world.campaign?world.enemies.length!==world.campaignProfile.garrison:world.enemies.length<[120,140,170][world.stage])errors.push(world.campaign?'Incorrect campaign garrison':'Garrison below tenfold target');
    if(world.mechanisms.length!==3||world.lifts.length!==2)errors.push('Missing interactive machinery');
    const safeRoom = world.rooms[0];
    if (world.enemies.some(e => Math.abs(e.x - safeRoom.x) < safeRoom.w / 2 && Math.abs(e.z - safeRoom.z) < safeRoom.d / 2)) errors.push('Enemy in spawn chamber');
    return { ok: errors.length === 0, errors, seed: world.seed, stage: world.stage, meshes: world.meshes.length, colliders: world.colliders.length, enemies: world.enemies.length, reachableCells: tail, objectiveCount: world.cores.length + world.mechanisms.filter(m=>m.required).length + 1 };
  }
  window.FWorld = { create, validate, isWalkable, floorHeight };
}());
