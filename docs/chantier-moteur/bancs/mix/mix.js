// Banc MIX — rendu hors ligne du mixage complet de METAL (src/audio.js + src/music.js, copies en mémoire ; écrit
// sur 0.8.0, rejoué sur 0.8.1). La chaîne est celle du vrai FAudio.create() : le source n'est modifié que par les
// variantes déclarées ci-dessous (remplacements exacts, vérifiés uniques) et par deux lignes d'instrumentation qui
// exposent les nœuds. Exception : v.source ('A' = SRC, 'B' = SRC_B, job=ab) rend la source telle quelle, sans aucun
// remplacement ni réglage imposé ; seules la sortie (canaux 0 et 1), audio.stats et le compte d'automatisations
// sont alors mesurés. Une scène marquée title (scène t) joue la musique d'accueil par setTitlePlaying(true).
'use strict';
const Q = new URLSearchParams(location.search), SR = +Q.get('sr') || 48000, K0 = 120, HZ = 60, TAIL = 1.5;
function emit(obj) { const s = btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); for (let i = 0; i < s.length; i += 6000) console.log('MIXCHUNK ' + s.slice(i, i + 6000)); console.log('MIXDONE'); }
function patchOnce(src, from, to, tag) { const at = src.indexOf(from); if (at < 0) throw new Error('patch introuvable : ' + tag); if (src.indexOf(from, at + 1) >= 0) throw new Error('patch non unique : ' + tag); return src.slice(0, at) + to + src.slice(at + from.length); }
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000, dB = v => 20 * Math.log10(Math.max(v, 1e-12));

// ---------- variantes ----------
const COMP = {
  cur: {threshold: -19, knee: 18, ratio: 5, attack: .004, release: .18},        // src/audio.js:314-315
  feel07: {threshold: -12, knee: 6, ratio: 3, attack: .012, release: .12},      // FEEL-07
  lim: {threshold: -6, knee: 4, ratio: 12, attack: .001, release: .09},         // proposition MIX : limiteur de sécurité
  lim2: {threshold: -9, knee: 6, ratio: 8, attack: .002, release: .10},
  off: {threshold: 0, knee: 0, ratio: 1, attack: .004, release: .18}
};
const DUCK = {
  cur: {weapon: .45, hold: null, mode: 'gain'},                                  // src/audio.js:137-149
  feel07: {weapon: .35, hold: {fracture: .22, rocket: .22, grenade: .22, grenadeLaunch: .22, shot: .18}, mode: 'gain'},
  shelf: {weapon: .25, hold: null, mode: 'shelf', fullband: 0},                  // étagère basse 150 Hz, −12 dB, pas de duck large bande
  shelfmix: {weapon: .25, hold: null, mode: 'shelf', fullband: .3},              // étagère −12 dB + duck large bande léger (×0,775)
  prop: {weapon: .25, hold: {shot: .36, fracture: .30, rocket: .30, grenade: .30, grenadeLaunch: .30}, mode: 'shelf', fullband: .3},
  curhold: {weapon: .45, hold: {shot: .36, fracture: .30, rocket: .30, grenade: .30, grenadeLaunch: .30}, mode: 'gain'},
  none: {weapon: 1, hold: null, mode: 'gain'}
};
const synthCache = new Map();
let RECIPE = 'cur';
window.__SYNTH = function (name, variant, rate, original) {
  const proto = RECIPE === 'doom' && DOOMISH.RECIPES[name], key = (proto ? 'doom' : 'cur') + '|' + name + '|' + variant + '|' + rate;
  let v = synthCache.get(key); if (!v) { v = proto ? DOOMISH.synth(name, variant | 0, rate || 22050) : original(name, variant, rate); synthCache.set(key, v); }
  return v;
};
function buildAudio(v) {
  let s = SRC.audio; const duck = DUCK[v.duck || 'cur'];
  s = patchOnce(s, 'function synthesize(name, variant, sampleRate) {', 'function synthesize(name, variant, sampleRate) { return window.__SYNTH(name, variant, sampleRate, synthesize0); }\n  function synthesize0(name, variant, sampleRate) {', 'synth');
  s = patchOnce(s, 'musicBus = remember(ctx.createGain()); musicBus.gain.value = MUSIC_GAIN; musicBus.connect(master);',
    'musicBus = remember(ctx.createGain()); musicBus.gain.value = MUSIC_GAIN; ' + (duck.mode === 'shelf'
      ? "var duckShelf = remember(ctx.createBiquadFilter()); duckShelf.type = 'lowshelf'; duckShelf.frequency.value = " + (v.shelfHz || 150) + "; duckShelf.gain.value = 0; " + (v.shelfK ? "duckShelf.gain.automationRate = 'k-rate'; " : '') + "musicBus.connect(duckShelf); duckShelf.connect(master); window.__duckShelf = duckShelf;"
      : 'musicBus.connect(master); window.__duckShelf = null;') +
    ' window.__NODES = {master: master, limiter: limiter, guard: guard, effects: effects, ambience: ambience, musicBus: musicBus, musicOut: window.__duckShelf || musicBus};', 'nodes');
  s = patchOnce(s, 'damping.connect(master); damping.connect(feedback); feedback.connect(delay);', 'damping.connect(master); damping.connect(feedback); feedback.connect(delay); window.__NODES.damping = damping;', 'damping');
  if (v.musicGain && v.musicGain !== 1) s = patchOnce(s, 'var MUSIC_GAIN = .56,', 'var MUSIC_GAIN = ' + (.56 * v.musicGain) + ',', 'musicGain');
  if (duck.weapon !== .45) s = patchOnce(s, "(shot|fracture|rocket|grenade|grenadeLaunch|shieldBlock|shieldBash|melee|hurt)$/.test(cue) ? .45 :", "(shot|fracture|rocket|grenade|grenadeLaunch|shieldBlock|shieldBash|melee|hurt)$/.test(cue) ? " + duck.weapon + " :", 'duckWeapon');
  if (duck.hold) s = patchOnce(s, 'hold = strength < .4 ? .28 : .14;', 'hold = ' + JSON.stringify(duck.hold) + '[cue] || (strength < .4 ? .28 : .14);', 'duckHold');
  if (duck.mode === 'shelf') s = patchOnce(s, 'musicBus.gain.cancelScheduledValues(now);\n        musicBus.gain.setTargetAtTime(MUSIC_GAIN * duckDepth, now, .006);\n        musicBus.gain.setTargetAtTime(MUSIC_GAIN, duckUntil, .18);',
    'duckShelf_apply(now);', 'duckApply').replace('function duckMusic() {', 'function duckShelf_apply(now) { var f = window.__duckShelf, fb = ' + (duck.fullband || 0) + '; f.gain.cancelScheduledValues(now); f.gain.setTargetAtTime(20 * Math.log10(duckDepth), now, .006); f.gain.setTargetAtTime(0, duckUntil, .18);' +
      ' if (fb > 0) { musicBus.gain.cancelScheduledValues(now); musicBus.gain.setTargetAtTime(MUSIC_GAIN * (1 - fb * (1 - duckDepth)), now, .006); musicBus.gain.setTargetAtTime(MUSIC_GAIN, duckUntil, .18); } }\n      function duckMusic() {');
  if (v.weaponGain && v.weaponGain !== 1) { const k = v.weaponGain;
    s = patchOnce(s, "pcm(pistol?'pistol':'smg',(pistol?.63:.49)*g,e.pan,e.event);", "pcm(pistol?'pistol':'smg',(pistol?.63:.49)*g*" + k + ",e.pan,e.event);", 'wg1');
    s = patchOnce(s, "if(e)pcm('shotgun',.77*e.level,e.pan,e.event);", "if(e)pcm('shotgun',.77*e.level*" + k + ",e.pan,e.event);", 'wg2');
    s = patchOnce(s, "if (e)pcm('rocket',.57*e.level,e.pan,e.event);", "if (e)pcm('rocket',.57*e.level*" + k + ",e.pan,e.event);", 'wg3'); }
  if (v.duckTau) s = patchOnce(s, 'f.gain.setTargetAtTime(0, duckUntil, .18);', 'f.gain.setTargetAtTime(0, duckUntil, ' + v.duckTau + ');', 'tau1').replace('musicBus.gain.setTargetAtTime(MUSIC_GAIN, duckUntil, .18); } }', 'musicBus.gain.setTargetAtTime(MUSIC_GAIN, duckUntil, ' + v.duckTau + '); } }');
  if (v.noLoops) { // attribution : boucles d'ambiance (vapeur, vent, 4 moteurs) non démarrées
    s = patchOnce(s, 'steamPan.connect(ambience); hiss.start();', 'steamPan.connect(ambience);', 'nl1');
    s = patchOnce(s, 'airVolume.connect(ambience); air.start();', 'airVolume.connect(ambience);', 'nl2');
    s = patchOnce(s, 'source.connect(m.filter);source.start();m.source=source;', 'source.connect(m.filter);m.source=source;', 'nl3'); }
  if (v.noComp) s = patchOnce(s, 'master.connect(limiter); limiter.connect(guard); guard.connect(ctx.destination);', 'master.connect(guard); guard.connect(ctx.destination);', 'nc');
  if (v.noGuard) s = patchOnce(s, 'master.connect(limiter); limiter.connect(guard); guard.connect(ctx.destination);', 'master.connect(limiter); limiter.connect(ctx.destination);', 'ng');
  if (v.noEcho) s = patchOnce(s, 'effects.connect(send); send.connect(delay); delay.connect(damping);', 'send.connect(delay); delay.connect(damping);', 'ne');
  if (v.tell === 'boss04') { // BOSS-04 : gain du tell ×3 (0,09 → 0,27) ; la portée 90 m est appliquée au rejeu
    s = patchOnce(s, "tone(92,180,.52,.09*g,'triangle',0,e.pan,1100);tone(370,530,.28,.035*g,'sine',.08,-e.pan*.3);noise(.16,.035*g,720,e.pan,.12,'bandpass');", "tone(92,180,.52,.27*g,'triangle',0,e.pan,1100);tone(370,530,.28,.105*g,'sine',.08,-e.pan*.3);noise(.16,.105*g,720,e.pan,.12,'bandpass');", 'tell');
  }
  if (v.loop14 === 'exact' || v.loop14 === 'seuil') { // LOOP-14 : setters qui mémorisent, une mise à jour par image, dédoublonnage
    const thr = v.loop14 === 'seuil';
    s = patchOnce(s, 'machineOccluded=Math.max(0,Math.min(1,Number(occluded)||0));updateMachinery(); },', 'machineOccluded=Math.max(0,Math.min(1,Number(occluded)||0)); },', 'l14a');
    s = patchOnce(s, 'steamOccluded=Math.max(0,Math.min(1,Number(occluded)||0)); updateSteam(); },', 'steamOccluded=Math.max(0,Math.min(1,Number(occluded)||0)); },', 'l14b');
    // setTarget dédoublonné : même cible et même constante => l'exponentielle en cours est déjà la bonne (sans mémoire)
    const helper = 'var __last = new Map(); function __set(param, value, time, tau, eps) { var q = __last.get(param); if (q && q[1] === tau && (' + (thr ? 'Math.abs(q[0] - value) <= eps && time - q[2] < .1' : 'q[0] === value') + ')) { window.__L14.skipped++; return; } window.__L14.sent++; __last.set(param, [value, tau, time]); param.setTargetAtTime(value, time, tau); }\n      function updateSteam() {';
    s = patchOnce(s, 'function updateSteam() {', helper, 'l14h');
    s = patchOnce(s, "steamLevel.gain.setTargetAtTime(stats.steamGain, ctx.currentTime, steam ? .06 : .018);\n        if (steamPan.pan) steamPan.pan.setTargetAtTime(steamSide, ctx.currentTime, .12);\n        steamFilter.frequency.setTargetAtTime(1950-steamOccluded*1250,ctx.currentTime,.12);",
      "__set(steamLevel.gain, stats.steamGain, ctx.currentTime, steam ? .06 : .018, .003);\n        if (steamPan.pan) __set(steamPan.pan, steamSide, ctx.currentTime, .12, .01);\n        __set(steamFilter.frequency, 1950-steamOccluded*1250, ctx.currentTime, .12, 19.5);", 'l14c');
    s = patchOnce(s, "m.gain.gain.setTargetAtTime(m.kind===machineKind?stats.machineryGain:0,ctx.currentTime,.055);\n          if(m.pan.pan)m.pan.pan.setTargetAtTime(machineSide,ctx.currentTime,.09);\n          m.filter.frequency.setTargetAtTime(4200-machineOccluded*3400,ctx.currentTime,.12);",
      "__set(m.gain.gain, m.kind===machineKind?stats.machineryGain:0, ctx.currentTime, .055, .003);\n          if(m.pan.pan)__set(m.pan.pan, machineSide, ctx.currentTime, .09, .01);\n          __set(m.filter.frequency, 4200-machineOccluded*3400, ctx.currentTime, .12, 42);", 'l14d');
    s = patchOnce(s, "airFilter.frequency.setTargetAtTime(780+stage*180+(environment.biome==='woodland'?-100:0),now,.4);", "__set(airFilter.frequency, 780+stage*180+(environment.biome==='woodland'?-100:0), now, .4, 7.8);", 'l14e');
    s = patchOnce(s, "airVolume.gain.setTargetAtTime(stats.windGain,now,stats.windGain?.22:.045);\n        echoSend.gain.setTargetAtTime(.065-outside*.055,now,.45);", "__set(airVolume.gain, stats.windGain, now, stats.windGain?.22:.045, .003);\n        __set(echoSend.gain, .065-outside*.055, now, .45, .003);", 'l14f');
  }
  return s;
}
// instrumentation commune : compte les automatisations AudioParam (toutes variantes)
function countParams(ctx, counter) {
  const P = AudioParam.prototype; if (P.__mixWrapped) { P.__mixCounter = counter; return; }
  P.__mixWrapped = true; P.__mixCounter = counter;
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) { const o = P[m]; P[m] = function () { P.__mixCounter.n++; return o.apply(this, arguments); }; }
}

// ---------- rendu d'une scène ----------
function sceneFrames(scene) { return scene.frames.length; }
async function render(scene, v, opt = {}) {
  RECIPE = v.recipe || 'cur';
  const N = sceneFrames(scene), seconds = (K0 + N) / HZ + TAIL, ctx = new OfflineAudioContext(12, Math.ceil(seconds * SR), SR);
  Object.defineProperty(ctx, 'state', {get: () => 'running'});
  const counter = {n: 0}; countParams(ctx, counter); window.__L14 = {sent: 0, skipped: 0};
  const saved = window.AudioContext; window.AudioContext = function () { return ctx; };
  const raw = !!v.source, sharedMusic = window.FMusic; window.__NODES = null; window.__duckShelf = null;
  if (raw) { // job=ab : FMusic puis FAudio de la source choisie, réévalués à chaque rendu, sans remplacement ; FMusic de SRC rétabli après le rendu
    const src = v.source === 'B' ? window.SRC_B : window.SRC; if (!src) throw new Error('source ' + v.source + ' absente de src.js (gen.mjs, 4e argument)');
    delete window.FMusic; (0, eval)(src.music); delete window.FAudio; (0, eval)(src.audio);
  } else { delete window.FAudio; (0, eval)(buildAudio(v)); }
  // Écran titre : le jeu ouvre le contexte coupé (audioGate) puis rétablit le son après setTitlePlaying(true).
  const audio = FAudio.create(); if (scene.title) audio.setMuted(true); audio.start(); window.AudioContext = saved;
  const nodes = raw ? null : window.__NODES, comp = COMP[v.comp || 'cur'], taps = !raw && !v.noTaps;
  if (nodes) for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) nodes.limiter[k].value = comp[k];

  if (nodes && v.oversample) nodes.guard.oversample = v.oversample;
  // prises : 2,3 sortie limiteur ; 4,5 entrée limiteur ; 6,7 musique après duck ; 8,9 effets + écho + ambiances ; 10 duck ; 11 étagère
  const merger = ctx.createChannelMerger(12); if (taps) merger.connect(ctx.destination);
  const tap = (list, ch) => { const up = ctx.createGain(); up.channelCount = 2; up.channelCountMode = 'explicit'; up.channelInterpretation = 'speakers'; const sp = ctx.createChannelSplitter(2); for (const n of list) n.connect(up); up.connect(sp); sp.connect(merger, 0, ch); sp.connect(merger, 1, ch + 1); };
  if (taps) { tap([nodes.limiter], 2); tap([nodes.master], 4); tap([nodes.musicOut], 6); tap([nodes.effects, nodes.damping, nodes.ambience], 8); }
  const one = ctx.createConstantSource(); one.offset.value = 1; if (taps) one.start();
  const mirror = (param, scale, ch, initial) => {
    const g = ctx.createGain(); g.gain.value = initial; one.connect(g); g.connect(merger, 0, ch);
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues']) { const o = param[m]; param[m] = function () { const a = Array.from(arguments); if (m !== 'cancelScheduledValues') a[0] = a[0] * scale; g.gain[m].apply(g.gain, a); AudioParam.prototype.__mixCounter.n--; return o.apply(param, arguments); }; }
    return g;
  };
  const keep = nodes ? [nodes.musicBus.gain, mirror(nodes.musicBus.gain, 1, 10, nodes.musicBus.gain.value)] : [];
  if (window.__duckShelf) keep.push(window.__duckShelf.gain, mirror(window.__duckShelf.gain, -1 / 60, 11, 0));
  audio.setMix({master: 1, music: opt.music === undefined ? .45 : opt.music, effects: 1, ambience: 1});
  let titlePrepared = null;
  if (scene.title) { // écran titre (game.js : prepareTitle, setTitlePlaying(true), audioGate, puis audio.tick à chaque image)
    if (typeof audio.setTitlePlaying !== 'function') throw new Error('scène ' + scene.name + ' : setTitlePlaying absent de cette source');
    if (typeof audio.prepareTitle === 'function') titlePrepared = await audio.prepareTitle();
    audio.setTitlePlaying(true); audio.setMuted(false);
  } else { audio.setStage(scene.stage); audio.setEnvironment(scene.env || {}, 0); audio.setMuted(false); audio.setPlaying(true); }
  const red = new Float32Array(K0 + N), voices = new Uint8Array(K0 + N), mvoices = new Uint8Array(K0 + N), biome = scene.env && scene.env.biome;
  let replayMs = 0;
  for (let k = 1; k < K0 + N; k++) {
    ctx.suspend(k / HZ).then(() => {
      const a = performance.now(), f = k - K0;
      if (f >= 0 && !opt.silent && !scene.title) {
        const fr = scene.frames[f];
        for (const [name, o] of fr.c) {
          let arg = o;
          if (name === 'bossTell' && v.tell === 'boss04' && o.distance !== undefined) { const fade = Math.max(0, 1 - o.distance / 90); arg = Object.assign({}, o, {level: fade * fade / (1 + o.distance * .018) * (o.occluded ? .34 : 1)}); }
          audio[name](Object.assign({}, arg));
        }
        const s = fr.s; audio.setEnvironment(scene.env || {}, s[0]); audio.setMachinery(s[1], s[2], s[3], s[4]); audio.setSteam(s[5], s[6], s[7]); audio.setThreat(s[8]); audio.setPressure(s[9]); audio.tick(1 / HZ);
        if (fr.f) audio.step(fr.f[0], {outdoor: !!fr.f[1], biome});
      } else audio.tick(1 / HZ);
      red[k] = nodes ? nodes.limiter.reduction : 0; voices[k] = audio.stats.voices; mvoices[k] = 0;
      replayMs += performance.now() - a; ctx.resume();
    });
  }
  const t0 = performance.now(), buffer = await ctx.startRendering(), ms = performance.now() - t0;
  const stats = Object.assign({}, audio.stats), l14 = Object.assign({}, window.__L14);
  try { audio.dispose(); } catch (_) {}
  if (raw) window.FMusic = sharedMusic;
  return {buffer, ms, replayMs, stats, red, voices, seconds, params: counter.n, l14, titlePrepared};
}
// différence échantillon par échantillon de la sortie (canaux 0 et 1), en dBFS ; premier écart non nul et au-delà de −90 dBFS
function diffOut(x, y) {
  let pk = 0, e = 0, n = 0, first = -1, firstLoud = -1; const loud = Math.pow(10, -90 / 20);
  if (x.length !== y.length) throw new Error('longueurs différentes : ' + x.length + ' / ' + y.length);
  for (const c of [0, 1]) { const a = x.getChannelData(c), b = y.getChannelData(c); for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > 0 && (first < 0 || i < first)) first = i; if (d > loud && (firstLoud < 0 || i < firstLoud)) firstLoud = i; if (d > pk) pk = d; e += d * d; n++; } }
  return {peakDbFS: pk ? r2(dB(pk)) : null, rmsDbFS: e ? r2(dB(Math.sqrt(e / n))) : null, identical: pk === 0, firstDiffSec: first < 0 ? null : r3(first / x.sampleRate), firstOver90Sec: firstLoud < 0 ? null : r3(firstLoud / x.sampleRate)};
}
function outLevels(b) { const L = b.getChannelData(0), R = b.getChannelData(1); return {peak: r3(Math.max(peakRange(L, 0, L.length), peakRange(R, 0, R.length))), rmsDbFS: r2(dB(Math.hypot(rmsRange(L, 0, L.length), rmsRange(R, 0, R.length)) / Math.SQRT2))}; }

// ---------- analyse ----------
function rmsRange(d, a, b) { a = Math.max(0, a | 0); b = Math.min(d.length, b | 0); let e = 0; for (let i = a; i < b; i++) e += d[i] * d[i]; return Math.sqrt(e / Math.max(1, b - a)); }
function peakRange(d, a, b) { a = Math.max(0, a | 0); b = Math.min(d.length, b | 0); let m = 0; for (let i = a; i < b; i++) { const x = d[i] < 0 ? -d[i] : d[i]; if (x > m) m = x; } return m; }
function lowpass(d, hz, sr) { // Butterworth 4e ordre (deux biquads), pour l'énergie sous hz
  const out = new Float32Array(d.length); let src = d;
  for (const q of [.5412, 1.3066]) { const w = 2 * Math.PI * hz / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al, b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = -2 * c / a0, a2 = (1 - al) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < src.length; i++) { const x = src[i], y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y; } src = out; }
  return out;
}
const quant = (a, p) => { if (!a.length) return null; const s = Array.from(a).sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
function analyse(R, scene, calib) {
  const b = R.buffer, ch = i => b.getChannelData(i), n = b.length, sr = SR, from = Math.round(K0 / HZ * sr), to = n;
  const D = calib.delay, mk = calib.makeupDb, out = {};
  const O = [ch(0), ch(1)], L = [ch(2), ch(3)], M = [ch(4), ch(5)], MU = [ch(6), ch(7)], FX = [ch(8), ch(9)], DK = ch(10), SH = ch(11);
  out.peakOut = r3(Math.max(peakRange(O[0], from, to), peakRange(O[1], from, to)));
  out.peakPreGuard = r3(Math.max(peakRange(L[0], from, to), peakRange(L[1], from, to)));
  let above = 0, episodes = 0, inside = false; for (let i = from; i < to; i++) { const hot = Math.abs(L[0][i]) > .875 || Math.abs(L[1][i]) > .875; if (hot) { above++; if (!inside) episodes++; } inside = hot; }
  out.aboveKnee = above; out.aboveKneePct = +(above / (to - from) * 100).toFixed(4); out.clipEpisodes = episodes;
  out.rmsOutDb = r2(dB(Math.hypot(rmsRange(O[0], from, to), rmsRange(O[1], from, to)) / Math.SQRT2));
  // réduction de gain : rapport sortie/entrée du limiteur par fenêtres de 256 échantillons, retard D compensé, gain de rattrapage retiré
  const W = 256, gr = [], tot = []; let grMin = 0, grSum = 0, grN = 0, over3 = 0, over6 = 0;
  for (let i = from; i + W < to; i += W) {
    const a = Math.hypot(rmsRange(M[0], i - D, i - D + W), rmsRange(M[1], i - D, i - D + W)), o = Math.hypot(rmsRange(L[0], i, i + W), rmsRange(L[1], i, i + W));
    const g = a > 2e-4 ? dB(o / a) - mk : NaN; gr.push(g);
    if (g === g) { grMin = Math.min(grMin, g); grSum += g; grN++; if (g < -3) over3++; if (g < -6) over6++; }
    tot.push((g === g ? g : 0) + dB(DK[Math.min(n - 1, i + (W >> 1))] / (calib.musicGain || .56)));
  }
  out.gr = {minDb: r2(grMin), meanDb: r2(grSum / Math.max(1, grN)), pctBelow3: r2(over3 / Math.max(1, grN) * 100), pctBelow6: r2(over6 / Math.max(1, grN) * 100)};
  let redMin = 0; for (let k = K0; k < R.red.length; k++) redMin = Math.min(redMin, R.red[k]); out.gr.reductionAttrMinDb = r2(redMin);
  // duck
  let duckMin = 1, shelfMin = 0; for (let i = from; i < to; i += 16) { duckMin = Math.min(duckMin, DK[i] / (calib.musicGain || .56)); shelfMin = Math.min(shelfMin, -SH[i] * 60); }
  out.duckDepth = {minDb: r2(dB(duckMin)), shelfMinDb: r2(shelfMin)};
  // tirs du joueur : transitoire (effets, avant maître) contre musique (après duck)
  const fxm = new Float32Array(n), mum = new Float32Array(n); for (let i = 0; i < n; i++) { fxm[i] = (FX[0][i] + FX[1][i]) * .5; mum[i] = (MU[0][i] + MU[1][i]) * .5; }
  const shots = []; scene.frames.forEach((fr, f) => { for (const [name, o] of fr.c) if (name === 'shot' || name === 'fracture' || name === 'rocket') shots.push([f, name === 'shot' ? (o.weapon === 4 ? 'pistol' : 'smg') : name === 'fracture' ? 'shotgun' : 'rocket']); });
  const margins = {}, grShot = {}, w5 = Math.round(.005 * sr);
  for (const [f, w] of shots) {
    const t = Math.ceil((K0 + f) / HZ * sr / 128) * 128; let best = 0; for (let i = t; i < t + .03 * sr; i += w5 >> 1) best = Math.max(best, rmsRange(fxm, i, i + w5));
    const mus = rmsRange(mum, t - .2 * sr, t + .2 * sr); if (mus > 1e-5) (margins[w] ||= []).push(dB(best / mus));
    let g = 0; for (let i = Math.floor((t + D - from) / W); i < Math.floor((t + D + .06 * sr - from) / W) && i < gr.length; i++) if (gr[i] === gr[i]) g = Math.min(g, gr[i]); (grShot[w] ||= []).push(g);
  }
  out.shots = {}; for (const w in grShot) out.shots[w] = {n: grShot[w].length, transientOverMusicDb: margins[w] ? {p10: r2(quant(margins[w], .1)), p50: r2(quant(margins[w], .5))} : null, grDb: {p50: r2(quant(grShot[w], .5)), p10: r2(quant(grShot[w], .1))}};
  // niveau à court terme (400 ms, pas de 100 ms) : effets contre musique, quand les effets sont actifs
  const w400 = Math.round(.4 * sr), hop = Math.round(.1 * sr), ratios = []; let fxE = 0, muE = 0;
  for (let i = from; i + w400 < to; i += hop) { const a = rmsRange(fxm, i, i + w400), m = rmsRange(mum, i, i + w400); if (a > .003 && m > 1e-5) ratios.push(dB(a / m)); }
  out.shortTerm = {fxOverMusicDb: {p10: r2(quant(ratios, .1)), p50: r2(quant(ratios, .5)), p90: r2(quant(ratios, .9))}, activeWindows: ratios.length};
  out.levels = {fxRmsDb: r2(dB(rmsRange(fxm, from, to))), musicRmsDb: r2(dB(rmsRange(mum, from, to)))};
  // énergie sous 120 Hz
  const fxl = lowpass(fxm, 120, sr), mul = lowpass(mum, 120, sr), eF = rmsRange(fxl, from, to), eM = rmsRange(mul, from, to);
  out.low120 = {fxDb: r2(dB(eF)), musicDb: r2(dB(eM)), fxMinusMusicDb: r2(dB(eF / eM)), fxLowSharePct: r2(100 * eF * eF / Math.max(1e-12, rmsRange(fxm, from, to) ** 2)), musicLowSharePct: r2(100 * eM * eM / Math.max(1e-12, rmsRange(mum, from, to) ** 2))};
  // pompage de la musique pendant les rafales : gain total appliqué à la musique = duck + réduction du limiteur
  if (scene.bursts) {
    const drops = [], ripples = [], shelfDrops = [];
    for (const [a, z] of scene.bursts) { if (z === undefined) continue; const i0 = Math.floor((K0 + a) / HZ * sr - from) / W | 0, i1 = Math.floor((K0 + z) / HZ * sr - from) / W | 0, pre = tot.slice(Math.max(0, i0 - 60), i0), seg = tot.slice(i0, i1), late = tot.slice(i0 + Math.round(.35 * sr / W), i1);
      if (!seg.length || !late.length) continue; const base = pre.length ? quant(pre, .5) : 0; drops.push(base - Math.min(...seg)); ripples.push(Math.max(...late) - Math.min(...late));
      let sm = 0; for (let i = Math.round((K0 + a) / HZ * sr); i < Math.round((K0 + z) / HZ * sr); i += 16) sm = Math.min(sm, -SH[i] * 60); shelfDrops.push(-sm); }
    out.pump = {perBurst: drops.map((d, i) => [r2(d), r2(ripples[i])]), bursts: drops.length, dropDb: {p50: r2(quant(drops, .5)), max: r2(Math.max(...drops))}, rippleDb: {p50: r2(quant(ripples, .5)), max: r2(Math.max(...ripples))}, shelfDropDb: r2(Math.max(...shelfDrops))};
  }
  let vmax = 0, vsum = 0; for (let k = K0; k < R.voices.length; k++) { vmax = Math.max(vmax, R.voices[k]); vsum += R.voices[k]; }
  out.voices = {peakVoices: R.stats.peakVoices, stolenVoices: R.stats.stolenVoices, fxSkipped: R.stats.fxSkipped, meanPerFrame: r2(vsum / (R.voices.length - K0)), maxAtFrame: vmax};
  out.render = {ms: Math.round(R.ms), msPerAudioSecond: r2(R.ms / R.seconds), replayMs: Math.round(R.replayMs), audioParamCalls: R.params};
  return out;
}

// ---------- étalonnage du compresseur : gain de rattrapage et retard ----------
async function calibrate(name) {
  const c = COMP[name], ctx = new OfflineAudioContext(2, SR * 2, SR), comp = ctx.createDynamicsCompressor();
  for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) comp[k].value = c[k];
  const osc = ctx.createOscillator(); osc.frequency.value = 1000; const g = ctx.createGain(); g.gain.value = .001; osc.connect(g); g.connect(comp);
  const imp = ctx.createBuffer(1, SR * 2, SR); imp.getChannelData(0)[SR * 1.5] = .0005; const is = ctx.createBufferSource(); is.buffer = imp; const m = ctx.createChannelMerger(2); comp.connect(m, 0, 0);
  const comp2 = ctx.createDynamicsCompressor(); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) comp2[k].value = c[k]; is.connect(comp2); comp2.connect(m, 0, 1); m.connect(ctx.destination);
  osc.start(); is.start(); const b = await ctx.startRendering(), d0 = b.getChannelData(0), d1 = b.getChannelData(1);
  const makeup = rmsRange(d0, SR, SR * 1.4) / (.001 / Math.SQRT2); let at = 0, pk = 0; for (let i = SR; i < d1.length; i++) if (Math.abs(d1[i]) > pk) { pk = Math.abs(d1[i]); at = i; }
  return {name, ...c, makeupDb: r2(dB(makeup)), delay: at - SR * 1.5, delayMs: r2((at - SR * 1.5) / SR * 1000)};
}
const CAL = {};
async function calib(name) { return CAL[name] || (CAL[name] = await calibrate(name)); }

// ---------- scènes synthétiques ----------
function emptyFrames(n) { return Array.from({length: n}, () => ({c: [], s: [0, 0, 0, 'lift', 0, 0, 0, 0, 0, 0], f: null})); }
function isoScene() { // un tir isolé toutes les 2 s : SMG, pistolet, pompe, roquette, explosion
  const frames = emptyFrames(12 * HZ), cues = [['shot', {level: 1, pan: 0, hand: 'right', weapon: 0, seed: 1}], ['shot', {level: 1, pan: 0, hand: 'right', weapon: 4, seed: 1}], ['fracture', {level: 1, pan: 0, hand: 'right', seed: 1}], ['rocket', {level: 1, pan: 0, hand: 'right', owner: 'player', seed: 1}], ['explosion', {level: 1, pan: 0, radius: 3.5, power: 32, seed: 1}], ['grenadeLaunch', {level: 1, pan: 0, hand: 'right', seed: 1}]];
  cues.forEach((c, i) => frames[i * 2 * HZ + 30].c.push(c));
  return {name: 'iso', label: 'Tirs isolés', stage: 0, env: {}, frames, cues: cues.map((c, i) => [i * 2 * HZ + 30, c[0] + (c[1].weapon === 4 ? ':pistol' : '')])};
}
function pumpScene() { // cadences nominales, sans surchauffe : SMG 8/s pendant 3 s, pistolet 0,32 s, pompe 1 s, roquette 1,2 s
  const frames = emptyFrames(24 * HZ), bursts = []; let seed = 1;
  const run = (t0, t1, gap, cue) => { const a = Math.round(t0 * HZ); let last = a; for (let t = t0; t < t1 - 1e-6; t += gap) { last = Math.round(t * HZ); frames[last].c.push([cue[0], Object.assign({seed: seed++}, cue[1])]); } bursts.push([a, last + Math.round(gap * HZ)]); };
  run(1, 4, .125, ['shot', {level: 1, pan: 0, hand: 'right', weapon: 0}]); run(6, 9, .32, ['shot', {level: 1, pan: 0, hand: 'right', weapon: 4}]);
  run(11, 15, 1, ['fracture', {level: 1, pan: 0, hand: 'right'}]); run(17, 22, 1.2, ['rocket', {level: 1, pan: 0, hand: 'right', owner: 'player'}]);
  return {name: 'p', label: 'Cadences nominales (SMG 8/s, pistolet, pompe, roquette) sur « Fer noir »', stage: 0, env: {}, frames, bursts};
}
function titleScene() { // écran titre : musique d'accueil thrash de la 0.8.1 (setTitlePlaying(true)) pendant 30 s, aucun événement
  return {name: 't', label: 'Écran titre : musique d\'accueil (setTitlePlaying) pendant 30 s', stage: 0, env: {}, frames: emptyFrames(30 * HZ), title: true};
}
window.MIX = {render, analyse, calib, isoScene, pumpScene, titleScene, diffOut, outLevels, COMP, DUCK, emit, rmsRange, peakRange, lowpass, quant, dB, r2, r3, SR, K0, HZ, buildAudio};
