# Notes du noyau physique

Commentaires détaillés déplacés du script pour tenir le budget de l’artefact autonome. Les étapes et marqueurs de trigonométrie restent dans le code.

```text
  // Material id = index (the host game keeps the same order).
  // Settings after bounds, in fingerprint order: [name, default, kind, low, high].
  // Kinds: f finite, p > 0, z >= 0, g null or finite, i integer in [low, high].
  // Integer limits keep encodings exact: body handle gen*4096+index, joint handle gen*4096+slot,
  // pair key lo*(capacity+maxStatics+2)+hi below 2^31.
  // Grid cells allowed by bounds and cell (4 MB of cell heads per grid at most).
  // FNV-1a 32 bits: one step over a 32-bit word.
  // FNV-1a 32 bits over character codes, as 8 hex digits.
  // Validated settings (-0 normalised), plus durations converted to whole sub-steps.
    // clock (bench only, never part of the state) is checked here and kept out of config.
  // Fingerprint: FNV-1a of 'FPhysics2|' + settings in table order, bounds flat, ground 'none' when null.
  // Body flags (FL) and shapes (SH).
  // Generations wrap at 2^19, so that a handle gen*4096 + index stays below 2^31.
  // Description checks (outside step). A vector of n finite numbers, copied with -0 normalised.
  // Material: index or name in MATERIALS; -1 (or absent) for none.
    // Saved, in snapshot order: SH shape (0 box, 1 sphere, 2 capsule), FL flags, GEN generation, GRP group, MSK mask,
    // MAT material (-1 none), P position, Q quaternion [x, y, z, w], V velocity (linear then angular, world frame),
    // H collision half-size, HR real half-size, IM inverse physical mass, MO original mass, FR friction,
    // RE restitution, ST sub-steps under the sleep thresholds, AT sub-steps awake, FN fallback window,
    // RP fallback reference position, KT kinematic target (position, quaternion), KN target pending.
    // Derived, from saved values only (same functions at creation, end of sub-step and restore): R rotation
    // (row-major, column k = local axis k in the world), IL local inverse inertia, IW world inverse inertia
    // (xx xy xz yy yz zz), BB bounds and FB swept bounds (min x y z, max x y z), SL contact tolerance,
    // PP and PQ pose at the start of the last step() call (render interpolation).
    // Sub-step scratch: AL active list (increasing index), ACT active mark (1 awake dynamic body, 2 moving kinematic body),
    // WK deferred wake mark, UF union-find, IMIN smallest ST of an island (at its root), TOUCH contact in this sub-step (or woken at its end).
    // Saved arrays in snapshot and hash order: [name, array, width, integer low, integer high].
    // Hash views (floats are hashed by their 32-bit words) and the values of row 0, the world.
    // (min x y z, max x y z), friction sF, restitution sE, material sM, query stamp sT. Grid in compressed rows:
    // cell c lists sItems[sStart[c] .. sStart[c+1]-1], by increasing index.
    // point id cI, normal cN (A to B), tangents cT1 cT2, arms cRA cRB, angular responses cAN cA1 cA2 (A then B),
    // separation cS, effective masses cMn cM1 cM2, impulses cJn cJ1 cJ2, friction cFr, restitution cRe,
    // approach speed cV0, peak normal impulse cMax, participating inverse masses cIa cIb (0: immovable side),
    // tolerance cSl, separation after the position update cSR (relaxation). Pairs: first point prF, points prN.
    // the entries of one key contiguous. Open addressing over TS slots (power of 2 >= 2*maxContacts): TB = first
    // entry + 1 (0 empty), TC = entry count; TU lists the used slots, so that clearing touches only them.
    // separation mS[k], id mI[k]; face clipping polygons clipA clipB with ids idA idB; kept points pick.
    // Float scratch: [0] narrow-phase margin of the pair; [1] [2] clip limits; [3] [4] friction and restitution
    // of the pair; [5] 1/h; [6] bias rate; [7] mass scale; [8] impulse scale (soft contact); [9] h = tick;
    // [10] linear and [11] angular damping factors; [12] gravity*h; [13] last clock mark (bench only).
    // Settings read inside the step, copied once (config is a plain object: a number read from it is a boxed
    // value, and a boxed input can make the optimiser box the floats it meets): [14] margin; [15] maxLinear;
    // [16] maxAngular; [17] pushout; [18] restitutionThreshold; [19] sleepLinear^2; [20] sleepAngular^2;
    // [21] sleepSteps (a float: NOSLEEP gives 1.2e11 sub-steps). Actions (outside the step): [22] [23] [24] world point
    // and [25] [26] [27] impulse of push(). [28] rolling damping factor. Round shapes: [29..31] centre and [32] radius of
    // ball A, [33..35] and [36] of ball B.
    // Integer scratch: [0] [1] [2] [3] cells x0, x1, z0, z1 of the last cellRange; [4] [5] used cells and
    // [6] [7] entries of the body grids 0 and 1.
    // World floats kept across steps: [0] time accumulator (s), hashed by its two words.
    // (sleepers) with FB = BB, rebuilt when restDirty. GH head per cell (-1 empty), GN next and GI item per entry,
    // GU used cells (clearing touches only them). Bodies are inserted by decreasing index at the head, so a cell is
    // walked by increasing index. Entries are sized in addBody (cellsOf): a sub-step never overflows nor allocates.
    // and HR = (r, r, r); a capsule (axis = local Y) H = (rc, hh + rc, rc) and HR = (r, height/2, r), with the collision
    // radius rc = max(r, minHalf) and the half-segment hh = height/2 - r = HR_y - HR_x (0 for a sphere).
    // Inertia from the saved inverse mass and collision sizes: box; sphere 2.5 im/r^2; capsule as a cylinder of radius r
    // and length L = 2 H_y on Y: ILy = 2 im/r^2, ILx = ILz = 12 im/(3 r^2 + L^2).
    // Contact tolerance SL = min(slop, slopRatio * m): m = smallest collision half-size of a box, radius of a round body.
    // Rotation, bounds and world inverse inertia from Q, P, H and IL (prototype derive); tight bounds for a round body.
    // Upper bound of the grid cells a body can cover: bounds swept by maxLinear*tick plus margin on each side.
    // ISCR[0..3] = cells x0, x1, z0, z1 covered by the bounds A[b .. b+5].
    // y?, slopeX?, slopeZ?} ((x, z) the centre, height y + (px - x) slopeX + (pz - z) slopeZ, one slope axis at most), each
    // with material?, friction?, restitution?. Order: the ground slab (index 0), the boxes, the flat floors as boxes
    // [x - w/2, y - T, z - d/2]-[x + w/2, y, z + d/2] (T = floorThickness), then the sloped floors as oriented boxes of
    // thickness T under their surface (axes from the slope, no trigonometry). No merging nor face masks yet (module
    // step 4); a changed decor wakes every sleeper and drops the body-static cache entries (exact difference: step 10).
      // Oriented box: centre, half-sizes, rotation r (row-major, columns = local axes), bounds from |r| times the half-sizes.
      // Friction, restitution and material of a box or a floor: explicit values, then the material, then 0.7 and 0.05.
      // Slope a on X, L = sqrt(1 + a^2): axes X = (1, a, 0)/L, Y = (-a, 1, 0)/L, Z = (0, 0, 1), half-sizes (w L/2, T/2, d/2);
      // slope c on Z: X = (1, 0, 0), Y = (0, 1, -c)/L, Z = (0, c, 1)/L, half-sizes (w/2, T/2, d L/2); centre (x, y, z) - Y T/2.
    // kinematic (infinite mass, moved by setKinematic only, never pending nor asleep; vel and ang are not used).
      // Real half-sizes and, for a round shape, its volume (capsule: pi r^2 (height - 2r) + 4/3 pi r^3).
    // Row of a live body handle gen*4096 + index, or 0 (stale, invalid or the world).
    // Body queries deliberately exclude the static world: the host combines
    // their distance with its existing static ray, without rebuilding that map.
    // Read a body's current bounds and velocity into a caller-owned buffer.
    // Plain description of a body (tests, debugging; allocates). size = collision size (bounding box of a round body in
    // its frame), realSize = given size; radius and height as given (null for a box, height null for a sphere).
    // Render pose [x, y, z, qx, qy, qz, qw]: PP..P and PQ..Q blended by alpha in [0, 1] (normalised, short arc),
    // raised by SL/2; for a box, the real shape sits on the bottom of its collision box (axis k: H_k > HR_k).
        // Columns of the blended rotation (local axes in the world) and their Y components.
    // Rotation of the current pose, row-major (column k = local axis k).
    // Wake one body (never a whole island).
    // Speed caps: |v| <= maxLinear and |w| <= maxAngular (end of each sub-step, and after every action, so that a
    // snapshot taken between two steps always restores).
    // Impulse SCR[25..27] at the world point SCR[22..24] (prototype impulseAt): V += J*IM, W += IW*((p - P) x J), caps.
    // Explicit wake of an action: a sleeper wakes alone; an awake body restarts its sleep count (prototype wake).
    // Row of the target of impulse or setVelocity (live, dynamic, not lost), or 0; non-finite numbers throw.
    // Impulse (jx, jy, jz) at the world point (px, py, pz); the body wakes. false: invalid handle, kinematic or lost.
    // Linear and angular velocities (world frame, capped); the body wakes. false as for impulse.
    // Target pose of a kinematic body (position, quaternion normalised) for the next step() call that runs sub-steps.
    // false: invalid handle or dynamic body; non-finite numbers or a null quaternion throw.
    // Radial blast (prototype explode), for each live, active, dynamic body that is not lost, by increasing index: at the
    // body point nearest to the centre (distance d < radius), the impulse strength*(1 - d/radius), capped at maxDv times
    // the physical mass, along (body centre - centre + (0, 0.35, 0)) normalised; the body wakes alone. Returns the bodies
    // pushed. occlude (static boxes that shelter a body) comes with module step 7: until then every body in range is pushed.
          // Nearest point of the box: the centre in the local frame, clamped to the collision half-sizes.
          // Round body: the segment point nearest to the centre, moved by the radius towards it (not when inside).
    // Kinematic body i for a call of n sub-steps (T = n tick): towards its pending target, v = (target - P)/T and
    // w = 2 dq.xyz/T with dq = target (x) conj(Q) on the short arc, both capped; without a target it stops (V = 0) and
    // joins the resting grid.
    // Adds the time since the last clock mark to phase k (bench only, never read by the simulation).
      // 1. Activation of the pending bodies (module step 2a: all of them), by increasing index.
      // 2. Active list: awake dynamic bodies (ACT 1) and moving kinematic bodies (ACT 2), by increasing index; nothing
      // active: leave (the cache is kept).
      // 5. Velocities of the dynamic bodies: gravity and damping, plus rolling damping for a round body in contact.
    // dynamic a only), active bodies b > a (never two kinematic ones), resting bodies (sleepers and stopped kinematic
    // bodies: immovable for the contact, a sleeper woken at the end of the sub-step; a moving kinematic a only marks the
    // sleepers it touches). A pair seen in several cells is tested in the cell of the low corner of the overlap only.
              // A round body against a static: the static is the box A, then the normals are turned (body to static).
    // mN[3k..] (A to B), mP[3k..] (midpoint between the surfaces), mS[k] (separation), mI[k] (stable id); returns the
    // point count. Statics pass their own rotation.
    // Reference box (PR, HF, r3, RR, r9) face `axis`; incident box (PI, HI, i3, RI, i9).
    // Separating axes (3 + 3 faces, 9 edges): early out beyond the margin, faces preferred (0.95 x + 0.002 for B,
    // edges 0.95 x + 0.01), then face clipping or the closest points of the two supporting edges.
        // Supporting edges: centre of the A edge farthest along +l, of the B edge farthest along -l.
    // Round shapes: a segment (local Y, half-length e = HR_y - HR_x, 0 for a sphere) swept by the collision radius H_x.
    // Ball SCR[33..35] of radius SCR[36] against box A: l = R^T (c - P), q = l clamped to [-H, H]; a centre inside leaves
    // by the face of least penetration H_k - |l_k| (x, then y, then z on ties). Point k (id) when s <= margin; returns 1
    // or 0. mP = midpoint between the box point P + R q and c - n r.
    // Box A against the round body b: a sphere is one ball (id 1); a capsule tests its ends c + u e (id 1) and c - u e
    // (id 2), then, when fewer than two touch, the segment point nearest to the box (id 3; from the middle, three times:
    // clamp to the box, project on the segment; skipped when it is an end).
    // Ball SCR[29..31] (radius SCR[32]) against ball SCR[33..35] (radius SCR[36]): n = (cB - cA)/d, or (0, 1, 0) when
    // d < 1e-9; s = d - rA - rB; point cA + n (rA + s/2). Point k (id) when s <= margin; returns 1 or 0.
    // Round a against round b, shapes in order (a sphere is a segment of length 0): parameter s on A by the classical
    // clamped formula, B's point nearest to A(s), then ballBall (id 1). Nearly parallel segments (1 - (u.v)^2 < 1e-3):
    // the two ends of the part of A facing B (the ends of A when B covers them), each against its nearest point on B
    // (ids 1 and 2; one point when that part is a single end).
    // Body pair (lo, hi) with a round side, in shape order (box < sphere < capsule): a reversed pair is called as (hi, lo)
    // and its normals turned.
    // Contacts of a pair (n points in mN, mP, mS, mI), warm-started from the cache by point id; TOUCH marks both sides.
    // Friction SCR[3] and restitution SCR[4]; a side that does not take part (world, sleeper, kinematic body) gets a zero
    // inverse mass.
    // (row 0 of IW is zero); its velocity is read, and the writes to it add exact zeros.
        // Tangent basis from the normal (sqrt only).
    // One pass: friction on the two tangents, then the normal. Separation: cS + cSl in the biased passes, cSR (after
    // the position update) in the relaxation; speculative (s > 0) bias s/h, otherwise the soft bias, capped by pushout.
    // Velocities capped (maxLinear, maxAngular), then positions and quaternions integrated (prototype); a moving
    // kinematic body ends the last sub-step of the call exactly on its target.
    // Separation after the position update, for the relaxation: cS + (dB - dA).n + cSl, with d = v*h + (w*h) x r for a
    // body moved in this sub-step and 0 otherwise (the prototype's displacement D, computed once per point).
    // Bounce for the points that pushed and approached faster than restitutionThreshold (prototype).
    // Velocity caps again after the bounce: |v| <= maxLinear and |w| <= maxAngular at the end of each sub-step.
    // The points of this sub-step become the cache of the next one (-0 normalised); emptied only by setStatics and
    // restore, never when nothing is active.
    // Islands of the dynamic participants (union-find over the pairs whose two sides take part; larger root under the
    // smaller), timers in whole sub-steps, and sleep of the islands whose smallest ST reached sleepSteps. Returns the
    // bodies put to sleep. Kinematic bodies (ACT 2) have neither island nor timers.
    // Plain JSON-safe object (no -0, finite numbers only); never changes the state.
    // Validates everything first; at the first defect throws Error('FPhysics.restore: ...') and changes nothing.
        // Round body: HR = (r, height/2, r), H = (rc, ., rc), a sphere with height/2 = r.
      // Valid: copy (-0 normalised), reset the rows above n, recompute the derived values.
    // FNV-1a over n, acc, the body arrays of rows 0 .. n-1 (snapshot order; floats by 32-bit words, integers as
    // v >>> 0), then the cache (n, K, I, Jn, J1, J2). 8 hex digits.
  // Angle conversions, game convention: rotation [rx, ry, rz] with M = Rz*Ry*Rx (outside step only).
```
