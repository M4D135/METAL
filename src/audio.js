/* FERRO: original procedural audio. No recordings, samples or external assets. */
(function () {
  'use strict';
  window.FAudio = {
    create: function () {
      var ctx = null, master, effects, ambience, droneLevel, airFilter, noiseBuffer;
      var muted = false, disposed = false, failed = false, threat = 0, stage = 0;
      var beatTime = 0, beat = 0, lastStep = -1, stepSide = 1, lastShot = -1;
      var persistent = [], voices = new Set(), noiseSeed = 0x96f3;
      function remember(node) { persistent.push(node); return node; }
      function random() {
        noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) | 0;
        return (noiseSeed >>> 0) / 4294967296;
      }
      function clean(entry) {
        entry.nodes.forEach(function (n) { try { n.disconnect(); } catch (_) {} });
        voices.delete(entry);
      }
      function track(source, nodes) {
        var entry = { source: source, nodes: nodes };
        voices.add(entry);
        source.onended = function () { clean(entry); };
      }
      function available() {
        return ctx && !disposed && !muted && ctx.state === 'running' && voices.size < 48;
      }
      function panNode(value) {
        if (ctx.createStereoPanner) {
          var p = ctx.createStereoPanner();
          p.pan.value = value || 0;
          return p;
        }
        return ctx.createGain();
      }
      function tone(frequency, end, duration, level, shape, offset, pan, cutoff, bus) {
        if (!available()) return;
        var t = ctx.currentTime + (offset || 0), o = ctx.createOscillator();
        var g = ctx.createGain(), p = panNode(pan), nodes = [o, g, p];
        o.type = shape || 'sine';
        o.frequency.setValueAtTime(Math.max(1, frequency), t);
        if (end) o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + Math.min(.008, duration / 5));
        g.gain.exponentialRampToValueAtTime(.0001, t + duration);
        if (cutoff) {
          var f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = .65;
          o.connect(f); f.connect(g); nodes.push(f);
        } else o.connect(g);
        g.connect(p); p.connect(bus || effects);
        track(o, nodes);
        o.start(t); o.stop(t + duration + .03);
      }
      function noise(duration, level, frequency, pan, offset, type, bus) {
        if (!available()) return;
        var t = ctx.currentTime + (offset || 0), s = ctx.createBufferSource();
        var f = ctx.createBiquadFilter(), g = ctx.createGain(), p = panNode(pan);
        s.buffer = noiseBuffer;
        f.type = type || 'bandpass'; f.frequency.value = frequency; f.Q.value = .7;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + .004);
        g.gain.exponentialRampToValueAtTime(.0001, t + duration);
        s.connect(f); f.connect(g); g.connect(p); p.connect(bus || effects);
        track(s, [s, f, g, p]);
        s.start(t, random() * .7); s.stop(t + duration + .02);
      }
      function initialize() {
        if (ctx || disposed || failed) return;
        var Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) { failed = true; return; }
        try {
          ctx = new Audio();
          master = remember(ctx.createGain());
          master.gain.value = muted ? 0 : .65;
          var limiter = remember(ctx.createDynamicsCompressor());
          limiter.threshold.value = -19; limiter.knee.value = 18;
          limiter.ratio.value = 5; limiter.attack.value = .004; limiter.release.value = .18;
          master.connect(limiter); limiter.connect(ctx.destination);
          effects = remember(ctx.createGain()); effects.gain.value = .8; effects.connect(master);
          ambience = remember(ctx.createGain()); ambience.gain.value = .6; ambience.connect(master);

          // A small filtered echo gives the metal chambers a sense of space.
          var send = remember(ctx.createGain()), delay = remember(ctx.createDelay(.5));
          var damping = remember(ctx.createBiquadFilter()), feedback = remember(ctx.createGain());
          send.gain.value = .11; delay.delayTime.value = .183;
          damping.type = 'lowpass'; damping.frequency.value = 1700; feedback.gain.value = .23;
          effects.connect(send); send.connect(delay); delay.connect(damping);
          damping.connect(master); damping.connect(feedback); feedback.connect(delay);

          noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
          var data = noiseBuffer.getChannelData(0), smooth = 0;
          for (var i = 0; i < data.length; i++) {
            var white = random() * 2 - 1;
            smooth = smooth * .96 + white * .04;
            data[i] = white * .64 + smooth * .55;
          }
          var air = remember(ctx.createBufferSource()), airVolume = remember(ctx.createGain());
          airFilter = remember(ctx.createBiquadFilter());
          air.buffer = noiseBuffer; air.loop = true;
          airFilter.type = 'lowpass'; airFilter.frequency.value = 380;
          airVolume.gain.value = .022;
          air.connect(airFilter); airFilter.connect(airVolume); airVolume.connect(ambience); air.start();

          droneLevel = remember(ctx.createGain()); droneLevel.gain.value = .012;
          droneLevel.connect(ambience);
          [55, 82.4069, 110.12].forEach(function (frequency, index) {
            var oscillator = remember(ctx.createOscillator()), level = remember(ctx.createGain());
            oscillator.type = index === 1 ? 'triangle' : 'sine';
            oscillator.frequency.value = frequency; level.gain.value = index === 2 ? .24 : .5;
            oscillator.connect(level); level.connect(droneLevel); oscillator.start();
          });
          var sway = remember(ctx.createOscillator()), swayDepth = remember(ctx.createGain());
          sway.frequency.value = .087; swayDepth.gain.value = .004;
          sway.connect(swayDepth); swayDepth.connect(droneLevel.gain); sway.start();
          beatTime = ctx.currentTime + .25;
        } catch (_) {
          failed = true;
          if (ctx) { try { ctx.close().catch(function () {}); } catch (_) {} }
          ctx = null;
        }
      }
      function resume() {
        initialize();
        if (!ctx || disposed) return Promise.resolve();
        if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
          try { return ctx.resume().catch(function () {}); } catch (_) {}
        }
        return Promise.resolve();
      }
      function tick() {
        if (!available()) return;
        var now = ctx.currentTime;
        if (beatTime < now - .3) beatTime = now + .04;
        droneLevel.gain.setTargetAtTime(.012 + threat * .008 + stage * .002, now, .4);
        airFilter.frequency.setTargetAtTime(380 + threat * 360 + stage * 100, now, .5);
        var guard = 0;
        while (beatTime < now + .13 && guard++ < 4) {
          var offset = Math.max(0, beatTime - now), index = beat % 16;
          if (index % 4 === 0) {
            var bass = (index === 8 ? 65.406 : 55) * [1, .891, .75][stage];
            tone(bass, bass * .994, .9, .028 + threat * .017, 'sine', offset, -.12, 300, ambience);
            noise(.1, .015 + threat * .018, 230, -.2, offset, 'lowpass', ambience);
          }
          if (index === 3 || index === 7 || index === 11 || index === 14) {
            var notes = [220, 329.627, 261.626, 293.665];
            var n = notes[Math.floor(index / 4)] * [1, .891, .75][stage];
            tone(n, n, 1.3, .012, 'sine', offset, Math.sin(beat) * .5, 1400, ambience);
            tone(n * 2.002, n * 2, .65, .004, 'sine', offset + .012, -.2, 1600, ambience);
          }
          if (threat > .35 && index % 2 === 0) {
            tone(92, 46, .14, .026 * threat, 'sine', offset, 0, 500, ambience);
            noise(.026, .025 * threat, 3800, .25, offset, 'highpass', ambience);
          }
          if (stage > 0 && index % 4 === 2) noise(.12, .011 + threat * .012, 670, Math.sin(beat * .7) * .7, offset, 'bandpass', ambience);
          beat++; beatTime += .385 - stage * .024;
        }
      }
      return {
        start: resume,
        resume: resume,
        setMuted: function (value) {
          muted = !!value;
          if (ctx && master && !disposed) master.gain.setTargetAtTime(muted ? 0 : .65, ctx.currentTime, .025);
        },
        setThreat: function (value) { threat = Math.max(0, Math.min(1, Number(value) || 0)); },
        setStage: function (value) { stage = Math.max(0, Math.min(2, Math.floor(Number(value) || 0))); },
        tick: tick,
        shot: function () {
          if (!available() || ctx.currentTime - lastShot < .045) return;
          lastShot = ctx.currentTime;
          tone(185, 45, .16, .24, 'sawtooth', 0, .08, 1800);
          tone(1150, 180, .065, .07, 'triangle', 0, .02, 2800);
          noise(.095, .23, 2350, .1);
          noise(.026, .07, 4200, -.1, .035, 'highpass');
        },
        fracture: function () {
          if (!available()) return;
          tone(135, 27, .31, .29, 'sawtooth', 0, .05, 1350);
          tone(65, 32, .42, .21, 'sine', 0, 0);
          noise(.22, .3, 1500, -.14);
          noise(.13, .12, 3100, .14, .035);
          noise(.04, .06, 620, .1, .32, 'lowpass');
        },
        pulse: function () {
          if (!available()) return;
          tone(90, 520, .14, .18, 'sine', 0, -.25);
          tone(240, 35, .55, .22, 'triangle', .07, .2, 1600);
          noise(.55, .17, 580, 0, .04, 'lowpass');
          tone(960, 120, .5, .055, 'sine', .06, -.3);
        },
        switchWeapon: function () {
          noise(.045, .075, 2300, .2);
          tone(170, 98, .065, .055, 'triangle', .025, .1, 1200);
        },
        dash: function () {
          if (!available()) return;
          noise(.17, .075, 1850, -.18, 0, 'highpass');
          noise(.12, .055, 850, .18, .04, 'lowpass');
          tone(180, 65, .18, .035, 'sine', 0, 0, 500);
        },
        enemyShot: function (event) {
          event = event || {};
          var level = (event.level || 1) * .075, pan = event.pan || 0;
          tone(event.kind === 3 ? 180 : 430, 70, .19, level, 'triangle', 0, pan, 1900);
          noise(.07, level * .8, 2100, pan);
        },
        bossPhase: function () {
          [0, .18, .36].forEach(function (offset) {
            tone(110, 55, .4, .09, 'sawtooth', offset, 0, 600);
            tone(440, 220, .25, .04, 'triangle', offset, .2, 1200);
          });
        },
        hit: function () {
          noise(.055, .11, 3600, -.1);
          tone(1780, 660, .065, .055, 'sine', 0, .1);
        },
        hurt: function () {
          tone(82, 33, .26, .2, 'triangle', 0, -.12, 850);
          noise(.2, .12, 750, .12, 0, 'lowpass');
        },
        kill: function () {
          tone(370, 43, .32, .12, 'triangle', 0, -.18, 1800);
          noise(.32, .18, 1250, .18);
          noise(.08, .06, 2900, -.2, .14);
        },
        pickup: function () {
          tone(659.255, 659.255, .18, .075, 'sine', 0, -.18);
          tone(987.767, 987.767, .25, .065, 'sine', .08, .18);
        },
        core: function () {
          [329.627, 440, 659.255].forEach(function (n, i) {
            tone(n, n, .65, .075, 'triangle', i * .13, (i - 1) * .22, 1800);
            tone(n * 2, n * 2, .42, .025, 'sine', i * .13 + .01, 0);
          });
        },
        win: function () {
          [220, 329.627, 440, 523.251, 659.255, 880].forEach(function (n, i) {
            tone(n, n, .9, .085, 'triangle', i * .14, Math.sin(i) * .3, 1900);
          });
        },
        step: function (speed) {
          if (!available() || !(speed > .2)) return;
          // The measured stride in game.js schedules steps; this only rejects duplicates.
          if (ctx.currentTime - lastStep < .1) return;
          lastStep = ctx.currentTime; stepSide *= -1;
          var weight = Math.max(.55, Math.min(1.2, speed / 4.5));
          noise(.075, .09 * weight, 430 + random() * 120, stepSide * .24, 0, 'lowpass');
          tone(67 + random() * 8, 34, .07, .055 * weight, 'sine', 0, stepSide * .18);
          noise(.035, .018 * weight, 2600, stepSide * .25, .025);
          noise(.055, .009 * weight, 1500, -stepSide * .12, .055, 'highpass');
        },
        dispose: function () {
          if (disposed) return;
          disposed = true;
          voices.forEach(function (entry) {
            try { entry.source.stop(); } catch (_) {}
            clean(entry);
          });
          persistent.forEach(function (node) {
            try { if (node.stop) node.stop(); } catch (_) {}
            try { node.disconnect(); } catch (_) {}
          });
          persistent.length = 0;
          if (ctx) { try { ctx.close().catch(function () {}); } catch (_) {} }
          ctx = null; noiseBuffer = null;
        }
      };
    }
  };
}());
