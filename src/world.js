/* FERRO — deterministic architecture, constructed entirely from primitives. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const themes = [
    { title: 'Les ateliers silencieux', main: [0.12, 0.82, 0.92], alt: [1, 0.57, 0.18], wall: [0.33, 0.39, 0.40] },
    { title: 'La fonderie profonde', main: [1, 0.35, 0.07], alt: [0.30, 0.68, 0.88], wall: [0.42, 0.29, 0.23] },
    { title: 'Le cœur du veilleur', main: [0.20, 0.67, 1], alt: [0.67, 0.30, 1], wall: [0.33, 0.36, 0.46] }
  ];
  // Different graphs as well as different footprints: two maintenance loops,
  // a long foundry ladder, then a four-way reactor hub with a large final arena.
  const layouts = [
    { id: 'maintenance-loops', xs: [-20, 0, 20], zs: [20, 0, -20], aperture: 4.4,
      edges: [[0,1],[1,2],[0,3],[1,4],[2,5],[3,6],[4,5],[5,8],[6,7],[7,8]],
      relays: [2,4,6], exit: 8,
      names: ['Sas d’injection','Atelier des turbines','Archives de maintenance','Galerie des pompes','Relais de contrôle','Vestibule de service','Atelier des câbles','Coursive extérieure','Monte-charge'] },
    { id: 'foundry-double-gallery', xs: [-33, -11, 11, 33], zs: [13, -13], aperture: 5.2,
      edges: [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[0,4],[2,6],[3,7]],
      relays: [3,5,6], exit: 7,
      names: ['Sas thermique','Galerie des vannes','Creuset principal','Salle des échangeurs','Conduite de retour','Halle des presses','Refroidissement','Ascenseur du cœur'] },
    { id: 'reactor-hub-arena', xs: [-24, 0, 24], zs: [24, 0, -24], aperture: 5.8,
      edges: [[0,1],[0,3],[1,2],[1,4],[2,5],[3,4],[3,6],[4,5],[4,7],[5,8],[6,7],[7,8]],
      relays: [2,4,6], exit: 8,
      names: ['Sas de confinement','Galerie des condensateurs','Relais de blindage','Chambre de flux','Cœur suspendu','Galerie des bobines','Relais de sûreté','Coursive du veilleur','Arène du veilleur'] }
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
  function create(seed, stage) {
    stage = Math.max(0, Math.min(2, Math.floor(stage || 0)));
    const rand = randomFor(seed, stage), theme = themes[stage], layout = layouts[stage];
    const meshes = [], lights = [], colliders = [], rooms = [], corridors = [], connections = [];
    const cores = [], enemies = [], pickups = [], machinery = [], hazards = [], aperture = layout.aperture;
    const doorHeight = [3.7,4.8,4.4][stage];
    const mesh = (shape, p, s, mat, r, emissive, color) => {
      const m = { shape, p, s, mat };
      if (r) m.r = r;
      if (emissive) m.emissive = emissive;
      if (color) m.color = color;
      meshes.push(m); return m;
    };
    const box = (x, y, z, w, h, d, mat, solid, color, emit) => {
      mesh('box', [x, y, z], [w, h, d], mat, null, emit, color);
      if (solid) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y - h / 2, maxY: y + h / 2 });
    };
    const pipe = (x, y, z, length, radius, axis, mat) => mesh('cylinder', [x, y, z], [radius * 2, length, radius * 2], mat, axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : null);
    const light = (x, y, z, color, power) => lights.push({ p: [x, y, z], color, power });
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
      rooms.push({ id, x: layout.xs[col], z: layout.zs[row], w, d, h, name: layout.names[id], archetype, openings: {} });
    }
    for (const [aId, bId] of layout.edges) {
      const a = rooms[aId], b = rooms[bId];
      if (a.x < b.x) { a.openings.e = true; b.openings.w = true; }
      else if (a.x > b.x) { a.openings.w = true; b.openings.e = true; }
      else if (a.z > b.z) { a.openings.n = true; b.openings.s = true; }
      else { a.openings.s = true; b.openings.n = true; }
    }
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
      box(r.x, -0.22, r.z, r.w + 0.48, 0.44, r.d + 0.48, 2, false);
      box(r.x, r.h + 0.17, r.z, r.w + 0.5, 0.34, r.d + 0.5, 0, false);
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
            pipe(r.x+Math.cos(a)*2.85,7.2,r.z+Math.sin(a)*2.85,2.1,.1,'y',0);
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
            const a=i*TAU/8,px=r.x+Math.cos(a)*diameter*.47,pz=r.z+Math.sin(a)*diameter*.47;
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
    function connect(a, b, horizontal) {
      const start = horizontal ? a.x + a.w / 2 : a.z - a.d / 2;
      const end = horizontal ? b.x - b.w / 2 : b.z + b.d / 2;
      const length = Math.abs(end - start) + 0.5;
      const x = horizontal ? (start + end) / 2 : a.x;
      const z = horizontal ? a.z : (start + end) / 2;
      const w = horizontal ? length : aperture + 0.48, d = horizontal ? aperture + 0.48 : length;
      const ceiling = doorHeight+.2;
      corridors.push({ x, z, w, d });
      connections.push({ from: a.id, to: b.id, x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: aperture });
      box(x, -0.22, z, w, 0.44, d, 2, false);
      box(x, ceiling+.15, z, w, 0.3, d, 0, false);
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
    for (const [i, roomId] of layout.relays.entries()) cores.push({ id: i, x: rooms[roomId].x, z: rooms[roomId].z });
    for (const r of rooms.slice(1)) {
      enemies.push({ x: r.x - 2.6, z: r.z - 1.7, type: (r.id + stage) % 3 });
      if (stage > 0 || r.id % 2 === 0) {
        enemies.push({ x: r.x + 2.8, z: r.z + 2.6, type: (r.id + stage + 1) % 3 });
      }
    }
    for (const id of [0, 3, 5, 7]) pickups.push({ x: rooms[id].x + 3.5, z: rooms[id].z + 0.7, type: 'health' });
    const spawn = { x: rooms[0].x, z: rooms[0].z + 3.2, yaw: 0 };
    const exitRoom=rooms[layout.exit];
    const exit = { x: exitRoom.x, z: exitRoom.z - exitRoom.d*.27 };
    if(stage===2){
      enemies.push({x:exitRoom.x,z:exitRoom.z+1,type:3,boss:true});
      pickups.push({x:exitRoom.x,z:exitRoom.z+5.5,type:'health'});
    }
    // Vent danger is avoidable: all central circulation axes remain clear even
    // when every vent is hot. Players may take the outer corners at their risk.
    if(stage>0)for(const [i,roomId] of (stage===1?[1,2,5,6]:[2,3,4,5,6]).entries()){
      const r=rooms[roomId],x=r.x+(i%2?-1:1)*4.35,z=r.z+3.65,rad=stage===1?.82:.95;
      hazards.push({type:'vent',x,z,r:rad,period:6.8+stage*.5+(i%3)*.6,active:1.45+stage*.15,phase:(i*1.7+rand()*1.1)});
      mesh('cylinder',[x,.023,z],[rad*2+.35,.045,rad*2+.35],0);
      mesh('ring',[x,.055,z],[rad*2+.48,.11,rad*2+.48],1);
      for(let j=-2;j<=2;j++)box(x+j*.25,.055,z,.10,.045,rad*1.5,7,false);
      for(const q of [-1,1])box(x+q*(rad+.21),.035,z,.07,.04,rad*1.5,5,false,theme.main,.45);
    }
    // Low energy rails frame the exit without putting a solid door on its trigger.
    for (const q of [-1, 1]) box(exit.x + q * 1.8, 1.5, exit.z, 0.16, 3, 0.35, 4, true, theme.main, 1);
    box(exit.x, 3, exit.z, 3.75, 0.16, 0.35, 4, false, theme.main, 1);
    const bounds={minX:Math.floor(Math.min(...rooms.map(r=>r.x-r.w/2))-.8),maxX:Math.ceil(Math.max(...rooms.map(r=>r.x+r.w/2))+.8),minZ:Math.floor(Math.min(...rooms.map(r=>r.z-r.d/2))-.8),maxZ:Math.ceil(Math.max(...rooms.map(r=>r.z+r.d/2))+.8)};
    const world={ seed, stage, topologyId:layout.id, title: theme.title, meshes, lights, colliders, rooms, corridors, connections, spawn, exit, cores, enemies, pickups, machinery, hazards, bounds };
    detailWorld(world,theme,aperture,doorHeight);
    return world;
  }
  // An independent art pass never consumes the layout/combat RNG. Everything
  // below is attached to an existing solid, flat on the floor, or overhead.
  // Consequently the v0.2 collision and checkpoint fingerprints stay identical.
  function detailWorld(w,theme,aperture,doorHeight) {
    const rand=randomFor('FERRO-detail-03:'+w.seed,w.stage),out=w.meshes,baseCount=out.length;
    const ambience=[],categories={},roomCounts={};
    const axes={x:[0,0,-Math.PI/2],y:[0,0,0],z:[Math.PI/2,0,0]};
    let owner='';
    function add(shape,p,s,mat=0,r=[0,0,0],detail=1,category='pipe',emissive=0,color) {
      const mesh={shape,p,s,mat,r,detail,category};
      if(emissive)mesh.emissive=emissive;if(color)mesh.color=color;
      out.push(mesh);categories[category]=(categories[category]||0)+1;
      if(owner)roomCounts[owner]=(roomCounts[owner]||0)+1;
      return mesh;
    }
    const box=(p,s,mat=0,detail=1,category='panel',r=[0,0,0],emissive=0,color)=>add('box',p,s,mat,r,detail,category,emissive,color);
    function tube(a,b,radius,mat=1,category='pipe',detail=1) {
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
      if(length<.005)return;
      return add('cylinder',[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[radius*2,length,radius*2],mat,
        [Math.atan2(dz,Math.hypot(dx,dy)),0,Math.atan2(-dx,dy)],detail,category);
    }
    function flange(p,radius,axis,bolts=true) {
      const rotation=axes[axis];
      add('cylinder',p,[radius*2.8,.075,radius*2.8],1,rotation,1,'flange');
      add('ring',p,[radius*3.3,.14,radius*3.3],0,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0],1,'flange');
      if(bolts)for(let j=0;j<4;j++) {
        const a=j*TAU/4+.785,c=Math.cos(a)*radius*1.2,s=Math.sin(a)*radius*1.2;
        const at=axis==='x'?[p[0]+.045,p[1]+c,p[2]+s]:axis==='z'?[p[0]+c,p[1]+s,p[2]+.045]:[p[0]+c,p[1]+.045,p[2]+s];
        add('cylinder',at,[.065,.035,.065],3,rotation,2,'bolt');
      }
    }
    function elbow(cx,y,cz,radius,start,end,thickness,mat=1) {
      for(let j=0;j<5;j++) {
        const a=start+(end-start)*j/5,b=start+(end-start)*(j+1)/5;
        tube([cx+Math.cos(a)*radius,y,cz+Math.sin(a)*radius],[cx+Math.cos(b)*radius,y,cz+Math.sin(b)*radius],thickness,mat,'elbow');
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
        s.plate(u+Math.cos(a)*.11,y+Math.sin(a)*.11,.108,.024,.024,.012,0,'gauge',2);
      }
      const a=.4+rand()*1.9,centre=s.at(u+Math.sin(a)*.043,y+Math.cos(a)*.043,.12);
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
            const a=j*TAU/6,at=s.at(Math.cos(a)*.35,1.75+Math.sin(a)*.35,.025);
            add('cylinder',at,[.05,.04,.05],3,axes.x,2,'bolt');
          }
          for(const k of [-1,1])tube([x+k*.35,3.25,z],[x+k*.35,4.7,z],.055,0,'pipe');
          flange([x,4.65,z],.46,'y');
        }
        for(let j=-1;j<=1;j++)tube([r.x+j*.34,r.h-1.15,r.z-r.d/2+.8],[r.x+j*.34,r.h-1.15,r.z+r.d/2-.8],.11,1,'header');
      } else {
        const ringY=r.archetype==='reactor'?5.3:r.archetype==='arena'?5.8:4.5,diameter=r.archetype==='reactor'?8:r.archetype==='arena'?6.5:3.1;
        for(let j=0;j<12;j++) {
          const a=j*TAU/12,x=r.x+Math.cos(a)*diameter*.5,z=r.z+Math.sin(a)*diameter*.5;
          box([x,ringY,z],[.25,.36,.42],0,1,'reactor_fins',[0,-a,0]);
          box([x,ringY-.21,z],[.12,.045,.32],4,1,'reactor_fins',[0,-a,0],.45,theme.main);
          for(const q of [-1,1])add('cylinder',[x,ringY+q*.21,z],[.065,.035,.065],1,[0,0,0],2,'bolt');
        }
      }
    }
    // Corridors use the same systems at a smaller scale, including dense frame
    // detailing: the player sees the improvement while travelling, not only at hubs.
    for(let index=0;index<w.corridors.length;index++) {
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
      for(let j=0;j<12;j++) {
        const a=j*TAU/12,r=h.r+.37,x=h.x+Math.cos(a)*r,z=h.z+Math.sin(a)*r;
        box([x,.028,z],[.12,.018,.28],5,1,'hazard_marking',[0,-a,0],.12,theme.alt);
        if(j%2===0)add('cylinder',[h.x+Math.cos(a)*(h.r+.15),.06,h.z+Math.sin(a)*(h.r+.15)],[.065,.025,.065],3,[0,0,0],2,'bolt');
      }
    }
    w.ambience=ambience;
    w.detailStats={base:baseCount,added:out.length-baseCount,tiers:[out.filter(m=>!m.detail).length,out.filter(m=>m.detail===1).length,out.filter(m=>m.detail===2).length],categories,regions:roomCounts};
  }
  function isWalkable(world, x, z, radius) {
    const r = radius === undefined ? 0.35 : radius;
    const floor = world.rooms.concat(world.corridors || []).some(a => x >= a.x - a.w / 2 && x <= a.x + a.w / 2 && z >= a.z - a.d / 2 && z <= a.z + a.d / 2);
    if (!floor) return false;
    for (const c of world.colliders) {
      if (c.minY >= 1.85 || c.maxY <= 0.05) continue;
      const dx = Math.max(c.minX - x, 0, x - c.maxX), dz = Math.max(c.minZ - z, 0, z - c.maxZ);
      if (dx * dx + dz * dz <= r * r) return false;
    }
    return true;
  }
  function validate(world) {
    const cell = 0.5, b = world.bounds, nx = Math.ceil((b.maxX - b.minX) / cell), nz = Math.ceil((b.maxZ - b.minZ) / cell);
    const cells = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz), queue = new Int32Array(nx * nz);
    const index = (x, z) => Math.min(nz - 1, Math.max(0, Math.floor((z - b.minZ) / cell))) * nx + Math.min(nx - 1, Math.max(0, Math.floor((x - b.minX) / cell)));
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) cells[iz * nx + ix] = isWalkable(world, b.minX + (ix + 0.5) * cell, b.minZ + (iz + 0.5) * cell, 0.38) ? 1 : 0;
    let head = 0, tail = 0;
    const start = index(world.spawn.x, world.spawn.z);
    if (cells[start]) { queue[tail++] = start; seen[start] = 1; }
    while (head < tail) {
      const i = queue[head++], x = i % nx, z = Math.floor(i / nx);
      for (const j of [x > 0 ? i - 1 : -1, x < nx - 1 ? i + 1 : -1, z > 0 ? i - nx : -1, z < nz - 1 ? i + nx : -1]) {
        if (j >= 0 && cells[j] && !seen[j]) { seen[j] = 1; queue[tail++] = j; }
      }
    }
    const targets = [world.spawn, ...world.cores, world.exit, ...world.enemies, ...world.pickups];
    const errors = [];
    targets.forEach((p, i) => { if (!isWalkable(world, p.x, p.z, 0.38) || !seen[index(p.x, p.z)]) errors.push('Unreachable target ' + i); });
    if (world.meshes.length > 12000) errors.push('Mesh budget exceeded');
    if (world.colliders.length > 350) errors.push('Collider budget exceeded');
    if (world.cores.length !== 3) errors.push('Expected three relays');
    const safeRoom = world.rooms[0];
    if (world.enemies.some(e => Math.abs(e.x - safeRoom.x) < safeRoom.w / 2 && Math.abs(e.z - safeRoom.z) < safeRoom.d / 2)) errors.push('Enemy in spawn chamber');
    return { ok: errors.length === 0, errors, seed: world.seed, stage: world.stage, meshes: world.meshes.length, colliders: world.colliders.length, enemies: world.enemies.length, reachableCells: tail, objectiveCount: world.cores.length + 1 };
  }
  window.FWorld = { create, validate, isWalkable };
}());
