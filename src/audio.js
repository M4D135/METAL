/* METAL: original procedural audio. No imported recordings or external assets. */
(function () {
  'use strict';
  window.FAudio = {
    create: function () {
      var ctx = null, master, effects, ambience, musicBus, droneLevel, airFilter, airVolume, echoSend, noiseBuffer, motorLevel, motorOscillator, steamLevel, steamPan;
      var muted = false, disposed = false, failed = false, threat = 0, pressure = 0, stage = 0;
      var lastStep = -1, stepSide = 1, lastAlert = -1, natureTime = 0;
      var environment = {}, outside = 0, machinery = 0, steam = 0, steamSide = 0, music = null, playing = false;
      var mix = {master:1,music:.45,effects:1,ambience:1};
      var persistent = [], voices = new Set(), noiseSeed = 0x96f3, fxLast = Object.create(null);
      var priority = 2, cue = '', cueLevel = 1, cueDucked = false, duckUntil = 0, duckDepth = 1, preview = null, previewSerial = 0, api;
      var MUSIC_GAIN = .56, EFFECTS_GAIN = .9, AMBIENCE_GAIN = .9;
      var stats = {voices:0,peakVoices:0,fxSkipped:0,stolenVoices:0,duckGain:MUSIC_GAIN,preview:false,outputCeiling:1};
      function remember(node) { persistent.push(node); return node; }
      function random() {
        noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) | 0;
        return (noiseSeed >>> 0) / 4294967296;
      }
      function clean(entry) {
        entry.nodes.forEach(function (n) { try { n.disconnect(); } catch (_) {} });
        voices.delete(entry);
        stats.voices = voices.size;
      }
      function track(source, nodes, level) {
        var entry = { source: source, nodes: nodes, priority:priority, level:level || 0, preview:preview && preview.id };
        voices.add(entry);
        stats.voices = voices.size; stats.peakVoices = Math.max(stats.peakVoices, voices.size);
        source.onended = function () { clean(entry); };
      }
      function available() {
        return ctx && !disposed && (!muted || preview) && ctx.state === 'running';
      }
      function reserve(level, bus) {
        if (!available() || level <= .0001 || (bus === ambience ? mix.ambience : mix.effects) <= 0) return false;
        // Distant enemies get 32 voices, world interactions 40. The remaining
        // eight slots belong to the player and urgent warnings. A loud nearby
        // cue may replace a quieter lower-priority voice, never the MOD bus.
        var limit = priority < 2 ? 32 : priority === 2 ? 40 : 48;
        if (voices.size >= limit) {
          var candidate = null;
          voices.forEach(function (v) { if (v.priority < priority && (!candidate || v.priority < candidate.priority || v.priority === candidate.priority && v.level < candidate.level)) candidate = v; });
          if (!candidate) { stats.fxSkipped++; return false; }
          try { candidate.source.stop(ctx.currentTime); } catch (_) {}
          clean(candidate); stats.stolenVoices++;
        }
        return true;
      }
      function duckMusic() {
        if (cueDucked || !musicBus || !cue || mix.effects <= 0) return;
        var strength = /^(shot|fracture|rocket|grenade|grenadeLaunch|shieldBlock|shieldBash|melee|hurt)$/.test(cue) ? .45 : /^(boss|horror|metallic|powerCut|alarm|explosion)/.test(cue) ? .38 : /^(empty|weaponPickup|trophy|wave|core|mechanism|shieldRaise)$/.test(cue) ? .68 : 1;
        if (strength === 1) return;
        strength = 1 - (1-strength) * Math.min(1,Math.max(0,cueLevel)*1.25);
        cueDucked = true;
        var now = ctx.currentTime, hold = strength < .4 ? .28 : .14;
        duckDepth = now < duckUntil ? Math.min(duckDepth, strength) : strength;
        duckUntil = Math.max(duckUntil, now + hold);
        musicBus.gain.cancelScheduledValues(now);
        musicBus.gain.setTargetAtTime(MUSIC_GAIN * duckDepth, now, .006);
        musicBus.gain.setTargetAtTime(MUSIC_GAIN, duckUntil, .18);
        stats.duckGain = MUSIC_GAIN * duckDepth;
      }
      function updateMaster() {
        if (!ctx || !master || disposed) return;
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(muted && !preview ? 0 : .65 * mix.master, now, .025);
        // An audio-clock cutoff guarantees a two-second menu audition even if
        // the UI thread/timers are throttled. Its JS pump is also cancelled.
        if (preview && muted) {
          master.gain.setValueAtTime(.65 * mix.master, Math.max(now,preview.end-.018));
          master.gain.linearRampToValueAtTime(0, preview.end);
        }
      }
      function effectEvent(name, value, interval) {
        if (!available()) return null;
        var event = value || {}, level = Math.max(0, Math.min(1, Number.isFinite(event.level) ? event.level : 1));
        var previous = fxLast[name], now = ctx.currentTime;
        // Simultaneous distant blasts share a transient; a much nearer/louder
        // event may still replace it. Music is never counted in this budget.
        if (level < .018 || previous && now - previous.time < interval && level <= previous.level * 1.45) { stats.fxSkipped++; return null; }
        fxLast[name] = {time:now,level:level};
        return {level:level,pan:Math.max(-1,Math.min(1,Number(event.pan)||0)),event:event};
      }
      function handEvent(name,value,interval){
        var hand=value&&value.hand,side=hand==='left'?-.22:hand==='right'?.22:0;
        var event=effectEvent(name+':'+(hand==='left'?'left':hand==='right'?'right':'single'),value,interval);
        if(event)event.pan=Math.max(-1,Math.min(1,event.pan+side));
        return event;
      }
      function updateSteam() {
        if (!ctx || !steamLevel || disposed) return;
        steamLevel.gain.setTargetAtTime(playing ? steam * .115 : 0, ctx.currentTime, steam ? .09 : .025);
        if (steamPan.pan) steamPan.pan.setTargetAtTime(steamSide, ctx.currentTime, .12);
      }
      function horrorCue(kind,value) {
        if (!playing) return;
        var event=value||{},intensity=Math.max(0,Math.min(1,Number.isFinite(event.intensity)?event.intensity:.75));
        var e=effectEvent('horror:'+kind,{level:(Number.isFinite(event.level)?event.level:1)*intensity,pan:event.pan},.5);
        if (!e) return; var g=e.level,tier=Math.max(0,Math.min(4,Number(event.tier)||0)),tune=1+tier*.025;
        if (kind==='metallicSlam') {
          tone(102,34,.47,.12*g,'triangle',0,e.pan,1100);noise(.055,.08*g,2200,e.pan,0,'highpass');
          [480,719,1173].forEach(function(f,i){tone(f*tune,f*.79,.42+i*.10,.043*g/(1+i*.6),'sine',.015,e.pan);});
        } else if (kind==='blackout') {
          tone(120,34,.24,.045*g,'sawtooth',0,e.pan,650);noise(.035,.04*g,1900,e.pan,0,'bandpass');tone(72,26,.26,.05*g,'sine',.07,e.pan);
        } else if (kind==='alarm') {
          for(var i=0;i<2;i++){tone(340*tune,450*tune,.24,.055*g,'triangle',i*.34,e.pan,1250);tone(680*tune,880*tune,.15,.018*g,'sine',i*.34+.025,e.pan);}
        } else if (kind==='ambush') {
          tone(70,31,.43,.11*g,'sine',0,e.pan);tone(155*tune,206*tune,.23,.055*g,'sawtooth',0,e.pan,850);
          tone(196*tune,183*tune,.34,.04*g,'triangle',.02,-e.pan*.3,1250);noise(.09,.065*g,1700,e.pan,0,'bandpass');
        }
      }
      function panNode(value) {
        if (ctx.createStereoPanner) {
          var p = ctx.createStereoPanner();
          p.pan.value = Math.max(-1,Math.min(1,Number(value)||0));
          return p;
        }
        return ctx.createGain();
      }
      function tone(frequency, end, duration, level, shape, offset, pan, cutoff, bus) {
        if (!reserve(level,bus)) return;
        duckMusic();
        var t = ctx.currentTime + (offset || 0), o = ctx.createOscillator();
        var g = ctx.createGain(), p = panNode(pan), nodes = [o, g, p];
        o.type = shape || 'sine';
        o.frequency.setValueAtTime(Math.max(1, frequency), t);
        if (end) o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + Math.min(.005, duration / 6));
        g.gain.exponentialRampToValueAtTime(Math.max(.00011,level*.28), t + duration*.46);
        g.gain.exponentialRampToValueAtTime(.0001, t + duration);
        if (cutoff) {
          var f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = .65;
          o.connect(f); f.connect(g); nodes.push(f);
        } else o.connect(g);
        g.connect(p); p.connect(bus || effects);
        track(o, nodes, level);
        o.start(t); o.stop(t + duration + .03);
      }
      function noise(duration, level, frequency, pan, offset, type, bus) {
        if (!reserve(level,bus)) return;
        duckMusic();
        var t = ctx.currentTime + (offset || 0), s = ctx.createBufferSource();
        var f = ctx.createBiquadFilter(), g = ctx.createGain(), p = panNode(pan);
        s.buffer = noiseBuffer;
        f.type = type || 'bandpass'; f.frequency.value = frequency; f.Q.value = .7;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + .004);
        g.gain.exponentialRampToValueAtTime(Math.max(.00011,level*.18), t + duration*.52);
        g.gain.exponentialRampToValueAtTime(.0001, t + duration);
        s.connect(f); f.connect(g); g.connect(p); p.connect(bus || effects);
        track(s, [s, f, g, p], level);
        s.start(t, random() * .7); s.stop(t + duration + .02);
      }
      function initialize() {
        if (ctx || disposed || failed) return;
        var Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) { failed = true; return; }
        try {
          ctx = new Audio();
          master = remember(ctx.createGain());
          master.gain.value = muted ? 0 : .65 * mix.master;
          var limiter = remember(ctx.createDynamicsCompressor());
          limiter.threshold.value = -19; limiter.knee.value = 18;
          limiter.ratio.value = 5; limiter.attack.value = .004; limiter.release.value = .18;
          // The existing compressor/mix stays intact. This final soft ceiling
          // is exactly linear below .875 and mathematically bounded above it,
          // including coincident rockets, debris and the MOD soundtrack.
          var guard = remember(ctx.createWaveShaper()), curve = new Float32Array(2049);
          for (var ci = 0; ci < curve.length; ci++) {
            var input = ci / 1024 - 1, magnitude = Math.abs(input);
            curve[ci] = Math.sign(input) * (magnitude <= .875 ? magnitude : .875 + .095 * (1 - Math.exp(-(magnitude - .875) / .095)));
          }
          guard.curve = curve; guard.oversample = 'none'; stats.outputCeiling = curve[curve.length-1];
          master.connect(limiter); limiter.connect(guard); guard.connect(ctx.destination);
          effects = remember(ctx.createGain()); effects.gain.value = EFFECTS_GAIN * mix.effects; effects.connect(master);
          ambience = remember(ctx.createGain()); ambience.gain.value = AMBIENCE_GAIN * mix.ambience; ambience.connect(master);
          musicBus = remember(ctx.createGain()); musicBus.gain.value = MUSIC_GAIN; musicBus.connect(master);

          // A small filtered echo gives the metal chambers a sense of space.
          var send = remember(ctx.createGain()), delay = remember(ctx.createDelay(.5));
          echoSend = send;
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
          var hiss = remember(ctx.createBufferSource()), hissFilter = remember(ctx.createBiquadFilter());
          steamLevel = remember(ctx.createGain()); steamPan = remember(panNode(0));
          hiss.buffer = noiseBuffer; hiss.loop = true; hissFilter.type = 'bandpass'; hissFilter.frequency.value = 1850; hissFilter.Q.value = .45; steamLevel.gain.value = 0;
          hiss.connect(hissFilter); hissFilter.connect(steamLevel); steamLevel.connect(steamPan); steamPan.connect(effects); hiss.start();
          var air = remember(ctx.createBufferSource()); airVolume = remember(ctx.createGain());
          airFilter = remember(ctx.createBiquadFilter());
          air.buffer = noiseBuffer; air.loop = true;
          airFilter.type = 'lowpass'; airFilter.frequency.value = 380;
          airVolume.gain.value = 0;
          air.connect(airFilter); airFilter.connect(airVolume); airVolume.connect(ambience); air.start();

          droneLevel = remember(ctx.createGain()); droneLevel.gain.value = 0;
          droneLevel.connect(ambience);
          [58.27, 87.307, 176.1].forEach(function (frequency, index) {
            var oscillator = remember(ctx.createOscillator()), level = remember(ctx.createGain());
            oscillator.type = index === 0 ? 'sine' : 'triangle';
            oscillator.frequency.value = frequency; level.gain.value = index === 2 ? .33 : .5;
            oscillator.connect(level); level.connect(droneLevel); oscillator.start();
          });
          var sway = remember(ctx.createOscillator()), swayDepth = remember(ctx.createGain());
          sway.frequency.value = .087; swayDepth.gain.value = .004;
          sway.connect(swayDepth); swayDepth.connect(droneLevel.gain); sway.start();
          motorLevel = remember(ctx.createGain()); motorLevel.gain.value = 0;
          motorOscillator = remember(ctx.createOscillator()); motorOscillator.type = 'triangle'; motorOscillator.frequency.value = 48;
          motorOscillator.connect(motorLevel); motorLevel.connect(ambience); motorOscillator.start();
          if (window.FMusic) { music = FMusic.create(ctx, musicBus); music.setStage(stage); music.setVolume(mix.music); music.setThreat(Math.max(threat,pressure*.65)); music.setPlaying(playing); }
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
        // Tracker scheduling has its own bounded voices; gunfire never starves it.
        if (music) music.tick();
        updateSteam();
        if (!available()) return;
        var now = ctx.currentTime;
        var active = playing || preview;
        if (now >= duckUntil + 1) stats.duckGain = MUSIC_GAIN;
        droneLevel.gain.setTargetAtTime(active ? (.038 + threat * .012 + pressure*.024 + stage * .003) * (1 - outside * .42) : 0, now, .25);
        airFilter.frequency.setTargetAtTime(530 + threat * 290 + pressure*220 + stage * 90 + outside * 450, now, .4);
        var wind = Math.max(.2, Math.min(2, Number(environment.wind) || 1));
        airVolume.gain.setTargetAtTime(active ? .085 + pressure*.035 + outside * wind * (.025 + .014 * Math.sin(now * .31)) : 0, now, .3);
        echoSend.gain.setTargetAtTime(.11 - outside * .075, now, .65);
        motorLevel.gain.setTargetAtTime(active ? machinery * .095 : 0, now, .18);
        motorOscillator.frequency.setTargetAtTime(48 + machinery * 18 + Math.sin(now * 5) * machinery, now, .12);
        if (active && outside > .5 && now >= natureTime) {
          natureTime = now + 4 + random() * 5;
          var side = random() * 1.4 - .7, calm = (1 - Math.max(threat,pressure)*.75) * outside, oldPriority = priority;
          priority = 1;
          if (stage === 0) {
            var chirp = 1600 + random() * 900;
            tone(chirp, chirp * 1.32, .095, .044 * calm, 'sine', 0, side, 3500, ambience);
            tone(chirp * 1.12, chirp * .77, .17, .034 * calm, 'sine', .16, side, 3000, ambience);
          } else if (stage === 1) {
            noise(.9, .028 * calm, 1500, side, 0, 'bandpass', ambience);
            tone(310, 290, .35, .011 * calm, 'triangle', .12, -side, 900, ambience);
          } else {
            for (var j = 0; j < 3; j++) tone(2400, 2700, .055, .008 * calm, 'sine', j * .1, side, 3200, ambience);
            tone(520, 490, .38, .009 * calm, 'sine', .45, -side, 900, ambience);
          }
          priority = oldPriority;
        }

      }
      function cancelTestMix() {
        previewSerial++;
        var previous = preview;
        if (!previous) return;
        preview = null; stats.preview = false;
        if (previous.timer !== null) clearTimeout(previous.timer);
        for (var entry of Array.from(voices)) if (entry.preview === previous.id) { try { entry.source.stop(); } catch (_) {} clean(entry); }
        if (music) music.setPlaying(playing);
        if (musicBus && ctx) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(MUSIC_GAIN,ctx.currentTime,.03); }
        duckUntil = 0; duckDepth = 1; stats.duckGain = MUSIC_GAIN;
        updateMaster();
        if (ctx && !playing) for (var node of [airVolume,droneLevel,motorLevel]) if (node) node.gain.setTargetAtTime(0,ctx.currentTime,.025);
      }
      function testMix(options) {
        cancelTestMix();
        var serial = ++previewSerial;
        if (disposed || options && options.muted || mix.master <= 0 || typeof setTimeout !== 'function') return Promise.resolve(false);
        return resume().then(function () {
          if (!ctx || disposed || serial !== previewSerial || ctx.state !== 'running') return false;
          var start = ctx.currentTime, audition = {id:serial,end:start+2,timer:null,index:0};
          preview = audition; stats.preview = true; updateMaster();
          if (music) music.setPlaying(true);
          // These use the real buses, samples and cue methods. Volume sliders,
          // including an intentionally silent effects/ambience/music bus, hold.
          var events = [
            {at:0,run:function(){noise(1.7,.15,720,-.4,0,'bandpass',ambience);tone(146,115,1.5,.055,'triangle',0,.4,600,ambience);}},
            {at:.25,run:function(){api.shot();}},
            {at:.55,run:function(){api.shot();}},
            {at:.9,run:function(){api.fracture();}},
            {at:1.45,run:function(){api.ammoPickup();}}
          ];
          function pump() {
            if (preview !== audition || disposed) return;
            if (ctx.currentTime >= audition.end || ctx.state !== 'running') { cancelTestMix(); return; }
            while (audition.index < events.length && ctx.currentTime-start >= events[audition.index].at) events[audition.index++].run();
            tick(); audition.timer = setTimeout(pump,40);
          }
          pump(); return true;
        });
      }
      api = {
        start: resume,
        resume: resume,
        prepare: function (value) {
          var next=Math.max(0,Math.min(2,Math.floor(Number(value)||0)));
          // The user gesture opens the shared context through start/resume.
          // This method only prepares existing player buffers after pure PCM
          // warmup; it neither opens a device nor changes the active score.
          if (!window.FMusic || disposed) return Promise.resolve(false);
          return FMusic.warmup(next).then(function () { return !!(ctx && music && !disposed && music.prepare(next)); });
        },
        setMuted: function (value) {
          cancelTestMix();
          muted = !!value;
          updateMaster();
        },
        setThreat: function (value) { threat = Math.max(0, Math.min(1, Number(value) || 0)); if (music) music.setThreat(Math.max(threat,pressure*.65)); },
        setPressure: function (value) { pressure = Math.max(0,Math.min(1,Number(value)||0)); if (music) music.setThreat(Math.max(threat,pressure*.65)); },
        setStage: function (value) { cancelTestMix(); stage = Math.max(0, Math.min(2, Math.floor(Number(value) || 0))); pressure = 0; steam = 0; updateSteam(); if (music) { music.setStage(stage); music.setThreat(threat); } },
        setPlaying: function (value) { cancelTestMix(); playing = !!value; updateSteam(); if (music) music.setPlaying(playing); if (!playing && ctx) for (var node of [airVolume,droneLevel,motorLevel]) if (node) node.gain.setTargetAtTime(0,ctx.currentTime,.025); },
        setMix: function (value) {
          for (var key in mix) if (Number.isFinite(value && value[key])) mix[key] = Math.max(0, Math.min(1, value[key]));
          if (!ctx || disposed) return;
          updateMaster();
          effects.gain.setTargetAtTime(EFFECTS_GAIN * mix.effects, ctx.currentTime, .025);
          ambience.gain.setTargetAtTime(AMBIENCE_GAIN * mix.ambience, ctx.currentTime, .025);
          if (music) music.setVolume(mix.music);
        },
        setEnvironment: function (value, amount) { environment = value || {}; outside = Math.max(0, Math.min(1, Number(amount) || 0)); },
        setMachinery: function (value) { machinery = Math.max(0, Math.min(1, Number(value) || 0)); },
        setSteam: function (value, pan) { steam = Math.max(0,Math.min(1,Number(value)||0)); steamSide = Math.max(-1,Math.min(1,Number(pan)||0)); updateSteam(); },
        stats: stats,
        tick: tick,
        testMix: testMix,
        cancelTestMix: cancelTestMix,
        horror: function (event) { horrorCue(event&&event.kind,event); },
        metallicSlam: function (event) { horrorCue('metallicSlam',event); },
        horrorSting: function (event) { horrorCue('ambush',event); },
        powerCut: function (event) { horrorCue('blackout',event); },
        alarm: function (event) { horrorCue('alarm',event); },
        rocket: function (value) {
          var e = handEvent('rocket',value,.055); if (!e) return; var g = e.level;
          tone(190,53,.2,.11*g,'sawtooth',0,e.pan,1100);
          noise(.19,.12*g,1800,e.pan,0,'bandpass');tone(52,34,.22,.07*g,'sine',0,e.pan);
        },
        grenade: function (value) {
          var e = effectEvent('grenade',value,.085); if (!e) return; var g = e.level;
          noise(.06,.075*g,2600,e.pan,0,'highpass');tone(220,110,.1,.055*g,'triangle',0,e.pan,1800);tone(110,50,.17,.08*g,'sine',.015,e.pan);
        },
        grenadeLaunch: function(value){
          if(!playing&&!preview)return;
          var e=handEvent('grenadeLaunch',value,.075);if(!e)return;var g=e.level;
          // A short barrel thump, compressed gas and the spring-loaded breech.
          tone(105,31,.29,.19*g,'sine',0,e.pan);
          noise(.16,.17*g,780,e.pan,0,'lowpass');
          tone(260,88,.14,.095*g,'triangle',.012,e.pan,1400);
          noise(.035,.065*g,3200,e.pan,.045,'bandpass');
        },
        shieldRaise: function(value){
          if(!playing&&!preview)return;
          var e=effectEvent('shieldRaise',value,.15);if(!e)return;var g=e.level;
          tone(165,410,.23,.075*g,'triangle',0,e.pan,1500);
          noise(.11,.052*g,1650,e.pan,.015,'bandpass');
          tone(700,520,.09,.048*g,'sine',.11,e.pan);
        },
        shieldBlock: function(value){
          if(!playing&&!preview)return;
          var broken=!!(value&&value.broken),e=effectEvent(broken?'shieldBreak':'shieldBlock',value,.035);if(!e)return;
          var absorbed=Number(e.event.absorbed),force=Number.isFinite(absorbed)?Math.max(0,absorbed):4;
          var g=e.level*(.65+.35*Math.min(1,Math.sqrt(force/8)));
          noise(.055,.13*g,2300,e.pan,0,'bandpass');
          tone(920,280,.19,.10*g,'triangle',0,e.pan,2400);
          tone(110,44,.15,.13*g,'sine',0,e.pan);
          if(broken){noise(.22,.09*g,4400,e.pan,.025,'highpass');tone(400,65,.30,.065*g,'sawtooth',.035,e.pan,1400);}
        },
        shieldBash: function(value){
          if(!playing&&!preview)return;
          var e=effectEvent('shieldBash',value,.25);if(!e)return;var g=e.level;
          noise(.15,.085*g,850,e.pan,0,'bandpass');
          tone(180,57,.17,.10*g,'triangle',0,e.pan,1100);
          if(e.event.hit||e.event.count>0){tone(95,29,.24,.17*g,'sine',.035,e.pan);noise(.07,.11*g,1450,e.pan,.035,'bandpass');}
        },
        explosion: function (value) {
          var e = effectEvent('explosion',value,.095); if (!e) return;
          var kind=e.event.kind,steamBlast=kind==='steam',boss=kind==='boss';
          var size=Math.max(.7,Math.min(1.8,(Number(e.event.radius)||3.5)/3.5*(boss?1.12:1)));
          var power=Math.max(.72,Math.min(1.35,Math.sqrt(Math.max(0,Number(e.event.power)||32)/32)));
          var g=e.level*power*(steamBlast?.68:1),bright=.45+.55*e.level,tune=.96+((Number(e.event.seed)||0)>>>0)%9*.01;
          var spread=.22*e.level,left=Math.max(-1,e.pan-spread),right=Math.min(1,e.pan+spread);
          // Crack → low-frequency pressure → audible cabinet/body → debris.
          // Seven short/decaying voices reuse the existing noise buffer. The
          // normal-effects pool leaves eight slots for player shots/warnings.
          noise(.045,.22*g,1000+2700*e.level,e.pan,0,'bandpass');
          tone(78/Math.sqrt(size),25,.72*size,.245*g,'sine',0,e.pan);
          noise(.43*size,.36*g,520+540*e.level,e.pan,0,'lowpass');
          tone(170*tune/size,48,.40*size,.145*g,'triangle',.008,e.pan,920*bright);
          noise(.24*size,.105*g,(steamBlast?2600:2300)*bright,right,.075,'bandpass');
          noise(1.05*size,.135*g,(steamBlast?1700:1150)*bright,left,.12,steamBlast?'bandpass':'lowpass');
          tone((kind==='grenade'?470:340)*tune,92,.55*size,.055*g,'triangle',.085,right,1500*bright);
        },
        pipeLeak: function (value) {
          var e = effectEvent('pipeLeak',value,.13); if (!e) return; var g = e.level;
          noise(.5,.12*g,2200,e.pan,0,'bandpass');tone(210,90,.23,.055*g,'triangle',0,e.pan,1300);noise(.055,.06*g,4400,e.pan,0,'highpass');
        },
        creak: function (value) {
          var e = effectEvent('creak',value,.15); if (!e) return; var g = e.level;
          tone(185,66,.42,.065*g,'sawtooth',0,e.pan,650);tone(380,160,.27,.035*g,'triangle',.04,-e.pan*.4,1200);noise(.16,.06*g,820,e.pan,.09,'bandpass');
        },
        trap: function (value) {
          var e = effectEvent('trap',value,.1); if (!e) return; var g = e.level, kind = e.event.kind;
          if (kind === 'blade') { tone(680,180,.22,.085*g,'triangle',0,e.pan,2200);noise(.09,.06*g,3200,e.pan,0,'highpass'); }
          else if (kind === 'spikes') { tone(1350,280,.11,.075*g,'triangle',0,e.pan,2800);noise(.08,.06*g,2400,e.pan,0,'bandpass'); }
          else { tone(105,29,.25,.16*g,'triangle',0,e.pan,650);noise(.13,.11*g,520,e.pan,0,'lowpass'); }
        },
        bossTell: function (value) {
          var e = effectEvent('bossTell',value,.25); if (!e) return; var g = e.level;
          tone(92,180,.52,.09*g,'triangle',0,e.pan,1100);tone(370,530,.28,.035*g,'sine',.08,-e.pan*.3);noise(.16,.035*g,720,e.pan,.12,'bandpass');
        },
        bossRoar: function (value) {
          var e = effectEvent('bossRoar',value,.6); if (!e) return; var g = e.level;
          tone(55,25,.85,.15*g,'sawtooth',0,e.pan,520);tone(83,39,.65,.09*g,'triangle',.04,-e.pan*.5,700);noise(.65,.13*g,450,e.pan,0,'lowpass');noise(.4,.035*g,1300,e.pan,.14,'bandpass');
        },
        bossImpact: function (value) {
          var e = effectEvent('bossImpact',value,.12); if (!e) return; var g = e.level;
          tone(48,20,.7,.2*g,'sine',0,e.pan);noise(.28,.19*g,460,e.pan,0,'lowpass');noise(.065,.08*g,2800,e.pan,0,'highpass');tone(115,36,.45,.07*g,'triangle',.08,-e.pan*.4,700);
        },
        bossDeath: function (value) {
          var e = effectEvent('bossDeath',value,1.4); if (!e) return; var g = e.level;
          tone(78,19,1.15,.15*g,'sawtooth',0,e.pan,440);noise(.65,.12*g,360,e.pan,0,'lowpass');
          for (var i = 0; i < 3; i++) {
            var delay = .22 + i*.26;
            tone(160-i*27,31,.32,.06*g,'triangle',delay,e.pan*(i%2?-.5:1),850);
            noise(.22,.085*g,620+i*280,e.pan,delay,'bandpass');
          }
        },
        shot: function (value) {
          var pistol=!!value&&value.weapon===4;
          if(pistol&&!playing&&!preview)return;
          var e=handEvent(pistol?'pistol':'shot',value,pistol?.08:.045);if(!e)return;var g=e.level;
          if(pistol){
            // A compact crack, a short body and the closing slide; no sample asset.
            tone(260,68,.115,.18*g,'triangle',0,e.pan,2200);
            tone(1560,240,.045,.065*g,'sawtooth',0,e.pan,3400);
            noise(.058,.19*g,2900,e.pan,0,'highpass');
            noise(.024,.065*g,4600,e.pan,.048,'highpass');
            return;
          }
          tone(185, 45, .16, .24*g, 'sawtooth', 0, e.pan+.08, 1800);
          tone(1150, 180, .065, .07*g, 'triangle', 0, e.pan+.02, 2800);
          noise(.095, .23*g, 2350, e.pan+.1);
          noise(.026, .07*g, 4200, e.pan-.1, .035, 'highpass');
        },
        fracture: function (value) {
          var e=handEvent('fracture',value,.075);if(!e)return;var g=e.level;
          tone(135, 27, .31, .29*g, 'sawtooth', 0, e.pan+.05, 1350);
          tone(65, 32, .42, .21*g, 'sine', 0, e.pan);
          noise(.22, .3*g, 1500, e.pan-.14);
          noise(.13, .12*g, 3100, e.pan+.14, .035);
          noise(.04, .06*g, 620, e.pan+.1, .32, 'lowpass');
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
        alerted: function (event) {
          if (!available() || ctx.currentTime - lastAlert < .45) return;
          lastAlert = ctx.currentTime; event = event || {};
          var level = Math.min(1, event.level || 1) * .065, pan = event.pan || 0;
          tone(530, 820, .085, level, 'triangle', 0, pan, 1500);
          tone(1040, 720, .12, level * .55, 'sine', .095, pan, 1800);
        },
        enemyShot: function (event) {
          event = event || {};
          var pan = Math.max(-1,Math.min(1,Number(event.pan)||0)), e = effectEvent('enemyShot:'+Math.round(pan*4),event,.06);
          if (!e || e.level < .055) return;
          var level = e.level * .115;
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
        ammoPickup: function (value) {
          var e=effectEvent('ammoPickup',value,.08);if(!e)return;
          noise(.045,.10*e.level,2700,e.pan,0,'highpass');
          tone(235,150,.10,.075*e.level,'triangle',.025,e.pan,1400);
          tone(660,880,.14,.055*e.level,'sine',.07,-e.pan*.3,1900);
        },
        weaponPickup: function (value) {
          var e=effectEvent('weaponPickup',value,.2);if(!e)return;
          noise(.09,.13*e.level,1800,e.pan,0,'bandpass');tone(120,52,.21,.13*e.level,'triangle',0,e.pan,900);
          tone(330,440,.23,.075*e.level,'sawtooth',.08,-.16,1200);tone(660,880,.26,.055*e.level,'triangle',.18,.16,1800);
        },
        // A new campaign discovery has one short forged-metal fanfare. It is
        // dispatched only by the discovery event, never by snapshot restore.
        trophy: function (value) {
          if(!playing&&!preview)return;
          var e=effectEvent('trophy',value,1.1);if(!e)return;var g=e.level;
          noise(.095,.13*g,1900,e.pan,0,'bandpass');
          tone(88,55,.24,.12*g,'triangle',0,e.pan,950);
          tone(164.81,164.81,.32,.085*g,'sawtooth',.035,-.12,1400);
          tone(246.94,246.94,.36,.07*g,'sawtooth',.13,.12,1600);
          tone(329.63,329.63,.48,.06*g,'triangle',.25,0,2200);
        },
        empty: function (value) {
          var e=effectEvent('empty',value,.18);if(!e)return;
          noise(.025,.10*e.level,3400,.08,0,'highpass');tone(390,170,.055,.065*e.level,'triangle',0,.06,1800);
        },
        melee: function (value) {
          var e=effectEvent('melee',value,.12);if(!e)return;
          noise(.12,.12*e.level,1100,e.pan,0,'bandpass');tone(155,48,.14,.14*e.level,'triangle',.035,e.pan,900);
          if(e.event.hit){noise(.06,.15*e.level,2800,e.pan,.055,'highpass');tone(88,33,.18,.14*e.level,'sine',.055,e.pan);}
        },
        wave: function (value) {
          var e=effectEvent('wave',value,.8);if(!e)return;
          tone(98,58,.55,.11*e.level,'sawtooth',0,-.2,650);noise(.19,.07*e.level,1400,.2,.03,'bandpass');
          tone(294,277,.31,.065*e.level,'triangle',.08,.2,1300);tone(196,185,.46,.055*e.level,'triangle',.12,-.2,1100);
        },
        core: function () {
          [329.627, 440, 659.255].forEach(function (n, i) {
            tone(n, n, .65, .075, 'triangle', i * .13, (i - 1) * .22, 1800);
            tone(n * 2, n * 2, .42, .025, 'sine', i * .13 + .01, 0);
          });
        },
        mechanism: function (event) {
          event = event || {}; var level = (event.level || 1) * .13, pan = event.pan || 0;
          noise(.13, level, 620, pan, 0, 'lowpass');
          tone(130, 72, .19, level * .65, 'triangle', 0, pan, 1100);
          tone(220, 440, .45, level * .45, 'sine', .1, pan);
          tone(660, 660, .3, level * .35, 'sine', .42, pan);
        },
        jumpPad: function (event) {
          event = event || {}; var level = (event.level || 1) * (event.actor === 'enemy' ? .06 : .16), pan = event.pan || 0;
          tone(80, 650, .36, level, 'sawtooth', 0, pan, 1200);
          noise(.27, level * .8, 1800, pan, 0, 'bandpass');
          tone(42, 90, .22, level, 'sine', 0, pan);
        },
        land: function (event) {
          event = event || {}; var impact = Math.min(1, (event.impact || 4) / 10), level = (event.level || 1) * impact * (event.actor === 'enemy' ? .035 : .12), pan = event.pan || 0;
          tone(70, 28, .14, level, 'sine', 0, pan); noise(.12, level * .8, 480, pan, 0, 'lowpass');
        },
        liftStart: function (event) {
          event = event || {}; var level = (event.level || 1) * .1, pan = event.pan || 0;
          noise(.2, level, 720, pan, 0, 'lowpass');
          tone(35, 75, .7, level * .7, 'triangle', .04, pan, 420);
        },
        liftStop: function (event) {
          event = event || {}; var level = (event.level || 1) * .08, pan = event.pan || 0;
          noise(.13, level, 580, pan, 0, 'lowpass');
          tone(75, 36, .24, level * .7, 'triangle', 0, pan, 360);
          tone(523.25, 523.25, .22, level * .5, 'sine', .12, pan);
          tone(783.99, 783.99, .35, level * .4, 'sine', .26, pan);
        },
        win: function () {
          [220, 329.627, 440, 523.251, 659.255, 880].forEach(function (n, i) {
            tone(n, n, .9, .085, 'triangle', i * .14, Math.sin(i) * .3, 1900);
          });
        },
        step: function (speed, surface) {
          if (!available() || !(speed > .2)) return;
          // The measured stride in game.js schedules steps; this only rejects duplicates.
          if (ctx.currentTime - lastStep < .1) return;
          lastStep = ctx.currentTime; stepSide *= -1;
          var weight = Math.max(.55, Math.min(1.2, speed / 4.5));
          if (surface && surface.outdoor) {
            noise(.095, .074 * weight, stage === 1 ? 1850 : 1050, stepSide * .24, 0, 'bandpass');
            noise(.055, .024 * weight, 3700, stepSide * .2, .025, 'highpass');
            tone(53 + random() * 7, 29, .065, .026 * weight, 'sine', 0, stepSide * .15);
            return;
          }
          noise(.075, .09 * weight, 430 + random() * 120, stepSide * .24, 0, 'lowpass');
          tone(67 + random() * 8, 34, .07, .055 * weight, 'sine', 0, stepSide * .18);
          noise(.035, .018 * weight, 2600, stepSide * .25, .025);
          noise(.055, .009 * weight, 1500, -stepSide * .12, .055, 'highpass');
        },
        dispose: function () {
          if (disposed) return;
          cancelTestMix();
          disposed = true;
          if (music) { music.dispose(); music = null; }
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
      // Priority belongs to a cue, not its waveform. A rocket's click, body
      // and exhaust keep the same reservation and cause one short music dip.
      var urgent = /^(shot|fracture|pulse|rocket|grenade|grenadeLaunch|shieldBlock|shieldBash|hurt|bossTell|bossRoar|bossImpact|bossDeath|bossPhase|horror|metallicSlam|horrorSting|powerCut|alarm|empty|melee|weaponPickup|trophy|wave|core|win)$/;
      var helpers = /^(start|resume|prepare|set|tick|testMix|cancelTestMix|dispose)/;
      Object.keys(api).forEach(function (name) {
        if (typeof api[name] !== 'function' || helpers.test(name)) return;
        var method = api[name];
        api[name] = function () {
          var event = arguments[0], previousPriority=priority, previousCue=cue, previousLevel=cueLevel, previousDucked=cueDucked;
          if (event && typeof event==='object' && Number.isFinite(event.level) && event.level<=.008) return;
          priority = name==='enemyShot'||name==='alerted' ? 1 : urgent.test(name) ? 3 : 2;
          if ((name==='rocket'||name==='grenade') && event && event.owner !== undefined && event.owner !== 'player') priority=2;
          cue=name;cueLevel=event&&typeof event==='object'&&Number.isFinite(event.level)?Math.max(0,Math.min(1,event.level)):1;
          if(event&&typeof event==='object'&&Number.isFinite(event.intensity))cueLevel*=Math.max(0,Math.min(1,event.intensity));
          cueDucked=false;
          try { return method.apply(api,arguments); }
          finally { priority=previousPriority;cue=previousCue;cueLevel=previousLevel;cueDucked=previousDucked; }
        };
      });
      return api;
    }
  };
}());
