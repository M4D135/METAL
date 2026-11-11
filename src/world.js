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
    return { seed, stage, topologyId:layout.id, title: theme.title, meshes, lights, colliders, rooms, corridors, connections, spawn, exit, cores, enemies, pickups, machinery, hazards, bounds };
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
    if (world.meshes.length > 2600) errors.push('Mesh budget exceeded');
    if (world.colliders.length > 350) errors.push('Collider budget exceeded');
    if (world.cores.length !== 3) errors.push('Expected three relays');
    const safeRoom = world.rooms[0];
    if (world.enemies.some(e => Math.abs(e.x - safeRoom.x) < safeRoom.w / 2 && Math.abs(e.z - safeRoom.z) < safeRoom.d / 2)) errors.push('Enemy in spawn chamber');
    return { ok: errors.length === 0, errors, seed: world.seed, stage: world.stage, meshes: world.meshes.length, colliders: world.colliders.length, enemies: world.enemies.length, reachableCells: tail, objectiveCount: world.cores.length + 1 };
  }
  window.FWorld = { create, validate, isWalkable };
}());
