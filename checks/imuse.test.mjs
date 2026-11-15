import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source = fs.readFileSync(new URL('../src/imuse.js', import.meta.url), 'utf8');
const scope = Object.create(null);
vm.runInNewContext(source, scope);
const Imuse = scope.FImuse;

const LAYERS = {drums: 0, bass: 0, rhythm: .2, lead: .55, announce: .8};
function cues(extra = {}) {
  const seg = (bars, layers) => ({bars, layers});
  return Object.assign({
    calm: {bpm: 76, layerMin: {...LAYERS}, entry: 'pad', order: ['pad', 'padB'],
      segments: {pad: seg(4, ['bass', 'rhythm', 'lead', 'announce']), padB: seg(4, ['bass', 'rhythm', 'lead', 'announce']), fill: seg(1, ['drums']), roll: seg(2, ['drums', 'announce'])},
      transitions: [{from: '*', to: '*', kind: 'fill', segment: 'fill', bars: 1}]},
    combat: {bpm: 208, layerMin: {...LAYERS}, entry: 'riff', order: ['riff', 'riffB', 'riffC'],
      segments: {riff: seg(4, ['drums', 'bass', 'rhythm', 'lead']), riffB: seg(4, ['drums', 'bass', 'rhythm']),
        riffC: seg(2, ['drums', 'bass', 'rhythm', 'lead', 'announce']), fill: seg(1, ['drums']), roll: seg(2, ['drums', 'announce'])},
      transitions: [{from: '*', to: 'boss', kind: 'roll', segment: 'roll', bars: 2}, {from: '*', to: '*', kind: 'fill', segment: 'fill', bars: 1}]},
    boss: {bpm: 150, layerMin: {...LAYERS}, entry: 'theme', order: ['theme', 'themeB'],
      segments: {theme: seg(4, ['drums', 'bass', 'rhythm', 'lead', 'announce']), themeB: seg(4, ['drums', 'bass', 'rhythm']),
        fill: seg(1, ['drums']), roll: seg(2, ['drums', 'announce'])},
      transitions: [{from: '*', to: '*', kind: 'fill', segment: 'fill', bars: 1}]}
  }, extra);
}
function director(options = {}) { return Imuse.create(Object.assign({cues: cues(), cue: 'calm'}, options)); }
function play(d, bars) { const out = []; for (let i = 0; i < bars; i++) out.push(d.nextBar()); return out; }

test('the director is a deterministic function of requests and bar calls', () => {
  const script = d => { d.setIntensity(.6); play(d, 9); d.request('combat', {key: 'spawn'}); play(d, 12); d.setIntensity(.9); play(d, 7); d.request('boss', {key: 'colossus', urgent: true}); return play(d, 10); };
  const a = JSON.stringify(script(director())), b = JSON.stringify(script(director()));
  assert.equal(a, b);
  assert.equal(createHash('sha256').update(a).digest('hex'), createHash('sha256').update(b).digest('hex'));
});

test('the brick uses no clock, no randomness, no timer and no host content', () => {
  for (const forbidden of ['Math.random', 'Date.now', 'new Date', 'setTimeout', 'setInterval', 'performance.', 'requestAnimationFrame', 'AudioContext', 'window.FMusic', 'METAL']) {
    assert.ok(!source.includes(forbidden), 'forbidden in a generic brick: ' + forbidden);
  }
});

test('vertical layers follow the intensity and only move on a bar boundary', () => {
  const d = director();
  d.setIntensity(.25);
  let bars = play(d, 8);
  assert.ok(bars.every(b => b.layers.includes('bass') && b.layers.includes('rhythm')));
  assert.ok(bars.every(b => !b.layers.includes('lead') && !b.layers.includes('announce')));
  d.setIntensity(.9);
  bars = play(d, 4);
  assert.ok(bars.every(b => b.layers.includes('lead') && b.layers.includes('rhythm')));
  assert.ok(bars.every(b => b.layers.includes('announce')));
  // A layer never appears inside a bar already handed out: the change is read
  // at the next call, which is the next bar.
  const e = director(); e.setIntensity(.25);
  const given = e.nextBar();
  e.setIntensity(.9);
  assert.ok(!given.layers.includes('lead'), 'a bar already given is never rewritten');
  assert.ok(e.nextBar().layers.includes('lead'), 'the following bar carries the new layer');
  assert.ok(!given.layers.includes('lead'), 'still untouched after the fact');
});

test('a requested cue finishes its segment, plays the written join, then enters the target', () => {
  const d = director();
  d.setIntensity(.6);
  play(d, 2);                                   // two bars of the 4-bar 'pad'
  assert.equal(d.request('combat', {key: 'spawn'}), true);
  const bars = play(d, 8);
  assert.deepEqual(bars.slice(0, 2).map(b => [b.cue, b.segment, b.bar]), [['calm', 'pad', 2], ['calm', 'pad', 3]], 'the current segment is finished first');
  assert.deepEqual(bars.slice(2, 3).map(b => [b.cue, b.segment, b.transition]), [['calm', 'fill', 'fill']], 'one written join bar');
  assert.deepEqual(bars.slice(3).map(b => [b.cue, b.segment, b.bar]), [['combat', 'riff', 0], ['combat', 'riff', 1], ['combat', 'riff', 2], ['combat', 'riff', 3], ['combat', 'riffB', 0]]);
  assert.equal(d.stats.transitions, 1);
  assert.equal(d.stats.switches, 1);
});

test('an urgent request still finishes the bar in progress, never cuts it', () => {
  const d = director();
  d.setIntensity(.6);
  play(d, 1);
  d.request('boss', {key: 'colossus', urgent: true});
  const bars = play(d, 4);
  assert.deepEqual(bars.map(b => [b.cue, b.segment, b.bar]), [['calm', 'pad', 1], ['calm', 'fill', 0], ['boss', 'theme', 0], ['boss', 'theme', 1]]);
});

test('a multi-bar join keeps its written length and is not cut short', () => {
  const d = director({cue: 'combat'});
  d.setIntensity(.9);
  play(d, 4);
  d.request('boss', {key: 'colossus'});
  const bars = play(d, 8);
  assert.deepEqual(bars.slice(0, 4).map(b => [b.cue, b.segment, b.bar]), [['combat', 'riffB', 0], ['combat', 'riffB', 1], ['combat', 'riffB', 2], ['combat', 'riffB', 3]], 'the segment started before the request is played to its end');
  assert.deepEqual(bars.slice(4, 6).map(b => [b.cue, b.segment, b.transition, b.bar]), [['combat', 'roll', 'roll', 0], ['combat', 'roll', 'roll', 1]], 'the two-bar roll is played whole');
  assert.deepEqual(bars.slice(6).map(b => [b.cue, b.segment, b.bar]), [['boss', 'theme', 0], ['boss', 'theme', 1]]);
});

test('the same event never restarts the music from bar zero', () => {
  const d = director();
  d.setIntensity(.6);
  d.request('combat', {key: 'spawn'});
  play(d, 7);
  const seen = d.state();
  for (let i = 0; i < 40; i++) assert.equal(d.request('combat', {key: 'spawn'}), false, 'a repeated arrival changes nothing');
  const after = d.state();
  assert.equal(after.cue, seen.cue); assert.equal(after.segment, seen.segment); assert.equal(after.bar, seen.bar);
  assert.equal(d.stats.switches, 1, 'exactly one entry happened');
  assert.equal(d.stats.barIndex, seen.barIndex);
});

test('a request already queued is not queued twice and a newer request still wins', () => {
  const d = director();
  d.setIntensity(.6);
  assert.equal(d.request('combat', {key: 'spawn'}), true);
  assert.equal(d.request('combat', {key: 'spawn'}), false);
  assert.equal(d.state().pending, 'combat');
  assert.equal(d.request('boss', {key: 'colossus', urgent: true}), true);
  const bars = play(d, 3);
  assert.deepEqual(bars.map(b => [b.cue, b.segment, b.transition]), [['calm', 'pad', null], ['calm', 'fill', 'fill'], ['boss', 'theme', null]], 'the later request replaces the queued one');
});

test('a request made during a join is honoured at the end of that join', () => {
  const d = director({cue: 'combat'});
  d.setIntensity(.9);
  play(d, 4);
  d.request('boss', {key: 'colossus'});
  play(d, 5);                                   // segment end + first roll bar
  assert.equal(d.request('calm', {key: 'quiet'}), true);
  const bars = play(d, 3);
  assert.deepEqual(bars.map(b => [b.cue, b.segment]), [['combat', 'roll'], ['calm', 'pad'], ['calm', 'pad']], 'the newer target replaces the join target');
});

test('without a written join the change still waits for the segment end', () => {
  const bare = Imuse.create({cue: 'a', cues: {a: {bpm: 100, layerMin: {drums: 0}, entry: 'x', order: ['x', 'y'], segments: {x: {bars: 4, layers: ['drums']}, y: {bars: 4, layers: ['drums']}}}, b: {bpm: 120, layerMin: {drums: 0}, entry: 'z', order: ['z'], segments: {z: {bars: 4, layers: ['drums']}}}}});
  const bars = [];
  bare.nextBar(); bare.nextBar();
  assert.equal(bare.request('b'), true);
  for (let i = 0; i < 4; i++) bars.push(bare.nextBar());
  assert.deepEqual(bars.map(b => [b.cue, b.segment, b.bar]), [['a', 'x', 2], ['a', 'x', 3], ['b', 'z', 0], ['b', 'z', 1]]);
});

test('segments walk the declared order and loop without a gap', () => {
  const d = director({cue: 'combat'});
  d.setIntensity(.9);
  const bars = play(d, 10);
  assert.deepEqual(bars.map(b => b.segment), ['riff', 'riff', 'riff', 'riff', 'riffB', 'riffB', 'riffB', 'riffB', 'riffC', 'riffC']);
  assert.equal(bars[0].tempo, 208);
});

test('intensity is quantized so a noisy signal cannot flap a layer every frame', () => {
  const d = director({intensityStep: .1});
  d.setIntensity(.549);
  assert.equal(d.state().intensity, .5);
  assert.ok(!d.nextBar().layers.includes('lead'));
  d.setIntensity(.551);
  assert.equal(d.state().intensity, .5, 'below the next quantum nothing moves');
  d.setIntensity(.6);
  assert.ok(d.nextBar().layers.includes('lead'));
  let changes = 0;
  for (let i = 0; i < 60; i++) if (d.setIntensity(.601 + (i % 3) * .001)) changes++;
  assert.equal(changes, 0);
});

test('descriptors are validated before anything can run', () => {
  assert.equal(Imuse.validate(cues()).length, 0);
  assert.match(Imuse.validate({bad: {segments: {x: {bars: 4, layers: ['nope']}}}}).join(' '), /undeclared layer nope/);
  assert.match(Imuse.validate({bad: {order: ['missing'], segments: {}}}).join(' '), /unknown segment missing/);
  assert.match(Imuse.validate({bad: {order: [], segments: {}}}).join(' '), /order missing/);
  assert.match(Imuse.validate({bad: {order: ['x'], segments: {x: {bars: 0}}}}).join(' '), /segment without bars/);
  assert.match(Imuse.validate({bad: {order: ['x'], segments: {x: {bars: 1}}, transitions: [{segment: 'ghost', bars: 1}]}}).join(' '), /unknown transition segment ghost/);
  assert.throws(() => Imuse.create({cues: {bad: {order: ['x'], segments: {x: {bars: 1, layers: ['ghost']}}}}}), /FImuse:/);
});

test('an unknown cue is refused and counted, and reset puts the transport back', () => {
  const d = director();
  assert.equal(d.request('nowhere'), false);
  assert.equal(d.stats.ignored, 1);
  play(d, 5);
  d.request('boss', {key: 'k'});
  play(d, 4);
  d.reset('calm');
  assert.equal(d.state().cue, 'calm');
  assert.equal(d.state().barIndex, 0);
  assert.equal(d.state().pending, '');
  assert.equal(d.nextBar().bar, 0);
  assert.equal(d.request('calm'), false, 'a reset cue is not restarted by its own event');
});

test('stats expose the transport for the frame-budget bench', () => {
  const d = director();
  d.setIntensity(.8);
  play(d, 6);
  d.request('combat', {key: 'spawn'});
  play(d, 6);
  const s = d.stats;
  assert.equal(s.barIndex, 12);
  assert.equal(s.switches, 1);
  assert.equal(s.transitions, 1);
  assert.ok(s.layerChanges >= 1);
  assert.deepEqual(Object.keys(s).sort(), ['barIndex', 'ignored', 'layerChanges', 'pending', 'switches', 'transition', 'transitions']);
});
