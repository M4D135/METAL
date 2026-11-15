/* FERRO — chef d'orchestre du jeu : traduit l'état de la simulation en
   demandes musicales. Aucune horloge, aucun aléa : l'hôte avance le temps. */
(function (G) {
  'use strict';
  const DEFAULTS = {
    dwell: 6, quietAfter: 25,
    combat: {enter: .5, exit: .18, pressure: .62},
    boss: {enter: .25, exit: .12},
    resume: {threat: .3, pressure: .5}
  };
  const URGENT = {victory: true, boss: true, combat: true};

  function create(options) {
    const opts = options || {}, host = opts.host || {};
    const t = Object.assign({}, DEFAULTS, opts);
    t.combat = Object.assign({}, DEFAULTS.combat, opts.combat);
    t.boss = Object.assign({}, DEFAULTS.boss, opts.boss);
    t.resume = Object.assign({}, DEFAULTS.resume, opts.resume);
    const request = typeof host.request === 'function' ? host.request : function () { return false; };
    const release = typeof host.release === 'function' ? host.release : function () { return false; };
    let cue = '', clock = 0, since = 0, quiet = 0, seq = 0, changes = 0, blocked = 0;

    function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
    function pressureOf(state) { const d = state && state.director; return number(d && d.pressure); }

    // The only rule table. It reads a snapshot and answers with the piece that
    // should be playing; hysteresis lives in the thresholds, not in the host.
    function decide(state) {
      const s = state || {}, threat = number(s.threat), pressure = pressureOf(s);
      if (s.won) return 'victory';
      if (s.dead) return '';
      if (s.bossAlive && threat >= t.boss.enter) return 'boss';
      if (threat >= t.combat.enter || pressure >= t.combat.pressure) return 'combat';
      if (cue === 'combat' || cue === 'boss') {
        const floor = cue === 'boss' ? t.boss.exit : t.combat.exit;
        return threat <= floor && pressure < t.combat.pressure * .6 && quiet >= t.quietAfter ? 'calm' : cue;
      }
      if (cue === 'calm') return threat >= t.resume.threat || pressure >= t.resume.pressure ? '' : cue;
      return '';
    }

    // A change is refused while the previous piece has not had its dwell time,
    // so an alert level oscillating around a threshold cannot flip-flop the
    // soundtrack. An empty cue (the sector theme) never holds combat back.
    function update(state, dt) {
      const step = Math.max(0, number(dt));
      clock += step;
      const threat = number(state && state.threat), pressure = pressureOf(state);
      quiet = threat > t.combat.exit || pressure >= t.combat.pressure * .6 ? 0 : quiet + step;
      // Death is never held back by the dwell time: the piece of the fight has
      // no reason to keep playing over the result screen.
      if (state && state.dead && cue !== '') {cue = ''; since = clock; changes++; release(); return true;}
      const wanted = decide(state);
      if (wanted === cue) return false;
      if (cue !== '' && wanted !== 'victory' && wanted !== 'boss' && clock - since < t.dwell) {blocked++; return false;}
      const previous = cue;
      cue = wanted; since = clock; changes++;
      if (wanted === '') {release(); return true;}
      request(wanted, {key: wanted + '-' + (++seq), urgent: !!URGENT[wanted], from: previous});
      return true;
    }

    return {
      update,
      // The win is announced by an event, not by a frame the shell still owns.
      victory() {
        if (cue === 'victory') return false;
        cue = 'victory'; since = clock; changes++;
        request('victory', {key: 'victory-' + (++seq), urgent: true});
        return true;
      },
      reset() {cue = ''; since = clock; quiet = 0; return true;},
      cue() {return cue;},
      state() {return {cue: cue, clock: clock, since: since, quiet: quiet, changes: changes, blocked: blocked};}
    };
  }

  G.FMusicDirector = {create};
})(typeof window !== 'undefined' ? window : globalThis);
