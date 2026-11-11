/* FERRO — deterministic architecture, constructed entirely from primitives. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const themes = [
    { title: 'Le puits d’induction', main: [0.12, 0.82, 0.92], alt: [1, 0.48, 0.13], wall: [0.30, 0.36, 0.38] },
    { title: 'Les conduites rouges', main: [1, 0.40, 0.10], alt: [0.34, 0.66, 0.85], wall: [0.37, 0.29, 0.25] },
    { title: 'Le cœur froid', main: [0.25, 0.70, 1], alt: [0.70, 0.28, 0.90], wall: [0.29, 0.33, 0.43] }
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
    const rand = randomFor(seed, stage), theme = themes[stage];
    const meshes = [], lights = [], colliders = [], rooms = [], corridors = [], connections = [];
    const cores = [], enemies = [], pickups = [], aperture = 4.8;
    const names = ['Sas d’injection', 'Galerie des turbines', 'Relais est', 'Atelier de maintenance', 'Chambre d’induction', 'Échangeur supérieur', 'Relais ouest', 'Galerie du cœur', 'Chambre d’extraction'];
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
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const id = row * 3 + col;
      rooms.push({ id, x: col * 20 - 20, z: 20 - row * 20, w: 15.5 + rand() * 1.5, d: 15.5 + rand() * 1.5, h: id === 4 ? 7.4 : 5.7 + rand() * 0.5, name: names[id] });
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
        }
      }
      if (opening) {
        box(edgeX, (r.h + 3.7) / 2, edgeZ, alongX ? aperture : 0.48, r.h - 3.7, alongX ? 0.48 : aperture, 0, true);
        box(edgeX, 3.72, edgeZ, alongX ? aperture + 0.12 : 0.58, 0.10, alongX ? 0.58 : aperture + 0.12, 4, false, theme.main, 1);
        for (const q of [-1, 1]) {
          const px = edgeX + (alongX ? q * (aperture / 2 + 0.15) : 0);
          const pz = edgeZ + (alongX ? 0 : q * (aperture / 2 + 0.15));
          box(px, 1.85, pz, alongX ? 0.23 : 0.65, 3.7, alongX ? 0.65 : 0.23, 1, false);
          box(px + (alongX ? 0 : -sign * 0.325), 2.9, pz + (alongX ? -sign * 0.325 : 0), alongX ? 0.11 : 0.025, 0.65, alongX ? 0.025 : 0.11, 5, false, theme.alt, 0.75);
        }
      }
    }
    for (const r of rooms) {
      const row = Math.floor(r.id / 3), col = r.id % 3;
      box(r.x, -0.22, r.z, r.w + 0.48, 0.44, r.d + 0.48, 2, false);
      box(r.x, r.h + 0.17, r.z, r.w + 0.5, 0.34, r.d + 0.5, 0, false);
      wall(r, 'n', row < 2); wall(r, 's', row > 0); wall(r, 'e', col < 2); wall(r, 'w', col > 0);
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
        const h = 1.1 + rand() * 0.55;
        box(x, h / 2, z, 1.65, h, 1.6, r.id % 2 ? 1 : 0, true);
        box(x, h + 0.04, z, 1.72, 0.08, 1.67, 1, false);
        box(x, h * 0.72, z - Math.sign(z - r.z) * 0.805, 0.9, 0.10, 0.018, 4, false, theme.main, 0.8);
      }
      // Suspended machinery silhouettes distinguish each chamber at a glance.
      if (r.id === 4) {
        mesh('ring', [r.x, 4.6, r.z], [7.2, 0.25, 7.2], 1);
        mesh('ring', [r.x, 4.48, r.z], [6.5, 0.13, 6.5], 4, null, 1.3, theme.main);
        mesh('octa', [r.x, 5.65, r.z], [2.3, 2.6, 2.3], 0, [0, 0.4, 0]);
        for (let i = 0; i < 6; i++) {
          const a = TAU * i / 6;
          pipe(r.x + Math.cos(a) * 3.25, 6.1, r.z + Math.sin(a) * 3.25, 2.5, 0.07, 'y', 1);
        }
      } else if (r.id === 1 || r.id === 7) {
        for (const q of [-1, 1]) {
          mesh('cylinder', [r.x + q * 4.6, 3.35, r.z], [2.8, 3.6, 2.8], 0, [Math.PI / 2, 0, 0]);
          mesh('ring', [r.x + q * 4.6, 3.35, r.z - 1.82], [2.4, 0.16, 2.4], 5, [Math.PI / 2, 0, 0], 0.7, theme.alt);
        }
      } else if (r.id === 3 || r.id === 5) {
        pipe(r.x, 4.5, r.z, r.w - 2, 0.45, 'x', 1);
        for (const q of [-1, 1]) mesh('ring', [r.x + q * 3, 4.5, r.z], [1.14, 0.13, 1.14], 0, [0, 0, Math.PI / 2]);
      }
      light(r.x, 3.5, r.z, theme.main, r.id === 4 ? 13 : 10);
      light(r.x - 4.5, 2.6, r.z + 3.6, theme.alt, 6);
    }
    function connect(a, b, horizontal) {
      const start = horizontal ? a.x + a.w / 2 : a.z - a.d / 2;
      const end = horizontal ? b.x - b.w / 2 : b.z + b.d / 2;
      const length = Math.abs(end - start) + 0.5;
      const x = horizontal ? (start + end) / 2 : a.x;
      const z = horizontal ? a.z : (start + end) / 2;
      const w = horizontal ? length : aperture + 0.48, d = horizontal ? aperture + 0.48 : length;
      corridors.push({ x, z, w, d });
      connections.push({ from: a.id, to: b.id, x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: aperture });
      box(x, -0.22, z, w, 0.44, d, 2, false);
      box(x, 4.05, z, w, 0.3, d, 0, false);
      for (const q of [-1, 1]) {
        box(x + (horizontal ? 0 : q * (aperture / 2 + 0.24)), 2, z + (horizontal ? q * (aperture / 2 + 0.24) : 0), horizontal ? length : 0.48, 4, horizontal ? 0.48 : length, 0, true);
        box(x + (horizontal ? 0 : q * (aperture / 2 - 0.02)), 0.32, z + (horizontal ? q * (aperture / 2 - 0.02) : 0), horizontal ? length : 0.05, 0.06, horizontal ? 0.05 : length, 4, false, theme.main, 0.8);
        pipe(x + (horizontal ? 0 : q * 1.7), 3.45, z + (horizontal ? q * 1.7 : 0), length, 0.12, horizontal ? 'x' : 'z', 1);
      }
      box(x, 3.85, z, horizontal ? 0.22 : aperture + 0.3, 0.3, horizontal ? aperture + 0.3 : 0.22, 1, false);
      box(x, 3.66, z, horizontal ? 0.18 : 2.6, 0.07, horizontal ? 2.6 : 0.18, 5, false, theme.alt, 1.1);
      light(x, 2.7, z, theme.alt, 6);
    }
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      if (col < 2) connect(rooms[i], rooms[i + 1], true);
      if (row < 2) connect(rooms[i], rooms[i + 3], false);
    }
    for (const [i, roomId] of [2, 4, 6].entries()) cores.push({ id: i, x: rooms[roomId].x, z: rooms[roomId].z });
    for (const r of rooms.slice(1)) {
      enemies.push({ x: r.x - 2.6, z: r.z - 1.7, type: (r.id + stage) % 3 });
      if (r.id % 2 === 0 || (stage > 0 && r.id === 3) || (stage > 0 && r.id === 7) || stage === 2) {
        enemies.push({ x: r.x + 2.8, z: r.z + 2.6, type: (r.id + stage + 1) % 3 });
      }
    }
    for (const id of [0, 3, 5, 7]) pickups.push({ x: rooms[id].x + 3.5, z: rooms[id].z + 0.7, type: 'health' });
    const spawn = { x: rooms[0].x, z: rooms[0].z + 3.2, yaw: 0 };
    const exit = { x: rooms[8].x, z: rooms[8].z - 3.2 };
    // Low energy rails frame the exit without putting a solid door on its trigger.
    for (const q of [-1, 1]) box(exit.x + q * 1.8, 1.5, exit.z, 0.16, 3, 0.35, 4, true, theme.main, 1);
    box(exit.x, 3, exit.z, 3.75, 0.16, 0.35, 4, false, theme.main, 1);
    return { seed, stage, title: theme.title, meshes, lights, colliders, rooms, corridors, connections, spawn, exit, cores, enemies, pickups, bounds: { minX: -29, maxX: 29, minZ: -29, maxZ: 29 } };
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
    if (world.meshes.length > 1500) errors.push('Mesh budget exceeded');
    if (world.colliders.length > 200) errors.push('Collider budget exceeded');
    if (world.cores.length !== 3) errors.push('Expected three relays');
    const safeRoom = world.rooms[0];
    if (world.enemies.some(e => Math.abs(e.x - safeRoom.x) < safeRoom.w / 2 && Math.abs(e.z - safeRoom.z) < safeRoom.d / 2)) errors.push('Enemy in spawn chamber');
    return { ok: errors.length === 0, errors, seed: world.seed, stage: world.stage, meshes: world.meshes.length, colliders: world.colliders.length, enemies: world.enemies.length, reachableCells: tail, objectiveCount: world.cores.length + 1 };
  }
  window.FWorld = { create, validate, isWalkable };
}());
