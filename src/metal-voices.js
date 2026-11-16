/* METAL — procedural voices of the humanoid machines (David, 16/11/2026): the
   kamikaze's howl and the liquid blade's ring. Synthesised with Web Audio into
   the effects bus of FAudio; no recorded sound. */
(function(G){'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function attach(audio){
    if(!audio||typeof audio.graph!=='function'||audio.kamikazeScream)return audio;
    let live=0,shaper=null;
    function bus(){const g=audio.graph();return g&&g.effects&&g.effects.context?g.effects:null;}
    function grit(ctx){
      if(shaper&&shaper.context===ctx)return shaper;
      shaper=ctx.createWaveShaper();const curve=new Float32Array(1024);
      for(let i=0;i<curve.length;i++){const x=i/511.5-1;curve[i]=Math.tanh(x*3.2)*.9;}
      shaper.curve=curve;return shaper;
    }
    function output(ctx,target,level,pan,end){
      const gain=ctx.createGain(),panner=ctx.createStereoPanner?ctx.createStereoPanner():null;
      gain.gain.value=0;if(panner){panner.pan.value=clamp(Number(pan)||0,-1,1);gain.connect(panner);panner.connect(target);}else gain.connect(target);
      return {gain,stop(){try{gain.disconnect();panner&&panner.disconnect();}catch(_){}},end};
    }
    // A machine howl: two detuned saws with vibrato through the formants of
    // an open vowel, a breath of noise and a soft drive. At most three at once.
    audio.kamikazeScream=function(event){
      const target=bus();if(!target||live>=3)return;const ctx=target.context,now=ctx.currentTime,seed=((event&&event.id)||0)*.6180339;
      const level=clamp(Number(event&&event.level)||0,0,1)*.42;if(level<.01)return;
      const length=1.35+(seed%1)*.5,base=270+(seed*97%1)*70,out=output(ctx,target,level,event&&event.pan);
      out.gain.gain.setValueAtTime(0,now);out.gain.gain.linearRampToValueAtTime(level,now+.07);out.gain.gain.setValueAtTime(level,now+length-.32);out.gain.gain.exponentialRampToValueAtTime(.0005,now+length);
      const drive=ctx.createGain();drive.gain.value=.7;const shape=grit(ctx),post=ctx.createGain();post.gain.value=.55;drive.connect(shape);shape.connect(post);
      const formants=[[760,6,1],[1180,8,.62],[2650,11,.26]].map(([f,q,g])=>{const b=ctx.createBiquadFilter(),a=ctx.createGain();b.type='bandpass';b.frequency.value=f;b.Q.value=q;a.gain.value=g;post.connect(b);b.connect(a);a.connect(out.gain);return [b,a];});
      const sources=[];
      for(const detune of [-8,9]){
        const o=ctx.createOscillator();o.type='sawtooth';o.detune.value=detune;
        o.frequency.setValueAtTime(base,now);o.frequency.linearRampToValueAtTime(base*1.28,now+.35);o.frequency.linearRampToValueAtTime(base*1.18,now+length);
        const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=6.5+(seed*13%1)*2;depth.gain.value=base*.045;lfo.connect(depth);depth.connect(o.frequency);
        o.connect(drive);o.start(now);o.stop(now+length+.05);lfo.start(now);lfo.stop(now+length+.05);sources.push(o,lfo);
      }
      const frames=Math.ceil(ctx.sampleRate*length),buffer=ctx.createBuffer(1,frames,ctx.sampleRate),data=buffer.getChannelData(0);let s=(seed*1e6|0)||7;
      for(let i=0;i<frames;i++){s=(s*1103515245+12345)>>>0;data[i]=(s/4294967296*2-1)*.35;}
      const breath=ctx.createBufferSource(),air=ctx.createBiquadFilter();breath.buffer=buffer;air.type='bandpass';air.frequency.value=1600;air.Q.value=1.2;breath.connect(air);air.connect(post);breath.start(now);sources.push(breath);
      live++;let done=false;const finish=()=>{if(done)return;done=true;live=Math.max(0,live-1);setTimeout(()=>{out.stop();for(const [b,a] of formants){try{b.disconnect();a.disconnect();}catch(_){}}try{drive.disconnect();post.disconnect();air.disconnect();}catch(_){}},60);};
      sources[0].onended=finish;
    };
    // The liquid blade: a bright, falling metallic ring over a short swish.
    audio.bladeStrike=function(event){
      const target=bus();if(!target)return;const ctx=target.context,now=ctx.currentTime,level=clamp(Number(event&&event.level)||0,0,1)*.5;if(level<.01)return;
      const out=output(ctx,target,level,event&&event.pan);out.gain.gain.setValueAtTime(level,now);out.gain.gain.exponentialRampToValueAtTime(.0005,now+.42);
      for(const [f,g] of [[2960,.5],[4420,.3],[6180,.18]]){const o=ctx.createOscillator(),a=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(f,now);o.frequency.exponentialRampToValueAtTime(f*.82,now+.4);a.gain.value=g;o.connect(a);a.connect(out.gain);o.start(now);o.stop(now+.43);o.onended=()=>{try{a.disconnect();}catch(_){}};}
      const frames=Math.ceil(ctx.sampleRate*.16),buffer=ctx.createBuffer(1,frames,ctx.sampleRate),data=buffer.getChannelData(0);let s=12345;
      for(let i=0;i<frames;i++){s=(s*1103515245+12345)>>>0;data[i]=(s/4294967296*2-1)*(1-i/frames);}
      const swish=ctx.createBufferSource(),hp=ctx.createBiquadFilter();swish.buffer=buffer;hp.type='highpass';hp.frequency.value=2400;swish.connect(hp);hp.connect(out.gain);swish.start(now);
      swish.onended=()=>setTimeout(()=>{out.stop();try{hp.disconnect();}catch(_){}},450);
    };
    return audio;
  }
  G.MetalVoices={attach};
})(typeof window!=='undefined'?window:globalThis);
