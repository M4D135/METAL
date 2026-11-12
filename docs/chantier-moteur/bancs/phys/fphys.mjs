// FPhys prototype — original rigid-body kernel written for the PHYS audit axis (no external library, no copied code).
// Oriented boxes, static world made of axis-aligned boxes + one ground plane, uniform-grid broad phase,
// SAT + face clipping narrow phase, soft sequential impulses with warm starting and sub-steps, islands + sleeping.
// Determinism: only + - * / Math.sqrt Math.abs and comparisons in the step (no sin/cos/exp/hypot), fixed iteration
// order, typed arrays only (no allocation inside step()).
const IDENT = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
export function create(o = {}) {
  const NB = (o.capacity || 512) + 1, MS = o.maxStatics || 1024, MC = o.maxContacts || 16384;
  const G = o.gravity ?? -12, margin0 = o.margin ?? 0.02, slop = o.slop ?? 0.005;
  const linDamp = o.linearDamping ?? 0.02, angDamp = o.angularDamping ?? 0.06, maxLin = o.maxLinear ?? 40, maxAng = o.maxAngular ?? 30;
  const sleepLin2 = (o.sleepLinear ?? 0.08) ** 2, sleepAng2 = (o.sleepAngular ?? 0.12) ** 2, sleepTime = o.sleepTime ?? 0.5;
  const iterations = o.iterations ?? 2, relaxIterations = o.relaxIterations ?? 1, contactHertz0 = o.contactHertz ?? 30, zeta = o.dampingRatio ?? 10, pushout = o.pushout ?? 3;
  const restThreshold = o.restitutionThreshold ?? 1;
  const cell = o.cell || 2, minX = o.minX ?? -64, minZ = o.minZ ?? -64, GW = Math.ceil(((o.maxX ?? 64) - minX) / cell), GD = Math.ceil(((o.maxZ ?? 64) - minZ) / cell), CELLS = GW * GD;
  let groundY = o.groundY ?? 0, hasGround = o.ground !== false;
  // ---- bodies (index 0 is the immovable world) ----
  const P = new Float64Array(NB * 3), Q = new Float64Array(NB * 4), V = new Float64Array(NB * 6), H = new Float64Array(NB * 3), R = new Float64Array(NB * 9);
  const IM = new Float64Array(NB), IL = new Float64Array(NB * 3), IW = new Float64Array(NB * 6), BB = new Float64Array(NB * 6), D = new Float64Array(NB * 6);
  const FL = new Uint8Array(NB), ST = new Float64Array(NB), FR = new Float64Array(NB), RE = new Float64Array(NB), UF = new Int32Array(NB), SI = new Int32Array(NB), IMIN = new Float64Array(NB);
  let count = 1; Q[3] = 1; R[0] = R[4] = R[8] = 1; FL[0] = 1;
  // ---- statics ----
  const SP = new Float64Array(MS * 3), SH = new Float64Array(MS * 3), SF = new Float64Array(MS), SR = new Float64Array(MS), SSTAMP = new Int32Array(MS);
  let statics = 0, stamp = 0;
  const sStart = new Int32Array(CELLS + 1), sItems = new Int32Array(MS * 16); let sItemCount = 0;
  // ---- dynamic grids (awake rebuilt every step, sleeping rebuilt when the sleeping set changes) ----
  const aStart = new Int32Array(CELLS + 1), aItems = new Int32Array(NB * 12), zStart = new Int32Array(CELLS + 1), zItems = new Int32Array(NB * 12), fill = new Int32Array(CELLS + 1);
  const awake = new Int32Array(NB); let awakeCount = 0, sleepDirty = true;
  // ---- contacts ----
  const cA = new Int32Array(MC), cB = new Int32Array(MC), cK = new Int32Array(MC), cI = new Int32Array(MC);
  const cN = new Float64Array(MC * 3), cT1 = new Float64Array(MC * 3), cT2 = new Float64Array(MC * 3), cRA = new Float64Array(MC * 3), cRB = new Float64Array(MC * 3);
  const cAN = new Float64Array(MC * 6), cA1 = new Float64Array(MC * 6), cA2 = new Float64Array(MC * 6);
  const cS = new Float64Array(MC), cMn = new Float64Array(MC), cM1 = new Float64Array(MC), cM2 = new Float64Array(MC), cJn = new Float64Array(MC), cJ1 = new Float64Array(MC), cJ2 = new Float64Array(MC);
  const cFr = new Float64Array(MC), cRe = new Float64Array(MC), cV0 = new Float64Array(MC), cMax = new Float64Array(MC);
  let nc = 0, nm = 0;
  // previous-step impulse cache (warm starting), addressed by pair key through an open-addressing table
  const pK = new Int32Array(MC), pI = new Int32Array(MC), pJn = new Float64Array(MC), pJ1 = new Float64Array(MC), pJ2 = new Float64Array(MC);
  let pn = 0; const TS = 1 << Math.ceil(Math.log2(MC * 2)), table = new Int32Array(TS), tcount = new Int32Array(TS);
  const KM = NB + MS + 1;
  // ---- narrow-phase scratch ----
  const tt = new Float64Array(3), cc = new Float64Array(9), qq = new Float64Array(9), mN = new Float64Array(3), mP = new Float64Array(24), mS = new Float64Array(8), mI = new Int32Array(8);
  const clipA = new Float64Array(48), clipB = new Float64Array(48), idA = new Int32Array(16), idB = new Int32Array(16), pick = new Int32Array(4);
  const SCR = new Float64Array(16); // [0] margin, [1] [2] clip limits, [3] friction, [4] restitution, [5..8] solver constants
  const stats = { contacts: 0, manifolds: 0, awake: 0, pairs: 0, tests: 0 }, prof = !!o.profile, TP = new Float64Array(4);

  function derive(i) {
    const q = i * 4, x = Q[q], y = Q[q + 1], z = Q[q + 2], w = Q[q + 3], xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z, r = i * 9;
    const r0 = 1 - 2 * (yy + zz), r1 = 2 * (xy - wz), r2 = 2 * (xz + wy), r3 = 2 * (xy + wz), r4 = 1 - 2 * (xx + zz), r5 = 2 * (yz - wx), r6 = 2 * (xz - wy), r7 = 2 * (yz + wx), r8 = 1 - 2 * (xx + yy);
    R[r] = r0; R[r + 1] = r1; R[r + 2] = r2; R[r + 3] = r3; R[r + 4] = r4; R[r + 5] = r5; R[r + 6] = r6; R[r + 7] = r7; R[r + 8] = r8;
    const h = i * 3, hx = H[h], hy = H[h + 1], hz = H[h + 2], b = i * 6;
    const ex = Math.abs(r0) * hx + Math.abs(r1) * hy + Math.abs(r2) * hz, ey = Math.abs(r3) * hx + Math.abs(r4) * hy + Math.abs(r5) * hz, ez = Math.abs(r6) * hx + Math.abs(r7) * hy + Math.abs(r8) * hz;
    BB[b] = P[h] - ex; BB[b + 1] = P[h + 1] - ey; BB[b + 2] = P[h + 2] - ez; BB[b + 3] = P[h] + ex; BB[b + 4] = P[h + 1] + ey; BB[b + 5] = P[h + 2] + ez;
    const ix = IL[h], iy = IL[h + 1], iz = IL[h + 2];
    IW[b] = r0 * r0 * ix + r1 * r1 * iy + r2 * r2 * iz; IW[b + 1] = r0 * r3 * ix + r1 * r4 * iy + r2 * r5 * iz; IW[b + 2] = r0 * r6 * ix + r1 * r7 * iy + r2 * r8 * iz;
    IW[b + 3] = r3 * r3 * ix + r4 * r4 * iy + r5 * r5 * iz; IW[b + 4] = r3 * r6 * ix + r4 * r7 * iy + r5 * r8 * iz; IW[b + 5] = r6 * r6 * ix + r7 * r7 * iy + r8 * r8 * iz;
  }
  function addBox(x, y, z, hx, hy, hz, mass, friction = 0.6, restitution = 0.1, qx = 0, qy = 0, qz = 0, qw = 1) {
    if (count >= NB) return -1; const i = count++, p = i * 3, q = i * 4;
    P[p] = x; P[p + 1] = y; P[p + 2] = z; H[p] = hx; H[p + 1] = hy; H[p + 2] = hz; Q[q] = qx; Q[q + 1] = qy; Q[q + 2] = qz; Q[q + 3] = qw;
    const im = 1 / mass; IM[i] = im; IL[p] = 3 * im / (hy * hy + hz * hz); IL[p + 1] = 3 * im / (hx * hx + hz * hz); IL[p + 2] = 3 * im / (hx * hx + hy * hy);
    FR[i] = friction; RE[i] = restitution; FL[i] = 1; ST[i] = 0; SI[i] = -1; for (let k = 0; k < 6; k++) V[i * 6 + k] = 0; derive(i); return i;
  }
  function addStatic(x0, y0, z0, x1, y1, z1, friction = 0.7, restitution = 0.05) {
    if (statics >= MS) return -1; const s = statics++, p = s * 3;
    SP[p] = (x0 + x1) / 2; SP[p + 1] = (y0 + y1) / 2; SP[p + 2] = (z0 + z1) / 2; SH[p] = (x1 - x0) / 2; SH[p + 1] = (y1 - y0) / 2; SH[p + 2] = (z1 - z0) / 2; SF[s] = friction; SR[s] = restitution; return s;
  }
  const cx = (A, i) => { const c = Math.floor((A[i] - minX) / cell); return c < 0 ? 0 : c >= GW ? GW - 1 : c; }, cz = (A, i) => { const c = Math.floor((A[i] - minZ) / cell); return c < 0 ? 0 : c >= GD ? GD - 1 : c; };
  function buildStatics() {
    sStart.fill(0);
    for (let s = 0; s < statics; s++) { const p = s * 3; SCR[9] = SP[p] - SH[p]; SCR[10] = SP[p] + SH[p]; SCR[11] = SP[p + 2] - SH[p + 2]; SCR[12] = SP[p + 2] + SH[p + 2]; const x0 = cx(SCR, 9), x1 = cx(SCR, 10), z0 = cz(SCR, 11), z1 = cz(SCR, 12); for (let z = z0; z <= z1; z++)for (let x = x0; x <= x1; x++)sStart[z * GW + x + 1]++; }
    for (let c = 0; c < CELLS; c++)sStart[c + 1] += sStart[c];
    sItemCount = sStart[CELLS]; if (sItemCount > sItems.length) throw new Error('static grid overflow');
    for (let c = 0; c < CELLS; c++)fill[c] = sStart[c];
    for (let s = 0; s < statics; s++) { const p = s * 3; SCR[9] = SP[p] - SH[p]; SCR[10] = SP[p] + SH[p]; SCR[11] = SP[p + 2] - SH[p + 2]; SCR[12] = SP[p + 2] + SH[p + 2]; const x0 = cx(SCR, 9), x1 = cx(SCR, 10), z0 = cz(SCR, 11), z1 = cz(SCR, 12); for (let z = z0; z <= z1; z++)for (let x = x0; x <= x1; x++)sItems[fill[z * GW + x]++] = s; }
  }
  // CSR grid of bodies selected by sleeping flag; fat = velocity expansion for awake bodies (uses FB)
  const FB = new Float64Array(NB * 6);
  function buildGrid(start, items, asleep) {
    start.fill(0);
    for (let i = 1; i < count; i++) { if (!(FL[i] & 1) || ((FL[i] & 2) !== 0) !== asleep) continue; const b = i * 6, x0 = cx(FB, b), x1 = cx(FB, b + 3), z0 = cz(FB, b + 2), z1 = cz(FB, b + 5); for (let z = z0; z <= z1; z++)for (let x = x0; x <= x1; x++)start[z * GW + x + 1]++; }
    for (let c = 0; c < CELLS; c++)start[c + 1] += start[c];
    if (start[CELLS] > items.length) throw new Error('grid overflow');
    for (let c = 0; c < CELLS; c++)fill[c] = start[c];
    for (let i = 1; i < count; i++) { if (!(FL[i] & 1) || ((FL[i] & 2) !== 0) !== asleep) continue; const b = i * 6, x0 = cx(FB, b), x1 = cx(FB, b + 3), z0 = cz(FB, b + 2), z1 = cz(FB, b + 5); for (let z = z0; z <= z1; z++)for (let x = x0; x <= x1; x++)items[fill[z * GW + x]++] = i; }
  }
  function clip(src, sid, n, dst, did, co, sg, li, plane) {
    if (n === 0) return 0; const lim = SCR[li]; let m = 0, pi = n - 1, pd = sg * src[pi * 3 + co] - lim;
    for (let i = 0; i < n; i++) {
      const cd = sg * src[i * 3 + co] - lim;
      if (cd <= 0) {
        if (pd > 0) { const t = pd / (pd - cd), a = pi * 3, b = i * 3, d = m * 3; dst[d] = src[a] + (src[b] - src[a]) * t; dst[d + 1] = src[a + 1] + (src[b + 1] - src[a + 1]) * t; dst[d + 2] = src[a + 2] + (src[b + 2] - src[a + 2]) * t; did[m++] = 64 + ((sid[pi] * 31 + sid[i] * 17 + plane * 7) % 191); }
        const b = i * 3, d = m * 3; dst[d] = src[b]; dst[d + 1] = src[b + 1]; dst[d + 2] = src[b + 2]; did[m++] = sid[i];
      } else if (pd <= 0) { const t = pd / (pd - cd), a = pi * 3, b = i * 3, d = m * 3; dst[d] = src[a] + (src[b] - src[a]) * t; dst[d + 1] = src[a + 1] + (src[b + 1] - src[a + 1]) * t; dst[d + 2] = src[a + 2] + (src[b + 2] - src[a + 2]) * t; did[m++] = 64 + ((sid[pi] * 31 + sid[i] * 17 + plane * 7) % 191); }
      pi = i; pd = cd;
    }
    return m;
  }
  // reference box (PR,HR,r3,RR,r9) face `axis`; incident box (PI,HI,i3,RI,i9). Writes mN (A->B), mP, mS, mI. Returns count.
  function face(PR, HR, r3, RR, r9, PI, HI, i3, RI, i9, axis, flip) {
    const margin = SCR[0];
    let nx = RR[r9 + axis], ny = RR[r9 + 3 + axis], nz = RR[r9 + 6 + axis];
    const dx = PI[i3] - PR[r3], dy = PI[i3 + 1] - PR[r3 + 1], dz = PI[i3 + 2] - PR[r3 + 2], sgn = dx * nx + dy * ny + dz * nz >= 0 ? 1 : -1; nx *= sgn; ny *= sgn; nz *= sgn;
    let jb = 0, best = -1, sj = 1;
    for (let j = 0; j < 3; j++) { const d = nx * RI[i9 + j] + ny * RI[i9 + 3 + j] + nz * RI[i9 + 6 + j], ad = Math.abs(d); if (ad > best) { best = ad; jb = j; sj = d > 0 ? -1 : 1; } }
    const j1 = (jb + 1) % 3, j2 = (jb + 2) % 3, e = HI[i3 + jb] * sj, fx = dx + RI[i9 + jb] * e, fy = dy + RI[i9 + 3 + jb] * e, fz = dz + RI[i9 + 6 + jb] * e;
    const h1 = HI[i3 + j1], h2 = HI[i3 + j2], ux = RI[i9 + j1] * h1, uy = RI[i9 + 3 + j1] * h1, uz = RI[i9 + 6 + j1] * h1, wx = RI[i9 + j2] * h2, wy = RI[i9 + 3 + j2] * h2, wz = RI[i9 + 6 + j2] * h2;
    const a1 = (axis + 1) % 3, a2 = (axis + 2) % 3, t1x = RR[r9 + a1], t1y = RR[r9 + 3 + a1], t1z = RR[r9 + 6 + a1], t2x = RR[r9 + a2], t2y = RR[r9 + 3 + a2], t2z = RR[r9 + 6 + a2], e1 = HR[r3 + a1], e2 = HR[r3 + a2], hn = HR[r3 + axis];
    for (let k = 0; k < 4; k++) { const s1 = k === 0 || k === 3 ? 1 : -1, s2 = k < 2 ? 1 : -1, vx = fx + s1 * ux + s2 * wx, vy = fy + s1 * uy + s2 * wy, vz = fz + s1 * uz + s2 * wz; clipA[k * 3] = vx * t1x + vy * t1y + vz * t1z; clipA[k * 3 + 1] = vx * t2x + vy * t2y + vz * t2z; clipA[k * 3 + 2] = vx * nx + vy * ny + vz * nz - hn; idA[k] = jb * 8 + (sj > 0 ? 4 : 0) + k; }
    SCR[1] = e1; SCR[2] = e2; let n = clip(clipA, idA, 4, clipB, idB, 0, 1, 1, 0); n = clip(clipB, idB, n, clipA, idA, 0, -1, 1, 1); n = clip(clipA, idA, n, clipB, idB, 1, 1, 2, 2); n = clip(clipB, idB, n, clipA, idA, 1, -1, 2, 3);
    let m = 0; for (let i = 0; i < n; i++)if (clipA[i * 3 + 2] <= margin) { clipB[m * 3] = clipA[i * 3]; clipB[m * 3 + 1] = clipA[i * 3 + 1]; clipB[m * 3 + 2] = clipA[i * 3 + 2]; idB[m++] = idA[i]; }
    if (m === 0) return 0;
    let outCount = m;
    if (m > 4) {
      let a = 0; for (let i = 1; i < m; i++)if (clipB[i * 3 + 2] < clipB[a * 3 + 2]) a = i;
      let b = -1, bd = -1; for (let i = 0; i < m; i++) { if (i === a) continue; const du = clipB[i * 3] - clipB[a * 3], dw = clipB[i * 3 + 1] - clipB[a * 3 + 1], d = du * du + dw * dw; if (d > bd) { bd = d; b = i; } }
      const eu = clipB[b * 3] - clipB[a * 3], ew = clipB[b * 3 + 1] - clipB[a * 3 + 1];
      let c = -1, cd = 0, d2 = -1, dd = 0;
      for (let i = 0; i < m; i++) { if (i === a || i === b) continue; const ar = eu * (clipB[i * 3 + 1] - clipB[a * 3 + 1]) - ew * (clipB[i * 3] - clipB[a * 3]); if (ar > cd) { cd = ar; c = i; } if (ar < dd) { dd = ar; d2 = i; } }
      pick[0] = a; pick[1] = b; outCount = 2; if (c >= 0) pick[outCount++] = c; if (d2 >= 0) pick[outCount++] = d2;
    } else for (let i = 0; i < m; i++)pick[i] = i;
    const code = ((flip ? 6 : 0) + axis * 2 + (sgn > 0 ? 1 : 0)) * 256, px = PR[r3], py = PR[r3 + 1], pz = PR[r3 + 2];
    for (let k = 0; k < outCount; k++) { const i = pick[k], u = clipB[i * 3], w = clipB[i * 3 + 1], d = clipB[i * 3 + 2], hgt = hn + d / 2; mP[k * 3] = px + u * t1x + w * t2x + hgt * nx; mP[k * 3 + 1] = py + u * t1y + w * t2y + hgt * ny; mP[k * 3 + 2] = pz + u * t1z + w * t2z + hgt * nz; mS[k] = d; mI[k] = code + idB[i]; }
    if (flip) { mN[0] = -nx; mN[1] = -ny; mN[2] = -nz; } else { mN[0] = nx; mN[1] = ny; mN[2] = nz; }
    return outCount;
  }
  function boxBox(PA, HA, a3, RA, a9, PB, HB, b3, RB, b9) {
    const margin = SCR[0];
    const dx = PB[b3] - PA[a3], dy = PB[b3 + 1] - PA[a3 + 1], dz = PB[b3 + 2] - PA[a3 + 2];
    for (let i = 0; i < 3; i++) { const ax = RA[a9 + i], ay = RA[a9 + 3 + i], az = RA[a9 + 6 + i]; tt[i] = dx * ax + dy * ay + dz * az; for (let j = 0; j < 3; j++) { const v = ax * RB[b9 + j] + ay * RB[b9 + 3 + j] + az * RB[b9 + 6 + j]; cc[i * 3 + j] = v; qq[i * 3 + j] = Math.abs(v) + 1e-9; } }
    const ha0 = HA[a3], ha1 = HA[a3 + 1], ha2 = HA[a3 + 2], hb0 = HB[b3], hb1 = HB[b3 + 1], hb2 = HB[b3 + 2];
    let bestA = -1e30, axisA = 0, bestB = -1e30, axisB = 0, bestE = -1e30, axisE = -1;
    for (let i = 0; i < 3; i++) { const s = Math.abs(tt[i]) - (HA[a3 + i] + hb0 * qq[i * 3] + hb1 * qq[i * 3 + 1] + hb2 * qq[i * 3 + 2]); if (s > margin) return 0; if (s > bestA) { bestA = s; axisA = i; } }
    for (let j = 0; j < 3; j++) { const s = Math.abs(tt[0] * cc[j] + tt[1] * cc[3 + j] + tt[2] * cc[6 + j]) - (HB[b3 + j] + ha0 * qq[j] + ha1 * qq[3 + j] + ha2 * qq[6 + j]); if (s > margin) return 0; if (s > bestB) { bestB = s; axisB = j; } }
    for (let i = 0; i < 3; i++) {
      const i1 = (i + 1) % 3, i2 = (i + 2) % 3;
      for (let j = 0; j < 3; j++) {
        const c = cc[i * 3 + j], l2 = 1 - c * c; if (l2 < 1e-6) continue; const j1 = (j + 1) % 3, j2 = (j + 2) % 3;
        const s = (Math.abs(tt[i2] * cc[i1 * 3 + j] - tt[i1] * cc[i2 * 3 + j]) - (HA[a3 + i1] * qq[i2 * 3 + j] + HA[a3 + i2] * qq[i1 * 3 + j] + HB[b3 + j1] * qq[i * 3 + j2] + HB[b3 + j2] * qq[i * 3 + j1])) / Math.sqrt(l2);
        if (s > margin) return 0; if (s > bestE) { bestE = s; axisE = i * 3 + j; }
      }
    }
    const useB = bestB > 0.95 * bestA + 0.002, bestF = useB ? bestB : bestA;
    if (axisE >= 0 && bestE > 0.95 * bestF + 0.01) {
      const i = (axisE / 3) | 0, j = axisE - i * 3, aix = RA[a9 + i], aiy = RA[a9 + 3 + i], aiz = RA[a9 + 6 + i], bjx = RB[b9 + j], bjy = RB[b9 + 3 + j], bjz = RB[b9 + 6 + j];
      let lx = aiy * bjz - aiz * bjy, ly = aiz * bjx - aix * bjz, lz = aix * bjy - aiy * bjx; const inv = 1 / Math.sqrt(lx * lx + ly * ly + lz * lz), sg = lx * dx + ly * dy + lz * dz < 0 ? -inv : inv; lx *= sg; ly *= sg; lz *= sg;
      // supporting edges: centre of the A edge farthest along +l, of the B edge farthest along -l
      let ax = PA[a3], ay = PA[a3 + 1], az = PA[a3 + 2], bx = PB[b3], by = PB[b3 + 1], bz = PB[b3 + 2], bits = 0;
      for (let k = 0; k < 3; k++) { if (k !== i) { const kx = RA[a9 + k], ky = RA[a9 + 3 + k], kz = RA[a9 + 6 + k], s = lx * kx + ly * ky + lz * kz > 0 ? HA[a3 + k] : -HA[a3 + k]; ax += kx * s; ay += ky * s; az += kz * s; bits = bits * 2 + (s > 0 ? 1 : 0); } }
      for (let k = 0; k < 3; k++) { if (k !== j) { const kx = RB[b9 + k], ky = RB[b9 + 3 + k], kz = RB[b9 + 6 + k], s = lx * kx + ly * ky + lz * kz > 0 ? -HB[b3 + k] : HB[b3 + k]; bx += kx * s; by += ky * s; bz += kz * s; bits = bits * 2 + (s > 0 ? 1 : 0); } }
      const rx = ax - bx, ry = ay - by, rz = az - bz, bq = cc[i * 3 + j], c = aix * rx + aiy * ry + aiz * rz, f = bjx * rx + bjy * ry + bjz * rz, den = 1 - bq * bq;
      let s = (bq * f - c) / den, u = (f - bq * c) / den; const la = HA[a3 + i], lb = HB[b3 + j]; s = s > la ? la : s < -la ? -la : s; u = u > lb ? lb : u < -lb ? -lb : u;
      const p1x = ax + aix * s, p1y = ay + aiy * s, p1z = az + aiz * s, p2x = bx + bjx * u, p2y = by + bjy * u, p2z = bz + bjz * u;
      mP[0] = (p1x + p2x) / 2; mP[1] = (p1y + p2y) / 2; mP[2] = (p1z + p2z) / 2; mS[0] = (p2x - p1x) * lx + (p2y - p1y) * ly + (p2z - p1z) * lz; mI[0] = 4096 + axisE * 16 + bits; mN[0] = lx; mN[1] = ly; mN[2] = lz; return 1;
    }
    return useB ? face(PB, HB, b3, RB, b9, PA, HA, a3, RA, a9, axisB, true) : face(PA, HA, a3, RA, a9, PB, HB, b3, RB, b9, axisA, false);
  }
  function boxGround(i) {
    const margin = SCR[0], p = i * 3, r = i * 9, hx = H[p], hy = H[p + 1], hz = H[p + 2]; let n = 0;
    if (BB[i * 6 + 1] - groundY > margin) return 0;
    for (let k = 0; k < 8; k++) {
      const sx = k & 1 ? hx : -hx, sy = k & 2 ? hy : -hy, sz = k & 4 ? hz : -hz, y = P[p + 1] + R[r + 3] * sx + R[r + 4] * sy + R[r + 5] * sz, d = y - groundY;
      if (d > margin) continue;
      const x = P[p] + R[r] * sx + R[r + 1] * sy + R[r + 2] * sz, z = P[p + 2] + R[r + 6] * sx + R[r + 7] * sy + R[r + 8] * sz;
      let at = n;
      if (n === 4) { at = 0; for (let m = 1; m < 4; m++)if (mS[m] > mS[at]) at = m; if (mS[at] <= d) continue; } else n++;
      mP[at * 3] = x; mP[at * 3 + 1] = y - d / 2; mP[at * 3 + 2] = z; mS[at] = d; mI[at] = 8192 + k;
    }
    mN[0] = 0; mN[1] = -1; mN[2] = 0; return n;
  }
  function lookup(key) { let h = (Math.imul(key, 0x9E3779B1) >>> 0) & (TS - 1); for (; ;) { const e = table[h]; if (e === 0) return -1; if (pK[e - 1] === key) return h; h = (h + 1) & (TS - 1); } }
  function emit(a, b, key, n) {
    if (nc + n > MC) return; nm++; const friction = SCR[3], restitution = SCR[4];
    const slot = pn ? lookup(key) : -1, from = slot >= 0 ? table[slot] - 1 : 0, old = slot >= 0 ? tcount[slot] : 0, a3 = a * 3, b3 = b * 3;
    for (let k = 0; k < n; k++) {
      const c = nc++, c3 = c * 3, id = mI[k]; cA[c] = a; cB[c] = b; cK[c] = key; cI[c] = id; cN[c3] = mN[0]; cN[c3 + 1] = mN[1]; cN[c3 + 2] = mN[2];
      cRA[c3] = mP[k * 3] - P[a3]; cRA[c3 + 1] = mP[k * 3 + 1] - P[a3 + 1]; cRA[c3 + 2] = mP[k * 3 + 2] - P[a3 + 2]; cRB[c3] = mP[k * 3] - P[b3]; cRB[c3 + 1] = mP[k * 3 + 1] - P[b3 + 1]; cRB[c3 + 2] = mP[k * 3 + 2] - P[b3 + 2];
      cS[c] = mS[k]; cFr[c] = friction; cRe[c] = restitution; cJn[c] = cJ1[c] = cJ2[c] = 0;
      for (let m = 0; m < old; m++)if (pI[from + m] === id) { cJn[c] = pJn[from + m]; cJ1[c] = pJ1[from + m]; cJ2[c] = pJ2[from + m]; break; }
    }
  }
  function find(i) { while (UF[i] !== i) { UF[i] = UF[UF[i]]; i = UF[i]; } return i; }
  function wakeIsland(id) { for (let i = 1; i < count; i++)if ((FL[i] & 2) && SI[i] === id) { FL[i] &= ~2; ST[i] = 0; SI[i] = -1; } sleepDirty = true; }
  function wake(i) { if (FL[i] & 2) wakeIsland(SI[i]); ST[i] = 0; }
  function collide(dt) {
    nc = 0; nm = 0; awakeCount = 0; let tests = 0;
    for (let i = 1; i < count; i++) {
      if (!(FL[i] & 1)) continue; const b = i * 6, v = i * 6;
      if (FL[i] & 2) { if (sleepDirty) { for (let k = 0; k < 6; k++)FB[b + k] = BB[b + k]; } continue; }
      awake[awakeCount++] = i; const ex = Math.abs(V[v]) * dt + margin0, ey = Math.abs(V[v + 1]) * dt + margin0, ez = Math.abs(V[v + 2]) * dt + margin0;
      FB[b] = BB[b] - ex; FB[b + 1] = BB[b + 1] - ey; FB[b + 2] = BB[b + 2] - ez; FB[b + 3] = BB[b + 3] + ex; FB[b + 4] = BB[b + 4] + ey; FB[b + 5] = BB[b + 5] + ez;
    }
    if (!awakeCount) return;
    if (sleepDirty) { buildGrid(zStart, zItems, true); sleepDirty = false; }
    buildGrid(aStart, aItems, false);
    const first = awakeCount;
    for (let n = 0; n < first; n++) {
      const a = awake[n], a6 = a * 6, a3 = a * 3, a9 = a * 9, speedA = Math.sqrt(V[a6] * V[a6] + V[a6 + 1] * V[a6 + 1] + V[a6 + 2] * V[a6 + 2]);
      const marginA = margin0 + speedA * dt;
      SCR[0] = marginA; if (hasGround) { const k = boxGround(a); if (k) { SCR[3] = Math.sqrt(FR[a] * 0.8); SCR[4] = RE[a] > 0.05 ? RE[a] : 0.05; emit(a, 0, a * KM + NB + MS, k); } }
      const x0 = cx(FB, a6), x1 = cx(FB, a6 + 3), z0 = cz(FB, a6 + 2), z1 = cz(FB, a6 + 5); stamp++;
      for (let z = z0; z <= z1; z++)for (let x = x0; x <= x1; x++) {
        const c = z * GW + x;
        for (let q = sStart[c], e = sStart[c + 1]; q < e; q++) {
          const s = sItems[q]; if (SSTAMP[s] === stamp) continue; SSTAMP[s] = stamp; const s3 = s * 3;
          if (FB[a6] > SP[s3] + SH[s3] || FB[a6 + 3] < SP[s3] - SH[s3] || FB[a6 + 1] > SP[s3 + 1] + SH[s3 + 1] || FB[a6 + 4] < SP[s3 + 1] - SH[s3 + 1] || FB[a6 + 2] > SP[s3 + 2] + SH[s3 + 2] || FB[a6 + 5] < SP[s3 + 2] - SH[s3 + 2]) continue;
          tests++; SCR[0] = marginA; const k = boxBox(P, H, a3, R, a9, SP, SH, s3, IDENT, 0); if (k) { SCR[3] = Math.sqrt(FR[a] * SF[s]); SCR[4] = RE[a] > SR[s] ? RE[a] : SR[s]; emit(a, 0, a * KM + NB + s, k); }
        }
      }
      for (let pass = 0; pass < 2; pass++) {
        const start = pass ? zStart : aStart, items = pass ? zItems : aItems;
        for (let z = z0; z <= z1; z++)for (let x = x0; x <= x1; x++) {
          const c = z * GW + x;
          for (let q = start[c], e = start[c + 1]; q < e; q++) {
            const b = items[q]; if (!pass && b <= a) continue; const b6 = b * 6;
            if (FB[a6] > FB[b6 + 3] || FB[a6 + 3] < FB[b6] || FB[a6 + 1] > FB[b6 + 4] || FB[a6 + 4] < FB[b6 + 1] || FB[a6 + 2] > FB[b6 + 5] || FB[a6 + 5] < FB[b6 + 2]) continue;
            // a pair shared by several cells is handled only in the cell holding the low corner of the overlap
            if (cx(FB, FB[a6] > FB[b6] ? a6 : b6) !== x || cz(FB, FB[a6 + 2] > FB[b6 + 2] ? a6 + 2 : b6 + 2) !== z) continue;
            tests++; const lo = a < b ? a : b, hi = a < b ? b : a, sb = Math.sqrt(V[b6] * V[b6] + V[b6 + 1] * V[b6 + 1] + V[b6 + 2] * V[b6 + 2]);
            SCR[0] = marginA + sb * dt; const k = boxBox(P, H, lo * 3, R, lo * 9, P, H, hi * 3, R, hi * 9);
            if (k) { SCR[3] = Math.sqrt(FR[a] * FR[b]); SCR[4] = RE[a] > RE[b] ? RE[a] : RE[b]; emit(lo, hi, lo * KM + hi, k); if (pass && (FL[b] & 2)) { const id = SI[b]; for (let i = 1; i < count; i++)if ((FL[i] & 2) && SI[i] === id) { FL[i] &= ~2; ST[i] = 0; SI[i] = -1; awake[awakeCount++] = i; } sleepDirty = true; } }
          }
        }
      }
    }
    stats.tests = tests;
  }
  function prepare() {
    for (let c = 0; c < nc; c++) {
      const a = cA[c], b = cB[c], c3 = c * 3, c6 = c * 6, a6 = a * 6, b6 = b * 6, ima = IM[a], imb = IM[b];
      const nx = cN[c3], ny = cN[c3 + 1], nz = cN[c3 + 2];
      // tangent basis from the normal (sqrt only)
      let t1x, t1y, t1z; if (Math.abs(nx) < 0.57735) { const l = 1 / Math.sqrt(ny * ny + nz * nz); t1x = 0; t1y = -nz * l; t1z = ny * l; } else { const l = 1 / Math.sqrt(nx * nx + nz * nz); t1x = nz * l; t1y = 0; t1z = -nx * l; }
      const t2x = ny * t1z - nz * t1y, t2y = nz * t1x - nx * t1z, t2z = nx * t1y - ny * t1x;
      cT1[c3] = t1x; cT1[c3 + 1] = t1y; cT1[c3 + 2] = t1z; cT2[c3] = t2x; cT2[c3 + 1] = t2y; cT2[c3 + 2] = t2z;
      const rax = cRA[c3], ray = cRA[c3 + 1], raz = cRA[c3 + 2], rbx = cRB[c3], rby = cRB[c3 + 1], rbz = cRB[c3 + 2];
      for (let d = 0; d < 3; d++) {
        const dx = d === 0 ? nx : d === 1 ? t1x : t2x, dy = d === 0 ? ny : d === 1 ? t1y : t2y, dz = d === 0 ? nz : d === 1 ? t1z : t2z, out = d === 0 ? cAN : d === 1 ? cA1 : cA2;
        const ux = ray * dz - raz * dy, uy = raz * dx - rax * dz, uz = rax * dy - ray * dx, wx = rby * dz - rbz * dy, wy = rbz * dx - rbx * dz, wz = rbx * dy - rby * dx;
        const ax = IW[a6] * ux + IW[a6 + 1] * uy + IW[a6 + 2] * uz, ay = IW[a6 + 1] * ux + IW[a6 + 3] * uy + IW[a6 + 4] * uz, az = IW[a6 + 2] * ux + IW[a6 + 4] * uy + IW[a6 + 5] * uz;
        const bx = IW[b6] * wx + IW[b6 + 1] * wy + IW[b6 + 2] * wz, by = IW[b6 + 1] * wx + IW[b6 + 3] * wy + IW[b6 + 4] * wz, bz = IW[b6 + 2] * wx + IW[b6 + 4] * wy + IW[b6 + 5] * wz;
        out[c6] = ax; out[c6 + 1] = ay; out[c6 + 2] = az; out[c6 + 3] = bx; out[c6 + 4] = by; out[c6 + 5] = bz;
        const k = ima + imb + ux * ax + uy * ay + uz * az + wx * bx + wy * by + wz * bz, m = k > 0 ? 1 / k : 0; if (d === 0) cMn[c] = m; else if (d === 1) cM1[c] = m; else cM2[c] = m;
      }
      const dvx = V[b6] + V[b6 + 4] * rbz - V[b6 + 5] * rby - V[a6] - (V[a6 + 4] * raz - V[a6 + 5] * ray), dvy = V[b6 + 1] + V[b6 + 5] * rbx - V[b6 + 3] * rbz - V[a6 + 1] - (V[a6 + 5] * rax - V[a6 + 3] * raz), dvz = V[b6 + 2] + V[b6 + 3] * rby - V[b6 + 4] * rbx - V[a6 + 2] - (V[a6 + 3] * ray - V[a6 + 4] * rax);
      cV0[c] = dvx * nx + dvy * ny + dvz * nz; cMax[c] = 0;
    }
  }
  function warm() {
    for (let c = 0; c < nc; c++) {
      const a6 = cA[c] * 6, b6 = cB[c] * 6, c3 = c * 3, c6 = c * 6, ima = IM[cA[c]], imb = IM[cB[c]], jn = cJn[c], j1 = cJ1[c], j2 = cJ2[c];
      const px = cN[c3] * jn + cT1[c3] * j1 + cT2[c3] * j2, py = cN[c3 + 1] * jn + cT1[c3 + 1] * j1 + cT2[c3 + 1] * j2, pz = cN[c3 + 2] * jn + cT1[c3 + 2] * j1 + cT2[c3 + 2] * j2;
      V[a6] -= px * ima; V[a6 + 1] -= py * ima; V[a6 + 2] -= pz * ima; V[b6] += px * imb; V[b6 + 1] += py * imb; V[b6 + 2] += pz * imb;
      V[a6 + 3] -= cAN[c6] * jn + cA1[c6] * j1 + cA2[c6] * j2; V[a6 + 4] -= cAN[c6 + 1] * jn + cA1[c6 + 1] * j1 + cA2[c6 + 1] * j2; V[a6 + 5] -= cAN[c6 + 2] * jn + cA1[c6 + 2] * j1 + cA2[c6 + 2] * j2;
      V[b6 + 3] += cAN[c6 + 3] * jn + cA1[c6 + 3] * j1 + cA2[c6 + 3] * j2; V[b6 + 4] += cAN[c6 + 4] * jn + cA1[c6 + 4] * j1 + cA2[c6 + 4] * j2; V[b6 + 5] += cAN[c6 + 5] * jn + cA1[c6 + 5] * j1 + cA2[c6 + 5] * j2;
    }
  }
  function solve(useBias) {
    const invH = SCR[5], biasRate = SCR[6], massScale = SCR[7], impulseScale = SCR[8];
    for (let c = 0; c < nc; c++) {
      const a = cA[c], b = cB[c], a6 = a * 6, b6 = b * 6, c3 = c * 3, c6 = c * 6, ima = IM[a], imb = IM[b];
      let vax = V[a6], vay = V[a6 + 1], vaz = V[a6 + 2], wax = V[a6 + 3], way = V[a6 + 4], waz = V[a6 + 5], vbx = V[b6], vby = V[b6 + 1], vbz = V[b6 + 2], wbx = V[b6 + 3], wby = V[b6 + 4], wbz = V[b6 + 5];
      const rax = cRA[c3], ray = cRA[c3 + 1], raz = cRA[c3 + 2], rbx = cRB[c3], rby = cRB[c3 + 1], rbz = cRB[c3 + 2], maxF = cFr[c] * cJn[c];
      // friction, two tangents
      for (let d = 0; d < 2; d++) {
        const T = d ? cT2 : cT1, AR = d ? cA2 : cA1, tx = T[c3], ty = T[c3 + 1], tz = T[c3 + 2];
        const dvx = vbx + wby * rbz - wbz * rby - vax - (way * raz - waz * ray), dvy = vby + wbz * rbx - wbx * rbz - vay - (waz * rax - wax * raz), dvz = vbz + wbx * rby - wby * rbx - vaz - (wax * ray - way * rax);
        const old = d ? cJ2[c] : cJ1[c]; let nj = old - (d ? cM2[c] : cM1[c]) * (dvx * tx + dvy * ty + dvz * tz); nj = nj > maxF ? maxF : nj < -maxF ? -maxF : nj; const j = nj - old; if (d) cJ2[c] = nj; else cJ1[c] = nj;
        vax -= tx * j * ima; vay -= ty * j * ima; vaz -= tz * j * ima; wax -= AR[c6] * j; way -= AR[c6 + 1] * j; waz -= AR[c6 + 2] * j; vbx += tx * j * imb; vby += ty * j * imb; vbz += tz * j * imb; wbx += AR[c6 + 3] * j; wby += AR[c6 + 4] * j; wbz += AR[c6 + 5] * j;
      }
      // normal, soft constraint; separation tracked through the accumulated sub-step displacement of both bodies
      const nx = cN[c3], ny = cN[c3 + 1], nz = cN[c3 + 2];
      const dax = D[a6] + D[a6 + 4] * raz - D[a6 + 5] * ray, day = D[a6 + 1] + D[a6 + 5] * rax - D[a6 + 3] * raz, daz = D[a6 + 2] + D[a6 + 3] * ray - D[a6 + 4] * rax, dbx = D[b6] + D[b6 + 4] * rbz - D[b6 + 5] * rby, dby = D[b6 + 1] + D[b6 + 5] * rbx - D[b6 + 3] * rbz, dbz = D[b6 + 2] + D[b6 + 3] * rby - D[b6 + 4] * rbx;
      const s = cS[c] + (dbx - dax) * nx + (dby - day) * ny + (dbz - daz) * nz + slop;
      let bias = 0, ms = 1, is = 0; if (s > 0) bias = s * invH; else if (useBias) { bias = biasRate * s; if (bias < -pushout) bias = -pushout; ms = massScale; is = impulseScale; }
      const dvx = vbx + wby * rbz - wbz * rby - vax - (way * raz - waz * ray), dvy = vby + wbz * rbx - wbx * rbz - vay - (waz * rax - wax * raz), dvz = vbz + wbx * rby - wby * rbx - vaz - (wax * ray - way * rax);
      const old = cJn[c]; let nj = old - cMn[c] * ms * (dvx * nx + dvy * ny + dvz * nz + bias) - is * old; if (nj < 0) nj = 0; const j = nj - old; cJn[c] = nj; if (nj > cMax[c]) cMax[c] = nj;
      V[a6] = vax - nx * j * ima; V[a6 + 1] = vay - ny * j * ima; V[a6 + 2] = vaz - nz * j * ima; V[a6 + 3] = wax - cAN[c6] * j; V[a6 + 4] = way - cAN[c6 + 1] * j; V[a6 + 5] = waz - cAN[c6 + 2] * j;
      V[b6] = vbx + nx * j * imb; V[b6 + 1] = vby + ny * j * imb; V[b6 + 2] = vbz + nz * j * imb; V[b6 + 3] = wbx + cAN[c6 + 3] * j; V[b6 + 4] = wby + cAN[c6 + 4] * j; V[b6 + 5] = wbz + cAN[c6 + 5] * j;
    }
  }
  function restitution() {
    for (let c = 0; c < nc; c++) {
      if (cRe[c] === 0 || cV0[c] > -restThreshold || cMax[c] === 0) continue;
      const a = cA[c], b = cB[c], a6 = a * 6, b6 = b * 6, c3 = c * 3, c6 = c * 6, ima = IM[a], imb = IM[b], nx = cN[c3], ny = cN[c3 + 1], nz = cN[c3 + 2], rax = cRA[c3], ray = cRA[c3 + 1], raz = cRA[c3 + 2], rbx = cRB[c3], rby = cRB[c3 + 1], rbz = cRB[c3 + 2];
      const dvx = V[b6] + V[b6 + 4] * rbz - V[b6 + 5] * rby - V[a6] - (V[a6 + 4] * raz - V[a6 + 5] * ray), dvy = V[b6 + 1] + V[b6 + 5] * rbx - V[b6 + 3] * rbz - V[a6 + 1] - (V[a6 + 5] * rax - V[a6 + 3] * raz), dvz = V[b6 + 2] + V[b6 + 3] * rby - V[b6 + 4] * rbx - V[a6 + 2] - (V[a6 + 3] * ray - V[a6 + 4] * rax);
      const old = cJn[c]; let nj = old - cMn[c] * (dvx * nx + dvy * ny + dvz * nz + cRe[c] * cV0[c]); if (nj < 0) nj = 0; const j = nj - old; cJn[c] = nj;
      V[a6] -= nx * j * ima; V[a6 + 1] -= ny * j * ima; V[a6 + 2] -= nz * j * ima; V[a6 + 3] -= cAN[c6] * j; V[a6 + 4] -= cAN[c6 + 1] * j; V[a6 + 5] -= cAN[c6 + 2] * j; V[b6] += nx * j * imb; V[b6 + 1] += ny * j * imb; V[b6 + 2] += nz * j * imb; V[b6 + 3] += cAN[c6 + 3] * j; V[b6 + 4] += cAN[c6 + 4] * j; V[b6 + 5] += cAN[c6 + 5] * j;
    }
  }
  function step(dt, substeps = 1) {
    const T0 = prof ? performance.now() : 0;
    collide(dt); stats.contacts = nc; stats.manifolds = nm; stats.awake = awakeCount;
    if (!awakeCount) { pn = 0; return; }
    const T1 = prof ? performance.now() : 0;
    prepare();
    const T2 = prof ? performance.now() : 0;
    const h = dt / substeps, invH = 1 / h, hertz = Math.min(contactHertz0, 0.25 * invH), omega = 6.283185307179586 * hertz, a1 = 2 * zeta + h * omega, a2 = h * omega * a1, a3 = 1 / (1 + a2), biasRate = omega / a1, massScale = a2 * a3, impulseScale = a3;
    SCR[5] = invH; SCR[6] = biasRate; SCR[7] = massScale; SCR[8] = impulseScale;
    const ld = 1 / (1 + h * linDamp), ad = 1 / (1 + h * angDamp), maxLin2 = maxLin * maxLin, maxAng2 = maxAng * maxAng;
    for (let n = 0; n < awakeCount; n++) { const i6 = awake[n] * 6; D[i6] = D[i6 + 1] = D[i6 + 2] = D[i6 + 3] = D[i6 + 4] = D[i6 + 5] = 0; }
    for (let sub = 0; sub < substeps; sub++) {
      for (let n = 0; n < awakeCount; n++) { const v = awake[n] * 6; V[v] *= ld; V[v + 1] = (V[v + 1] + G * h) * ld; V[v + 2] *= ld; V[v + 3] *= ad; V[v + 4] *= ad; V[v + 5] *= ad; }
      warm();
      for (let it = 0; it < iterations; it++)solve(true);
      for (let n = 0; n < awakeCount; n++) {
        const i = awake[n], v = i * 6, p = i * 3, q = i * 4;
        let vx = V[v], vy = V[v + 1], vz = V[v + 2], wx = V[v + 3], wy = V[v + 4], wz = V[v + 5];
        const l2 = vx * vx + vy * vy + vz * vz; if (l2 > maxLin2) { const k = maxLin / Math.sqrt(l2); vx *= k; vy *= k; vz *= k; V[v] = vx; V[v + 1] = vy; V[v + 2] = vz; }
        const w2 = wx * wx + wy * wy + wz * wz; if (w2 > maxAng2) { const k = maxAng / Math.sqrt(w2); wx *= k; wy *= k; wz *= k; V[v + 3] = wx; V[v + 4] = wy; V[v + 5] = wz; }
        P[p] += vx * h; P[p + 1] += vy * h; P[p + 2] += vz * h; D[v] += vx * h; D[v + 1] += vy * h; D[v + 2] += vz * h; D[v + 3] += wx * h; D[v + 4] += wy * h; D[v + 5] += wz * h;
        const qx = Q[q], qy = Q[q + 1], qz = Q[q + 2], qw = Q[q + 3], k = 0.5 * h;
        const nx = qx + k * (wx * qw + wy * qz - wz * qy), ny = qy + k * (wy * qw + wz * qx - wx * qz), nz = qz + k * (wz * qw + wx * qy - wy * qx), nw = qw - k * (wx * qx + wy * qy + wz * qz), inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw);
        Q[q] = nx * inv; Q[q + 1] = ny * inv; Q[q + 2] = nz * inv; Q[q + 3] = nw * inv;
      }
      for (let it = 0; it < relaxIterations; it++)solve(false);
    }
    restitution();
    const T3 = prof ? performance.now() : 0;
    // impulse cache for the next step
    table.fill(0); pn = nc;
    for (let c = 0; c < nc; c++) { pK[c] = cK[c]; pI[c] = cI[c]; pJn[c] = cJn[c]; pJ1[c] = cJ1[c]; pJ2[c] = cJ2[c]; }
    for (let c = 0; c < nc;) { const key = cK[c]; let e = c + 1; while (e < nc && cK[e] === key) e++; let hh = (Math.imul(key, 0x9E3779B1) >>> 0) & (TS - 1); while (table[hh] !== 0) hh = (hh + 1) & (TS - 1); table[hh] = c + 1; tcount[hh] = e - c; c = e; }
    // islands and sleeping
    for (let n = 0; n < awakeCount; n++) { const i = awake[n]; UF[i] = i; }
    for (let c = 0; c < nc; c++) { const a = cA[c], b = cB[c]; if (b === 0 || (c > 0 && cK[c] === cK[c - 1])) continue; const ra = find(a), rb = find(b); if (ra !== rb) { if (ra < rb) UF[rb] = ra; else UF[ra] = rb; } }
    for (let n = 0; n < awakeCount; n++) {
      const i = awake[n], v = i * 6; derive(i);
      if (V[v] * V[v] + V[v + 1] * V[v + 1] + V[v + 2] * V[v + 2] < sleepLin2 && V[v + 3] * V[v + 3] + V[v + 4] * V[v + 4] + V[v + 5] * V[v + 5] < sleepAng2) ST[i] += dt; else ST[i] = 0;
      IMIN[i] = 1e30;
    }
    for (let n = 0; n < awakeCount; n++) { const i = awake[n], r = find(i); if (ST[i] < IMIN[r]) IMIN[r] = ST[i]; }
    for (let n = 0; n < awakeCount; n++) { const i = awake[n], r = find(i); if (IMIN[r] >= sleepTime) { FL[i] |= 2; SI[i] = r; const v = i * 6; V[v] = V[v + 1] = V[v + 2] = V[v + 3] = V[v + 4] = V[v + 5] = 0; sleepDirty = true; } }
    if (prof) { const T4 = performance.now(); TP[0] += T1 - T0; TP[1] += T2 - T1; TP[2] += T3 - T2; TP[3] += T4 - T3; }
  }
  function impulseAt(i, px, py, pz, jx, jy, jz) {
    if (i <= 0 || !(FL[i] & 1)) return; wake(i); const v = i * 6, p = i * 3, b = i * 6, im = IM[i], rx = px - P[p], ry = py - P[p + 1], rz = pz - P[p + 2], tx = ry * jz - rz * jy, ty = rz * jx - rx * jz, tz = rx * jy - ry * jx;
    V[v] += jx * im; V[v + 1] += jy * im; V[v + 2] += jz * im; V[v + 3] += IW[b] * tx + IW[b + 1] * ty + IW[b + 2] * tz; V[v + 4] += IW[b + 1] * tx + IW[b + 3] * ty + IW[b + 4] * tz; V[v + 5] += IW[b + 2] * tx + IW[b + 4] * ty + IW[b + 5] * tz;
  }
  // radial blast: impulse J = strength * (1 - d/r) capped to a velocity change, applied at the box point nearest to the centre (gives spin)
  function explode(x, y, z, radius, strength, maxDv = 14) {
    let touched = 0;
    for (let i = 1; i < count; i++) {
      if (!(FL[i] & 1)) continue; const p = i * 3, r = i * 9, dx = x - P[p], dy = y - P[p + 1], dz = z - P[p + 2];
      let lx = dx * R[r] + dy * R[r + 3] + dz * R[r + 6], ly = dx * R[r + 1] + dy * R[r + 4] + dz * R[r + 7], lz = dx * R[r + 2] + dy * R[r + 5] + dz * R[r + 8];
      lx = lx > H[p] ? H[p] : lx < -H[p] ? -H[p] : lx; ly = ly > H[p + 1] ? H[p + 1] : ly < -H[p + 1] ? -H[p + 1] : ly; lz = lz > H[p + 2] ? H[p + 2] : lz < -H[p + 2] ? -H[p + 2] : lz;
      const cxw = P[p] + R[r] * lx + R[r + 1] * ly + R[r + 2] * lz, cyw = P[p + 1] + R[r + 3] * lx + R[r + 4] * ly + R[r + 5] * lz, czw = P[p + 2] + R[r + 6] * lx + R[r + 7] * ly + R[r + 8] * lz;
      let ex = P[p] - x, ey = P[p + 1] - y + 0.35, ez = P[p + 2] - z; const d = Math.sqrt((cxw - x) * (cxw - x) + (cyw - y) * (cyw - y) + (czw - z) * (czw - z)); if (d >= radius) continue;
      const el = Math.sqrt(ex * ex + ey * ey + ez * ez); if (el < 1e-6) { ex = 0; ey = 1; ez = 0; } else { ex /= el; ey /= el; ez /= el; }
      let j = strength * (1 - d / radius); const cap = maxDv / IM[i]; if (j > cap) j = cap; impulseAt(i, cxw, cyw, czw, ex * j, ey * j, ez * j); touched++;
    }
    return touched;
  }
  function hash() { let h = 2166136261; const u = [new Uint32Array(P.buffer, 0, count * 6), new Uint32Array(Q.buffer, 0, count * 8), new Uint32Array(V.buffer, 0, count * 12)]; for (const a of u) for (let i = 0; i < a.length; i++)h = Math.imul(h ^ a[i], 16777619); for (let i = 0; i < count; i++)h = Math.imul(h ^ FL[i], 16777619); return (h >>> 0).toString(16); }
  function snapshot(withCache = true) {
    const n = count, cut = (a, k) => Array.from(a.subarray(0, n * k));
    return { count: n, P: cut(P, 3), Q: cut(Q, 4), V: cut(V, 6), H: cut(H, 3), IM: cut(IM, 1), FR: cut(FR, 1), RE: cut(RE, 1), FL: cut(FL, 1), ST: cut(ST, 1), SI: cut(SI, 1),
      cache: withCache ? { K: Array.from(pK.subarray(0, pn)), I: Array.from(pI.subarray(0, pn)), Jn: Array.from(pJn.subarray(0, pn)), J1: Array.from(pJ1.subarray(0, pn)), J2: Array.from(pJ2.subarray(0, pn)) } : null };
  }
  function restore(s) {
    count = s.count; P.set(s.P); Q.set(s.Q); V.set(s.V); H.set(s.H); IM.set(s.IM); FR.set(s.FR); RE.set(s.RE); FL.set(s.FL); ST.set(s.ST); SI.set(s.SI);
    for (let i = 1; i < count; i++) { const p = i * 3, im = IM[i], hx = H[p], hy = H[p + 1], hz = H[p + 2]; IL[p] = 3 * im / (hy * hy + hz * hz); IL[p + 1] = 3 * im / (hx * hx + hz * hz); IL[p + 2] = 3 * im / (hx * hx + hy * hy); derive(i); }
    table.fill(0); pn = 0; sleepDirty = true;
    if (s.cache) { pn = s.cache.K.length; pK.set(s.cache.K); pI.set(s.cache.I); pJn.set(s.cache.Jn); pJ1.set(s.cache.J1); pJ2.set(s.cache.J2); for (let c = 0; c < pn;) { const key = pK[c]; let e = c + 1; while (e < pn && pK[e] === key) e++; let hh = (Math.imul(key, 0x9E3779B1) >>> 0) & (TS - 1); while (table[hh] !== 0) hh = (hh + 1) & (TS - 1); table[hh] = c + 1; tcount[hh] = e - c; c = e; } }
  }
  return { addBox, addStatic, buildStatics, step, impulseAt, explode, hash, snapshot, restore, wake, stats, TP, P, Q, V, H, R, FL, ST, get count() { return count; }, get contacts() { return nc; }, set groundY(v) { groundY = v; } };
}
