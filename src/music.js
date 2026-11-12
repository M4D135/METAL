/* FERRO — original four-channel ProTracker music, including mathematical PCM.
 * No recordings, imported modules, instrument banks or external dependencies.
 * MOD layout/periods: https://www.aes.id.au/modformat.html
 */
(function (G) {
  'use strict';
  const {sin,exp,tanh,floor,abs,min,max,round,ceil,sign,imul,pow}=Math;
  const CLOCK=7093789.2,RATE=CLOCK/856,TAU=Math.PI*2,MAX_VOICES=28;
  const PERIODS=[856,808,762,720,678,640,604,570,538,508,480,453,428,404,381,360,339,320,302,285,269,254,240,226,214,202,190,180,170,160,151,143,135,127,120,113];
  const SONGS=[{title:'FERRO I - FER NOIR',bpm:100,root:38},{title:'FERRO II - FRACTURE',bpm:170,root:40},{title:'FERRO III - BRAISE',bpm:145,root:45}];
  let instrumentBank=null,percussionBank=null;
  const modules=new Map(),clamp=(x,a,b)=>max(a,min(b,x)),stageOf=x=>clamp(floor(Number(x)||0),0,2);
  const period=midi=>PERIODS[clamp(round(midi)-36,0,35)];
  function random(seed){return ()=>{seed=(imul(seed,1664525)+1013904223)|0;return (seed>>>0)/2147483648-1;};}
  function pcm(data,peak=.84){
    let peakValue=0;for(const v of data)peakValue=max(peakValue,abs(v));
    const out=new Int8Array((data.length+1)&~1),gain=peak*127/(peakValue||1);
    for(let i=2;i<data.length;i++)out[i]=clamp(round(data[i]*gain),-127,127);
    // The first word is reserved by old Amiga replay routines.
    return out;
  }
  function strings(kind,intervals,seconds,seed){
    const rand=random(seed),length=ceil(seconds*RATE),out=new Float32Array(length),bass=kind==='bass',lead=kind==='lead';
    const fundamental=bass?65.4064:130.8128,voices=intervals.map((semitones,index)=>{
      const frequency=fundamental*pow(2,semitones/12)*(1+(index%2?.0013:-.0013)),delay=RATE/frequency-.5,size=ceil(delay)+2,buffer=new Float32Array(size);
      let smooth=0;for(let i=0;i<size;i++){smooth=smooth*.25+rand()*.75;buffer[i]=smooth;}
      return {buffer,size,delay,at:0,last:0};
    });
    let low=0,body=0,dc=0;
    for(let i=0;i<length;i++){
      const t=i/RATE;let sum=0;
      for(let j=0;j<voices.length;j++){
        const v=voices[j],vibrato=lead?1+sin(t*TAU*3.1)*.0018*min(1,t*5):1;
        let read=(v.at-v.delay*vibrato+v.size)%v.size;const a=floor(read),part=read-a;
        const value=v.buffer[a]*(1-part)+v.buffer[(a+1)%v.size]*part;
        const filtered=(value+v.last)*.5;v.last=value;v.buffer[v.at]=filtered*(kind==='palm'?.990:lead?.9992:.9982);v.at=(v.at+1)%v.size;
        sum+=value*(j===0?1:j===1?.72:.45);
      }
      const decay=exp(-t*(kind==='palm'?12:lead?1.05:bass?2.1:1.6)),pick=rand()*exp(-t*220)*(bass?.02:.09);
      const signal=(sum*.95+pick)*min(1,t/.0015),drive=bass?2.1:lead?5.5:10;
      const distorted=tanh(signal*drive),cab=bass?.22:lead?.55:.69;
      low+=cab*(distorted-low);body+=.12*(low-body);dc+=.008*(low-dc);
      out[i]=(bass?low*.72+body*.4:low*.82+body*.25-dc*.65)*decay*min(1,(length-i)/100);
    }
    return pcm(out,bass?.80:.82);
  }
  function drumHit(kind,seed){
    const duration={kick:.32,snare:.27,hat:.10,open:.34,crash:1.25,tom:.32,ride:.29}[kind],out=new Float32Array(ceil(duration*RATE)),rand=random(seed);
    let low=0,phase=0;
    for(let i=0;i<out.length;i++){
      const t=i/RATE,noise=rand();low+=.24*(noise-low);const high=noise-low;let v=0;
      if(kind==='kick'){
        phase+=TAU*(47+128*exp(-t*43))/RATE;
        v=sin(phase)*exp(-t*13)+high*.22*exp(-t*95);
      }else if(kind==='snare')v=high*.72*exp(-t*17)+(sin(t*TAU*183)*.33+sin(t*TAU*327)*.14)*exp(-t*27);
      else if(kind==='tom'){phase+=TAU*(105+63*exp(-t*15))/RATE;v=sin(phase)*exp(-t*12)+high*.10*exp(-t*30);}
      else{
        const metal=(sign(sin(t*TAU*1237))+sign(sin(t*TAU*1871))+sign(sin(t*TAU*2819)))/3;
        const decay=kind==='hat'?48:kind==='open'?15:kind==='ride'?17:4.3;
        v=(high*.7+metal*.3)*exp(-t*decay)*(kind==='crash'?.55:.31);
      }
      out[i]=tanh(v*1.3)*min(1,i/8)*min(1,(out.length-i)/70);
    }
    return out;
  }
  function drumBar(stage,variant,hits){
    const beat=60/SONGS[stage].bpm,step=beat/4,out=new Float32Array(ceil((beat*4+.25)*RATE));
    function hit(kind,row,velocity=1){const at=round(row*step*RATE),data=hits[kind];for(let i=0;i<data.length&&at+i<out.length;i++)out[at+i]+=data[i]*velocity;}
    const fill=variant===3||variant===7,open=variant===2||variant===6;
    if(stage===0){
      for(const r of (variant%2?[0,3,6,8,11,14]:[0,6,10,14]))hit('kick',r,.94);
      for(const r of (open?[8]:[4,12]))hit('snare',r,.76);
      for(let r=0;r<16;r+=2)hit(open?'ride':'hat',r,r%4?.66:.88);
    }else if(stage===1){
      for(const r of (open?[0,2,6,8,10,14]:[0,1,3,6,7,8,10,11,14,15]))hit('kick',r,r%4===0?1:.84);
      hit('snare',4,.83);hit('snare',12,.89);
      for(let r=0;r<16;r+=2)hit(open?'ride':'hat',r,r%4?.70:.95);
      if(variant%2){hit('kick',5,.78);hit('kick',13,.82);}
    }else{
      for(const r of [0,2,3,6,8,10,11,14])hit('kick',r,r%4?.80:.97);
      hit('snare',4,.80);hit('snare',12,.85);
      for(let r=0;r<16;r+=2)hit(open?'ride':'hat',r,r%4?.73:.94);
      if(variant%2)hit('open',15,.65);
    }
    if(variant===0||variant===4)hit('crash',0,.72);
    if(fill){hit('snare',13,.60);hit('tom',14,.73);hit('snare',14.5,.70);hit('tom',15,.81);hit('snare',15.5,.64);}
    for(let i=0;i<out.length;i++)out[i]=tanh(out[i]*1.25)*min(1,(out.length-i)/110);
    return pcm(out,.91);
  }
  function compose(stage,samples){
    const song=SONGS[stage],patterns=Array.from({length:6},()=>new Uint8Array(1024));
    const orders=stage===0?[0,1,0,2,3,1,4,5]:stage===1?[0,1,2,0,3,4,1,5]:[0,1,2,3,0,4,2,5];
    function put(pattern,row,channel,sample,midi,effect=0,param=0){
      const pitch=midi===null?0:period(midi),at=(row*4+channel)*4,p=patterns[pattern];
      p[at]=(sample&240)|(pitch>>8);p[at+1]=pitch&255;p[at+2]=((sample&15)<<4)|effect;p[at+3]=param;
    }
    const roots=stage===0?[[0,0,-2,3],[0,5,3,-2],[0,0,3,5],[5,3,0,-2],[0,3,5,3],[0,-2,3,0]]:stage===1?[[0,0,3,1],[0,5,3,1],[3,1,0,0],[0,0,1,3],[5,3,1,0],[0,3,1,0]]:[[0,-2,-5,-3],[-5,-3,0,0],[0,3,-2,-5],[-3,-5,-2,0],[0,-5,-3,-2],[-5,-3,-2,0]];
    const doom=[[[0,0,2],[3,0,1],[4,0,1],[7,3,1],[8,5,2],[12,0,1],[14,-2,2]],[[0,0,1],[2,0,1],[5,3,2],[8,5,1],[11,3,1],[12,0,2]],[[0,0,2],[8,5,2],[12,3,2],[15,0,1]]];
    const thrash=[[[0,0,1],[1,0,1],[3,0,1],[4,1,1],[6,0,1],[7,0,1],[8,0,1],[10,3,1],[11,0,1],[12,5,2],[14,1,1],[15,0,1]],[[0,0,1],[2,3,1],[3,0,1],[5,1,1],[6,0,1],[8,5,2],[11,3,1],[12,0,1],[14,1,1],[15,0,1]]];
    const gallop=[[0,0,2],[2,0,1],[3,0,1],[4,0,2],[6,0,1],[7,0,1],[8,0,2],[10,0,1],[11,0,1],[12,2,2],[14,0,1],[15,0,1]];
    const melodies=[[62,65,69,67,65,62,60,62],[64,65,67,71,69,67,65,64],[64,67,69,67,64,62,60,62]];
    for(let p=0;p<6;p++)for(let bar=0;bar<4;bar++){
      const start=bar*16,root=song.root+roots[p][bar],riff=stage===0?doom[p===3?2:p%2]:stage===1?thrash[p%2]:gallop;
      for(const [r,offset,sample] of riff){
        const note=clamp(root+offset,36,59);put(p,start+r,0,sample,note,12,sample===2?51:(r%4===0?56:45));
        if(stage!==1||r%2===0||r===15)put(p,start+r,1,4,note,12,r%4===0?49:43);
      }
      // The third track alternates responses, harmonized phrases and octave
      // accents. All voices are present in the exported four-channel score.
      if(p===0&&bar<2){put(p,start,2,2,clamp(root+12,36,71),12,25);put(p,start+6,2,0,null,12,0);}
      else{
        const lead=stage===2||p>=2,spacing=stage===1&&p===4?2:4;
        for(let r=0;r<16;r+=spacing){
          const index=(bar*4+r/spacing+p*2)%8,midi=lead?melodies[stage][index]:clamp(root+12+(r===8?7:0),36,71);
          put(p,start+r,2,lead?(stage===2?(index%3===0?6:5):3):2,midi,12,lead?43:26);
        }
      }
      const kit=(p+bar)%4+(p>=3?4:0);put(p,start,3,7+kit,48);
    }
    // Encode both speed and tempo, so a standalone MOD player starts correctly.
    for(let p=0;p<patterns.length;p++){
      patterns[p][2]= (patterns[p][2]&240)|15;patterns[p][3]=6;
      patterns[p][14]=(patterns[p][14]&240)|15;patterns[p][15]=song.bpm;
    }
    return {title:song.title,patterns,orders,samples};
  }
  function serialize(score){
    const size=1084+score.patterns.length*1024+score.samples.reduce((n,s)=>n+s.pcm.length,0),bytes=new Uint8Array(size);
    const word=(at,v)=>{bytes[at]=v>>8;bytes[at+1]=v&255;},text=(at,s,n)=>{for(let i=0;i<min(n,s.length);i++)bytes[at+i]=s.charCodeAt(i)&127;};
    text(0,score.title,20);
    for(let i=0;i<31;i++){
      const at=20+i*30,s=score.samples[i];
      if(s){text(at,s.name,22);word(at+22,s.pcm.length/2);bytes[at+25]=s.volume;}
      else if(i===28)text(at,'#ORIGINAL SYNTH MUSIC',22);else if(i===29)text(at,'#ALL PCM MADE BY CODE',22);
      word(at+28,1);
    }
    bytes[950]=score.orders.length;bytes[951]=0;bytes.set(score.orders,952);text(1080,'M.K.',4);
    let offset=1084;for(const p of score.patterns){bytes.set(p,offset);offset+=p.length;}
    for(const s of score.samples){bytes.set(new Uint8Array(s.pcm.buffer,s.pcm.byteOffset,s.pcm.length),offset);offset+=s.pcm.length;}
    return bytes;
  }
  function decode(bytes){
    const order=Array.from(bytes.slice(952,952+bytes[950])),count=max(...order)+1,samples=[];let offset=1084+count*1024;
    for(let i=0;i<31;i++){
      const at=20+i*30,length=((bytes[at+22]<<8)|bytes[at+23])*2;
      samples.push({pcm:new Int8Array(bytes.buffer,bytes.byteOffset+offset,length),volume:bytes[at+25]});offset+=length;
    }
    return {bytes,order,samples,bpm:bytes[1099],speed:bytes[1087]};
  }
  function moduleFor(stage){
    stage=stageOf(stage);if(modules.has(stage))return modules.get(stage);
    if(!instrumentBank)instrumentBank=[
      {name:'FER PALM POWER',volume:54,pcm:strings('palm',[0,7,12],.24,313)},
      {name:'FER OPEN POWER',volume:51,pcm:strings('open',[0,7,12],1.65,691)},
      {name:'FER LEAD',volume:44,pcm:strings('lead',[0,12],1.65,1281)},
      {name:'FER BASS',volume:49,pcm:strings('bass',[0,12],.85,701)},
      {name:'FER HARMONY MINOR',volume:40,pcm:strings('lead',[0,3],1.65,1901)},
      {name:'FER HARMONY MAJOR',volume:40,pcm:strings('lead',[0,4],1.65,2171)}
    ];
    const samples=instrumentBank.slice();
    if(!percussionBank){percussionBank={};for(const [i,kind] of ['kick','snare','hat','open','crash','tom','ride'].entries())percussionBank[kind]=drumHit(kind,907+i*113);}
    for(let i=0;i<8;i++)samples.push({name:'FER KIT '+SONGS[stage].bpm+' '+String.fromCharCode(65+i),volume:60,pcm:drumBar(stage,i,percussionBank)});
    const value=decode(serialize(compose(stage,samples)));modules.set(stage,value);return value;
  }
  function getModule(stage){return moduleFor(stage).bytes.slice();}
  function create(ctx,output){
    let stage=0,threat=0,volume=.4,playing=false,disposed=false,module=null,order=0,row=0,nextTime=null,bpm=125,speed=6;
    const voices=new Set(),buffers=new Map(),nodes=[],tracks=[],stats={activeVoices:0,peakVoices:0,scheduledRows:0,scheduledNotes:0,resyncs:0,playing:false,stage:0,order:0,row:0,tempo:100};
    const ready=!!(ctx&&output&&ctx.createBuffer&&ctx.createBufferSource&&ctx.createGain),remember=n=>(nodes.push(n),n);
    const master=ready?remember(ctx.createGain()):null;
    if(master){master.gain.value=0;master.connect(output);for(let i=0;i<4;i++){
      const gain=remember(ctx.createGain()),pan=remember(ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain());
      if(pan.pan)pan.pan.value=[-.32,-.06,.32,.06][i];gain.connect(pan);pan.connect(master);
      tracks.push({gain,voice:null,sample:0,period:428,volume:64});
    }}
    function cleanup(v){if(!voices.delete(v))return;for(const n of [v.source,v.gain])try{n.disconnect();}catch(_){}if(tracks[v.track]?.voice===v)tracks[v.track].voice=null;stats.activeVoices=voices.size;}
    function stopAll(immediate=false){
      if(!ready)return;const now=ctx.currentTime;
      for(const v of Array.from(voices)){
        try{v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(.0001,now,.003);v.source.stop(now+(immediate?0:.015));}catch(_){}
        v.end=now+(immediate?0:.015);if(immediate)cleanup(v);
      }
      for(const t of tracks){t.voice=null;t.sample=0;t.volume=64;}
    }
    function mix(){if(!ready||disposed)return;const now=ctx.currentTime;tracks.forEach((t,i)=>t.gain.gain.setTargetAtTime([.80+threat*.13,.70, .25+threat*.47,.79+threat*.18][i],now,.07));}
    function level(){if(!master||disposed)return;const now=ctx.currentTime;master.gain.cancelScheduledValues(now);master.gain.setTargetAtTime(playing?volume:0,now,.012);}
    function load(){if(module)return;module=moduleFor(stage);bpm=module.bpm;speed=module.speed;stats.tempo=bpm;}
    function buffer(sample){
      if(buffers.has(sample))return buffers.get(sample);
      const data=module.samples[sample-1].pcm,b=ctx.createBuffer(1,data.length,RATE),channel=b.getChannelData(0);for(let i=0;i<data.length;i++)channel[i]=data[i]/128;
      buffers.set(sample,b);return b;
    }
    function note(track,sample,pitch,time){
      const t=tracks[track],instrument=module.samples[sample-1];if(!instrument||instrument.pcm.length<4)return;
      if(t.voice&&t.voice.end>time){const old=t.voice;old.gain.gain.setTargetAtTime(.0001,time,.0015);try{old.source.stop(time+.008);}catch(_){}old.end=time+.008;}
      if(voices.size>=MAX_VOICES)return;
      const source=ctx.createBufferSource(),gain=ctx.createGain(),b=buffer(sample),rate=428/pitch,end=time+b.duration/rate;
      source.buffer=b;source.playbackRate.setValueAtTime(rate,time);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(t.volume/64,time+.0015);
      source.connect(gain);gain.connect(t.gain);
      const v={source,gain,track,end};voices.add(v);t.voice=v;source.onended=()=>cleanup(v);source.start(time);source.stop(end+.001);
      stats.scheduledNotes++;stats.activeVoices=voices.size;stats.peakVoices=max(stats.peakVoices,voices.size);
    }
    function schedule(time){
      const bytes=module.bytes,base=1084+(module.order[order]*64+row)*16,events=[];
      for(let channel=0;channel<4;channel++){
        const at=base+channel*4,a=bytes[at],b=bytes[at+1],c=bytes[at+2],param=bytes[at+3],sample=(a&240)|(c>>4),pitch=((a&15)<<8)|b,effect=c&15;
        if(effect===15&&param){if(param<32)speed=param;else bpm=param;}
        events.push({sample,pitch,effect,param});
      }
      for(let i=0;i<4;i++){
        const e=events[i],t=tracks[i];if(e.sample){t.sample=e.sample;t.volume=module.samples[e.sample-1].volume;}
        if(e.effect===12)t.volume=min(64,e.param);
        if(e.pitch){t.period=e.pitch;note(i,t.sample,e.pitch,time);}
        else if(e.effect===12&&t.voice)t.voice.gain.gain.setTargetAtTime(t.volume/64,time,.002);
      }
      stats.order=order;stats.row=row;stats.tempo=bpm;stats.scheduledRows++;
      row++;if(row===64){row=0;order=(order+1)%module.order.length;}
      return 2.5*speed/bpm;
    }
    function tick(){
      if(!ready||disposed||!playing||volume<=0||ctx.state!=='running')return;
      load();const now=ctx.currentTime;
      for(const v of Array.from(voices))if(v.end<now-.02)cleanup(v);
      if(nextTime===null||nextTime<now-.20){if(nextTime!==null){stopAll();row=floor(row/16)*16;stats.resyncs++;}nextTime=now+.035;}
      let count=0;while(nextTime<now+.28&&count++<6){const at=max(now+.002,nextTime);nextTime+=schedule(at);}
    }
    mix();
    return {
      setStage(value){const next=stageOf(value);if(disposed||next===stage)return;stopAll();stage=next;stats.stage=stage;module=null;buffers.clear();order=row=0;nextTime=null;},
      setThreat(value){const next=clamp(Number(value)||0,0,1);if(disposed||abs(next-threat)<.01)return;threat=next;mix();},
      setVolume(value){if(disposed)return;const next=clamp(Number(value)||0,0,1);if(next===volume)return;volume=next;if(!volume){stopAll();nextTime=null;row=floor(row/16)*16;}level();},
      setPlaying(value){if(disposed||playing===!!value)return;playing=!!value;stats.playing=playing;if(!playing){stopAll();row=floor(row/16)*16;}nextTime=null;level();},
      tick,getModule,stats,
      dispose(){if(disposed)return;stopAll(true);disposed=true;playing=false;stats.playing=false;buffers.clear();for(const n of nodes)try{n.disconnect();}catch(_){}nodes.length=0;}
    };
  }
  G.FMusic={create,getModule};
})(typeof window!=='undefined'?window:globalThis);
