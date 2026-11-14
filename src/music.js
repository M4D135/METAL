/* METAL — original four-channel ProTracker music, including mathematical PCM.
 * No recordings, imported modules, instrument banks or external dependencies.
 * MOD layout/periods: https://www.aes.id.au/modformat.html
 */
(function (G) {
  'use strict';
  const {sin,exp,tanh,floor,abs,min,max,round,ceil,sign,imul,pow}=Math;
  const CLOCK=7093789.2,RATE=CLOCK/856,TAU=Math.PI*2,MAX_VOICES=28;
  const PERIODS=[856,808,762,720,678,640,604,570,538,508,480,453,428,404,381,360,339,320,302,285,269,254,240,226,214,202,190,180,170,160,151,143,135,127,120,113];
  const SONGS=[
    {title:'Fer noir',moduleTitle:'METAL I - FER NOIR',style:'Doom industriel',bpm:100,root:38},
    {title:'Fracture',moduleTitle:'METAL II - FRACTURE',style:'Thrash',bpm:170,root:40},
    {title:'Veille des cendres',moduleTitle:'METAL III - CENDRES',style:'Métal mélodique sombre',bpm:145,root:40}
  ];
  // An independent, original menu composition. Its symbolic key never changes
  // the meaning (or the PCM/score) of the three historical world indices.
  const TITLE_SONG={title:'Furie d’acier',moduleTitle:'METAL - FURIE ACIER',style:'Thrash metal',bpm:212,root:38};
  const TITLE_ORDERS=[0,1,2,1,3,4,5,2,6,4,1,7];
  let instrumentBank=null,titleBank=null,percussionBank=null,tensionSample=null;
  const modules=new Map(),clamp=(x,a,b)=>max(a,min(b,x)),stageOf=x=>x==='title'?'title':clamp(floor(Number(x)||0),0,2),songOf=x=>x==='title'?TITLE_SONG:SONGS[x];
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
    const rand=random(seed),length=ceil(seconds*RATE),out=new Float32Array(length),thrash=kind.startsWith('thrash'),bass=kind==='bass',lead=kind==='lead'||kind==='thrashLead',palm=kind==='palm'||kind==='thrashPalm';
    // A picked string has moving partials, a noisy contact and a short body
    // resonance. Two separately detuned courses drive the amplifier together;
    // distorting a finished sine chord only produces a flat organ-like buzz.
    const fundamental=bass?65.4064:130.8128,voices=intervals.flatMap((semitones,index)=>Array.from({length:bass?1:2},(_,course)=>{
      const frequency=fundamental*pow(2,semitones/12)*(1+(course?1:-1)*(.0014+index*.0004));
      const partials=Array.from({length:min(bass?12:22,floor(RATE*.45/frequency))},(_,h)=>{
        const n=h+1,omega=TAU*frequency*n*Math.sqrt(1+.000035*n*n)/RATE,phase=rand()*.08;
        return {s:sin(phase),c:Math.cos(phase),ds:sin(omega),dc:Math.cos(omega),a:sin(n*.43)/pow(n,bass?1.3:.81),decay:exp(-(.5+h*(palm?.43:.075))/RATE)};
      });return {partials,weight:index===0?1:index===1?.74:.42,delay:(index*1.3+course*.7)/1000};
    }));
    let low=0,body=0,dc=0,pickLow=0;
    for(let i=0;i<length;i++){
      const t=i/RATE;let sum=0;
      for(const v of voices){
        const u=t-v.delay;if(u<0)continue;
        let string=0;for(let h=0;h<v.partials.length;h++){
          const p=v.partials[h],next=p.s*p.dc+p.c*p.ds;p.c=p.c*p.dc-p.s*p.ds;p.s=next;p.a*=p.decay;
          string+=p.s*p.a;
        }
        sum+=string*v.weight*min(1,u/.0018);
      }
      const pick=rand();pickLow+=.2*(pick-pickLow);
      const envelope=palm?exp(-t*12)*(1+.38*exp(-t*55)):exp(-t*(bass?2:lead?.85:1.35));
      const contact=(pick-pickLow)*exp(-t*(palm?90:160))*(bass?.035:thrash?.30:.22),drive=bass?1.7:thrash?5.2:lead?2.9:4.1;
      const amp=tanh((sum*.43+contact)*drive),asymmetric=tanh(amp*1.7+.12)-tanh(.12);
      low+=(bass?.46:.78)*(asymmetric-low);body+=.16*(low-body);dc+=.014*(low-dc);
      const thump=palm?sin(TAU*fundamental*t)*exp(-t*21)*.22:0;
      out[i]=(bass?low*.58+body*.38:low*.91-body*.2-dc*.71+thump)*envelope*min(1,(length-i)/120);
    }
    return pcm(out,bass?.78:.88);
  }
  function drumHit(kind,seed){
    const duration={kick:.32,snare:.27,hat:.10,open:.34,crash:1.25,tom:.32,ride:.29}[kind],out=new Float32Array(ceil(duration*RATE)),rand=random(seed);
    let low=0,phase=0;
    for(let i=0;i<out.length;i++){
      const t=i/RATE,noise=rand();low+=.24*(noise-low);const high=noise-low;let v=0;
      if(kind==='kick'){
        phase+=TAU*(48+150*exp(-t*48))/RATE;
        v=sin(phase)*exp(-t*12)+sin(phase*2)*.21*exp(-t*24)+high*.48*exp(-t*125);
      }else if(kind==='snare')v=(high*.88+noise*.15)*exp(-t*14)+(sin(t*TAU*177)*.43+sin(t*TAU*331)*.17)*exp(-t*23);
      else if(kind==='tom'){phase+=TAU*(105+63*exp(-t*15))/RATE;v=sin(phase)*exp(-t*12)+high*.10*exp(-t*30);}
      else{
        const metal=(sign(sin(t*TAU*1237))+sign(sin(t*TAU*1871))+sign(sin(t*TAU*2819)))/3;
        const decay=kind==='hat'?48:kind==='open'?15:kind==='ride'?17:4.3;
        v=(high*.7+metal*.3)*exp(-t*decay)*(kind==='crash'?.37:.21);
      }
      out[i]=tanh(v*1.3)*min(1,i/8)*min(1,(out.length-i)/70);
    }
    return out;
  }
  function drumBar(stage,variant,hits){
    const beat=60/SONGS[stage].bpm,step=beat/4,out=new Float32Array(ceil((beat*4+.25)*RATE));
    function hit(kind,row,velocity=1){const at=round(row*step*RATE),data=hits[kind];for(let i=0;i<data.length&&at+i<out.length;i++)out[at+i]+=data[i]*velocity;}
    const fill=variant===3||variant===7,open=variant===2||variant===6;
    if(variant===4){
      // A real stop/drop, including space after the downbeat, not merely a
      // lower master gain over the same incessant drum loop.
      hit('kick',0,1.1);hit('crash',0,.55);hit('snare',8,.9);hit('kick',10,.82);hit('kick',14,.95);
      for(const r of [2,6,10,14])hit('hat',r,.44);
    }else if(variant===5){
      for(const r of [0,6,8,11,14])hit('kick',r,.9);
      for(const r of [4,12,13,14,15,15.5])hit('snare',r,.48+r*.025);
      for(let r=0;r<16;r+=2)hit('hat',r,.45);hit('tom',15,.7);
    }else
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
    if(variant===0||variant===6)hit('crash',0,.68);
    if(fill){hit('snare',13,.60);hit('tom',14,.73);hit('snare',14.5,.70);hit('tom',15,.81);hit('snare',15.5,.64);}
    for(let i=0;i<out.length;i++)out[i]=tanh(out[i]*1.25)*min(1,(out.length-i)/110);
    return pcm(out,.91);
  }
  function titleDrumBar(variant,hits){
    const beat=60/TITLE_SONG.bpm,step=beat/4,out=new Float32Array(ceil((beat*4+.25)*RATE));
    function hit(kind,row,velocity=1){const at=round(row*step*RATE),data=hits[kind];for(let i=0;i<data.length&&at+i<out.length;i++)out[at+i]+=data[i]*velocity;}
    // Separate picked accents and alternating kick strokes keep the double
    // bass readable. The stop section really leaves space before its answer.
    const kickRows=variant===4?[0,1,6,7,10,14]:variant===5?[0,2,3,6,8,10,11,14]:
      variant===2||variant===6?Array.from({length:16},(_,i)=>i):variant===1?[0,1,3,5,6,7,8,9,11,13,14,15]:[0,1,2,3,6,7,8,9,10,11,14,15];
    for(const row of kickRows)hit('kick',row,row%4===0?1.03:row%2?.77:.9);
    for(const row of (variant===4?[8]:[4,12]))hit('snare',row,.95);
    if(variant===4){for(const row of [0,4,8,12])hit('ride',row,.53);hit('crash',0,.52);}
    else for(let row=0;row<16;row+=2)hit(variant===2||variant===6?'ride':'hat',row,row%4?.60:.84);
    if(variant===0||variant===6)hit('crash',0,.68);
    if(variant===1)hit('open',15,.52);
    if(variant===3||variant===7){
      for(const row of [12.5,13,13.5])hit('snare',row,.55+(row-12)*.15);
      for(const row of [14,14.5,15])hit('tom',row,.8);
      hit('snare',15.5,.73);
    }else if(variant===5){
      for(const row of [10,11,12,13,14,15])hit('snare',row,.35+(row-10)*.08);
      hit('tom',15.5,.85);
    }
    for(let i=0;i<out.length;i++)out[i]=tanh(out[i]*1.15)*min(1,(out.length-i)/110);
    return pcm(out,.89);
  }
  function compose(stage,samples){
    const song=SONGS[stage],patterns=Array.from({length:6},()=>new Uint8Array(1024));
    // Four-bar phrases: opening impact, riff, answer, breakdown, climax, turn.
    // The third channel leaves holes for the rhythm section, then answers it.
    const orders=stage===0?[0,1,2,1,3,1,4,5]:stage===1?[0,1,2,1,3,4,1,5]:[0,1,2,3,1,4,2,5];
    function put(pattern,row,channel,sample,midi,effect=0,param=0){
      const pitch=midi===null?0:period(midi),at=(row*4+channel)*4,p=patterns[pattern];
      p[at]=(sample&240)|(pitch>>8);p[at+1]=pitch&255;p[at+2]=((sample&15)<<4)|effect;p[at+3]=param;
    }
    const roots=stage===0?[[0,0,1,-2],[0,0,3,1],[0,5,1,0],[0,1,6,0],[0,3,1,5],[0,1,-2,0]]:
      stage===1?[[0,0,1,6],[0,0,3,1],[3,1,0,0],[0,6,1,0],[0,3,1,5],[0,1,3,0]]:
      [[0,0,-2,1],[0,-2,3,1],[0,3,-2,5],[0,1,-2,0],[0,3,5,1],[3,1,-2,0]];
    const doom=[[[0,0,2],[3,0,1],[6,0,1],[8,0,1],[11,1,1],[14,-2,2]],
      [[0,0,1],[2,0,1],[6,3,2],[8,0,1],[11,0,1],[14,1,2]]];
    const thrash=[[[0,0,1],[1,0,1],[3,0,1],[4,1,1],[6,0,1],[7,0,1],[8,0,1],[10,3,1],[11,0,1],[12,0,1],[14,1,1],[15,0,1]],
      [[0,0,1],[2,0,1],[3,0,1],[4,3,2],[6,0,1],[7,0,1],[8,0,1],[9,0,1],[11,1,1],[12,0,1],[14,6,1],[15,1,1]]];
    const gallop=[[0,0,2],[2,0,1],[3,0,1],[4,0,1],[6,0,1],[7,0,1],[8,0,2],[10,0,1],[11,0,1],[12,1,2],[14,0,1],[15,0,1]];
    const breakRiff=[[0,0,2],[6,0,1],[8,1,2],[14,0,1]];
    const melodies=[[62,65,63,62,68,65,63,60],[64,65,70,67,65,64,62,64],[64,67,65,71,69,67,65,62]];
    for(let p=0;p<6;p++)for(let bar=0;bar<4;bar++){
      const start=bar*16,root=song.root+roots[p][bar],drop=p===3;
      let riff=drop?breakRiff:stage===0?doom[(p+bar)%2]:stage===1?thrash[(p+bar)%2]:gallop;
      if(p===0&&bar===0)riff=stage===0?[[0,0,2],[8,0,1],[11,0,1],[14,1,2]]:riff;
      for(const [r,offset,sample] of riff){
        const note=clamp(root+offset,36,59),accent=r%4===0;
        put(p,start+r,0,sample,note,12,sample===2?56:accent?59:48);
        if(stage!==1||r%2===0||r===15)put(p,start+r,1,4,note,12,accent?53:45);
      }
      if(drop){
        for(const r of [3,11]){put(p,start+r,0,0,null,12,0);put(p,start+r,1,0,null,12,0);}
        put(p,start,2,15,clamp(root+12,36,71),12,bar%2?31:24);
        put(p,start+10,2,0,null,12,0);
      }else if(p===0||p===1){
        // Short unison answers provide size without a constant bright solo.
        if(bar%2||p===0&&bar===0){put(p,start,2,2,clamp(root,36,71),12,35);put(p,start+3,2,0,null,12,0);}
        if(bar%2)put(p,start+12,2,3,clamp(root+19,36,71),12,31);
      }else if(stage===2){
        for(let r=0;r<16;r+=4){
          const index=(bar*3+r/4+p)%8,midi=melodies[stage][index],degree=(midi-song.root+120)%12;
          // Diatonic thirds in E Phrygian: E–G / F–A / G–B / A–C /
          // B–D / C–E / D–F. The bass remains dark; harmony is intentional.
          put(p,start+r,2,[1,3,8].includes(degree)?6:5,midi,12,r===0?41:34);
        }
      }else if(p===4||p===5){
        for(const r of [0,6,8,14]){const index=(bar*2+(r>>2)+p)%8;put(p,start+r,2,3,melodies[stage][index],12,r===0?38:31);}
      }else{
        put(p,start+4,2,2,clamp(root+12,36,71),12,34);put(p,start+7,2,0,null,12,0);
        put(p,start+12,2,3,clamp(root+18,36,71),12,29);
      }
      const kit=drop?(bar===3?5:4):bar===3?(p===5?7:3):p===4?6:(p+bar)%3;
      put(p,start,3,7+kit,48,12,drop?56:61);
      if(p===5&&bar===3){for(const ch of [0,1,2])put(p,start+15,ch,0,null,12,0);}
    }
    for(let p=0;p<patterns.length;p++){
      patterns[p][2]=(patterns[p][2]&240)|15;patterns[p][3]=6;
      patterns[p][14]=(patterns[p][14]&240)|15;patterns[p][15]=song.bpm;
    }
    return {title:song.moduleTitle,patterns,orders,samples};
  }
  function composeTitle(samples){
    const patterns=Array.from({length:8},()=>new Uint8Array(1024));
    function put(p,row,ch,sample,midi,effect=12,param=54){
      const pitch=midi===null?0:period(midi),at=(row*4+ch)*4,bytes=patterns[p];
      bytes[at]=(sample&240)|(pitch>>8);bytes[at+1]=pitch&255;bytes[at+2]=((sample&15)<<4)|effect;bytes[at+3]=param;
    }
    // Original asymmetric 3+3+2 answers over a low pedal, not a transcription
    // of a recording. Repeated notes are new picked attacks, never a held pad.
    const riffs=[
      [[0,0,2],[2,0,1],[3,0,1],[5,3,1],[6,0,1],[7,0,1],[8,5,2],[10,0,1],[11,0,1],[13,1,1],[14,0,1],[15,0,1]],
      [[0,0,1],[1,0,1],[3,0,1],[4,3,2],[6,0,1],[7,0,1],[8,0,1],[10,5,1],[11,0,1],[12,1,2],[14,0,1],[15,0,1]],
      [[0,0,2],[1,0,1],[2,0,1],[3,0,1],[4,7,1],[5,0,1],[6,3,1],[7,0,1],[8,0,2],[10,6,1],[11,5,1],[12,0,1],[13,0,1],[14,1,1],[15,3,1]],
      [[0,0,2],[6,0,1],[7,0,1],[10,3,2],[14,1,1]],
      [[0,0,2],[1,0,1],[2,0,1],[3,0,1],[4,0,1],[5,0,1],[6,5,2],[8,0,1],[9,0,1],[10,0,1],[11,0,1],[12,3,2],[14,1,1],[15,0,1]],
      [[0,0,2],[2,0,1],[3,0,1],[4,0,1],[6,3,1],[7,0,1],[8,0,2],[10,0,1],[11,0,1],[12,5,1],[14,1,1],[15,0,1]],
      [[0,0,2],[3,0,1],[4,1,2],[6,0,1],[7,0,1],[8,5,2],[10,0,1],[11,0,1],[12,3,2],[14,0,1],[15,1,1]],
      [[0,0,2],[1,0,1],[3,0,1],[4,5,2],[6,0,1],[7,0,1],[8,3,2],[10,0,1],[11,0,1],[12,1,2],[14,0,1]]
    ];
    const shifts=[[0,0,3,1],[0,0,5,3],[0,3,1,0],[0,0,1,3],[0,0,3,5],[0,3,5,1],[5,3,1,0],[0,3,1,0]];
    const solo=[62,65,69,67,64,65,70,69,67,62,64,61,65,64,60,62];
    for(let p=0;p<8;p++)for(let bar=0;bar<4;bar++){
      const start=bar*16,root=TITLE_SONG.root+shifts[p][bar],drop=p===3,riff=riffs[p];
      for(const [r,offset,sample] of riff){
        const midi=root+offset,accent=r%4===0;
        put(p,start+r,0,sample,midi,12,sample===2?57:accent?60:49);
        if(drop||r%2===0||r===15)put(p,start+r,1,4,midi,12,accent?52:43);
        if(p!==5&&p!==6)put(p,start+r,2,sample===1?16:17,midi,12,sample===2?42:accent?40:33);
      }
      if(drop){
        for(const r of [3,9,13])for(const ch of [0,1,2])put(p,start+r,ch,0,null,12,0);
        put(p,start+10,2,15,root+12,12,26);
      }else if(p===5){
        for(let r=0;r<16;r+=2)put(p,start+r,2,3,solo[(bar*5+r/2)%solo.length],12,r%4?34:41);
        // Brief articulated holes at phrase ends prevent an endless solo bed.
        if(bar%2)put(p,start+15,2,0,null,12,0);
      }else if(p===6){
        for(const r of [0,3,6,8,11,14])put(p,start+r,2,r===8?2:3,root+12+[0,7,3,10,5,1][[0,3,6,8,11,14].indexOf(r)],12,r===0?40:32);
      }
      const kit=drop?(bar===3?5:4):bar===3?(p===7?7:3):p===4?6:p===2?2:(p+bar)%2;
      put(p,start,3,7+kit,48,12,61);
      if(p===7&&bar===3)for(const ch of [0,1,2])put(p,start+15,ch,0,null,12,0);
    }
    for(const p of patterns){p[2]=(p[2]&240)|15;p[3]=6;p[14]=(p[14]&240)|15;p[15]=TITLE_SONG.bpm;}
    return {title:TITLE_SONG.moduleTitle,patterns,orders:TITLE_ORDERS,samples};
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
  const INSTRUMENTS=[
    ['MTL PALM POWER',58,'palm',[0,7,12],.29,313],
    ['MTL OPEN POWER',56,'open',[0,7,12],1.7,691],
    ['MTL LEAD',40,'lead',[0],1.5,1281],
    ['MTL BASS',52,'bass',[0,12],.95,701],
    ['MTL MINOR THIRD',40,'lead',[0,3],1.5,1901],
    ['MTL MAJOR THIRD',40,'lead',[0,4],1.5,2171]
  ];
  function instrument(index){
    if(!instrumentBank)instrumentBank=[];
    if(!instrumentBank[index]){const [name,volume,kind,notes,seconds,seed]=INSTRUMENTS[index];instrumentBank[index]={name,volume,pcm:strings(kind,notes,seconds,seed)};}
    return instrumentBank[index];
  }
  function titleInstrument(index){
    if(!titleBank)titleBank=[];
    if(!titleBank[index]){
      const settings=[['MTL THRASH PALM','thrashPalm',[0,7,12],.27,5917],['MTL THRASH POWER','thrashOpen',[0,7,12],1.3,6043],['MTL THRASH LEAD','thrashLead',[0],1.05,6269],['MTL THRASH PALM R','thrashPalm',[0,7,12],.27,6421],['MTL THRASH POWER R','thrashOpen',[0,7,12],1.3,6653]][index];
      const [name,kind,notes,seconds,seed]=settings;
      titleBank[index]={name,volume:index===2?39:57,pcm:strings(kind,notes,seconds,seed)};
    }
    return titleBank[index];
  }
  let preparation=Promise.resolve();const preparing=new Map();
  function warmup(stage){
    stage=stageOf(stage);
    const info=()=>({...getTrack(stage),bytes:moduleFor(stage).bytes.length});
    if(modules.has(stage))return Promise.resolve(info());
    if(preparing.has(stage))return preparing.get(stage);
    const pause=()=>new Promise(resolve=>typeof G.setTimeout==='function'?G.setTimeout(resolve,0):resolve());
    const task=preparation.then(async()=>{
      // Instrument-sized jobs let a loading screen paint between expensive
      // synthesis steps. This prepares PCM/score only: no device is opened.
      for(let i=0;i<6;i++)if(!instrumentBank?.[i]){await pause();instrument(i);}
      if(stage==='title')for(let i=0;i<5;i++)if(!titleBank?.[i]){await pause();titleInstrument(i);}
      if(!tensionSample){await pause();tensionSample={name:'MTL TRITONE SCRAPE',volume:32,pcm:strings('open',[0,6,12],1.85,4101)};}
      const steps=moduleSteps(stage);
      if(steps)for(const phase of steps.phases){await pause();phase();}
      await pause();return info();
    });
    preparing.set(stage,task);preparation=task.catch(()=>{});
    task.then(()=>preparing.delete(stage),()=>preparing.delete(stage));return task;
  }
  function moduleSteps(stage){
    // LOAD-13: the expensive phases of a module — drum kit, compose, serialize,
    // decode — are separate resumable sub-tasks, so warmup can yield between them
    // and a loading screen paints inside the budget. The kit is itself cut per
    // bar: eight bars and a crash sample in one block were the last slice that
    // no audio budget could cover (19 to 22 ms on the title). `phases` is the
    // fine-grained list warmup walks; kit/compose/serialize/decode stay the
    // coarse API moduleFor uses, and run exactly the same calls in order.
    // Running them back to back is exactly what moduleFor always did.
    stage=stageOf(stage);if(modules.has(stage))return null;
    const title=stage==='title',song=songOf(stage),built={title,samples:Array.from({length:6},(_,i)=>title&&i<3?titleInstrument(i):instrument(i)),score:null,bytes:null};
    const kitPhases=[];
    for(const [i,kind] of ['kick','snare','hat','open','crash','tom','ride'].entries())kitPhases.push(function kitDrum(){
      if(!percussionBank)percussionBank={};
      if(!percussionBank[kind])percussionBank[kind]=drumHit(kind,907+i*113);
    });
    for(let i=0;i<8;i++){const bar=i;kitPhases.push(function kitBar(){built.samples.push({name:'MTL KIT '+song.bpm+' '+String.fromCharCode(65+bar),volume:60,pcm:title?titleDrumBar(bar,percussionBank):drumBar(stage,bar,percussionBank)});});}
    kitPhases.push(function kitExtras(){
      if(!tensionSample)tensionSample={name:'MTL TRITONE SCRAPE',volume:32,pcm:strings('open',[0,6,12],1.85,4101)};
      built.samples.push(tensionSample);
      if(title)built.samples.push(titleInstrument(3),titleInstrument(4));
    });
    const composePhase=function(){built.score=title?composeTitle(built.samples):compose(stage,built.samples);};
    const serializePhase=function(){built.bytes=serialize(built.score);};
    const decodePhase=function(){if(!modules.has(stage))modules.set(stage,decode(built.bytes));};
    return {
      kit(){for(const phase of kitPhases)phase();},
      compose(){composePhase();},
      serialize(){serializePhase();},
      decode(){decodePhase();},
      phases:kitPhases.concat([composePhase,serializePhase,decodePhase])
    };
  }
  function moduleFor(stage){
    stage=stageOf(stage);
    const steps=moduleSteps(stage);
    if(steps){steps.kit();steps.compose();steps.serialize();steps.decode();}
    return modules.get(stage);
  }
  function getModule(stage){return moduleFor(stage).bytes.slice();}
  function getTrack(stage){stage=stageOf(stage);const song=songOf(stage);return {title:song.title,bpm:song.bpm,style:song.style,duration:(stage==='title'?TITLE_ORDERS.length*960:7680)/song.bpm,channels:4};}
  function create(ctx,output){
    let stage=0,threat=0,volume=.4,playing=false,disposed=false,module=null,order=0,row=0,nextTime=null,bpm=125,speed=6;
    const voices=new Set(),buffers=new Map(),nodes=[],tracks=[],stats={activeVoices:0,peakVoices:0,scheduledRows:0,scheduledNotes:0,resyncs:0,playing:false,stage:0,order:0,row:0,tempo:100};
    const events=Array.from({length:4},()=>({sample:0,pitch:0,effect:0,param:0}));
    const ready=!!(ctx&&output&&ctx.createBuffer&&ctx.createBufferSource&&ctx.createGain),remember=n=>(nodes.push(n),n);
    // MIX-11: un contexte hors ligne (OfflineAudioContext) na jamais dhorloge ni
    // de peripherique a attendre : il est « en cours » des la creation, ce qui
    // laisse le banc rendre le meme morceau que le jeu. Un AudioContext normal
    // na pas de startRendering et garde donc la meme regle quavant.
    const offline=!!(ctx&&typeof ctx.startRendering==='function');
    const master=ready?remember(ctx.createGain()):null;
    if(master){master.gain.value=0;master.connect(output);for(let i=0;i<4;i++){
      const gain=remember(ctx.createGain()),pan=remember(ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain());
      if(pan.pan)pan.pan.value=[-.32,-.06,.32,.06][i];gain.connect(pan);pan.connect(master);
      tracks.push({gain,voice:null,sample:0,period:428,volume:64});
    }}
    function cleanup(v){if(!voices.delete(v))return;for(const n of [v.source,v.gain])try{n.disconnect();}catch(_){}if(tracks[v.track]?.voice===v)tracks[v.track].voice=null;stats.activeVoices=voices.size;}
    function stopAll(immediate=false){
      if(!ready)return;const now=ctx.currentTime;
      for(const v of voices){
        try{v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(.0001,now,.003);v.source.stop(now+(immediate?0:.015));}catch(_){}
        v.end=now+(immediate?0:.015);if(immediate)cleanup(v);
      }
      for(const t of tracks){t.voice=null;t.sample=0;t.volume=64;}
    }
    function mix(){if(!ready||disposed)return;const now=ctx.currentTime,levels=stage==='title'?[.86,.72,.52,.93]:[.94+threat*.04,.78,.30+threat*.22,.95+threat*.08];tracks.forEach((t,i)=>t.gain.gain.setTargetAtTime(levels[i],now,.07));}
    function level(){if(!master||disposed)return;const now=ctx.currentTime;master.gain.cancelScheduledValues(now);master.gain.setTargetAtTime(playing?volume:0,now,.012);}
    function load(){if(module)return;module=moduleFor(stage);bpm=module.bpm;speed=module.speed;stats.tempo=bpm;}
    function buffer(sample,whichStage=stage){
      const key=(whichStage==='title'?3:whichStage)*32+sample;if(buffers.has(key))return buffers.get(key);
      const score=whichStage===stage&&module?module:moduleFor(whichStage),data=score.samples[sample-1].pcm,b=ctx.createBuffer(1,data.length,RATE),channel=b.getChannelData(0);for(let i=0;i<data.length;i++)channel[i]=data[i]/128;
      buffers.set(key,b);return b;
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
      const bytes=module.bytes,base=1084+(module.order[order]*64+row)*16;
      // RESTE-09: the four channel records of a row are allocated once per
      // instance and refilled, so a scheduled row allocates nothing.
      for(let channel=0;channel<4;channel++){
        const at=base+channel*4,a=bytes[at],b=bytes[at+1],c=bytes[at+2],param=bytes[at+3],e=events[channel];
        e.sample=(a&240)|(c>>4);e.pitch=((a&15)<<8)|b;e.effect=c&15;e.param=param;
        if(e.effect===15&&param){if(param<32)speed=param;else bpm=param;}
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
      if(!ready||disposed||!playing||volume<=0||(!offline&&ctx.state!=='running'))return;
      load();const now=ctx.currentTime;
      // RESTE-09: deleting the current entry of a Set during for…of is defined
      // and keeps insertion order, so the same voices are cleaned in the same
      // order with no per-frame array allocation.
      for(const v of voices)if(v.end<now-.02)cleanup(v);
      if(nextTime===null||nextTime<now-.20){if(nextTime!==null){stopAll();row=floor(row/16)*16;stats.resyncs++;}nextTime=now+.035;}
      let count=0;while(nextTime<now+.28&&count++<6){const at=max(now+.002,nextTime);nextTime+=schedule(at);}
    }
    mix();
    return {
      setStage(value){const next=stageOf(value);if(disposed||next===stage)return;stopAll();stage=next;stats.stage=stage;module=null;order=row=0;nextTime=null;mix();},
      setThreat(value){const next=clamp(Number(value)||0,0,1);if(disposed||abs(next-threat)<.01)return;threat=next;mix();},
      setVolume(value){if(disposed)return;const next=clamp(Number(value)||0,0,1);if(next===volume)return;volume=next;if(!volume){stopAll();nextTime=null;row=floor(row/16)*16;}level();},
      setPlaying(value){if(disposed||playing===!!value)return;playing=!!value;stats.playing=playing;if(!playing){stopAll();row=floor(row/16)*16;}nextTime=null;level();},
      prepare(value=stage){
        if(!ready||disposed)return false;const next=stageOf(value),score=moduleFor(next);
        // Three world banks plus the independent title bank, retained across changes.
        // Loading a future bank does not seek, switch stage or start any notes.
        for(let i=0;i<score.samples.length;i++)if(score.samples[i].pcm.length>2)buffer(i+1,next);
        return true;
      },
      tick,getModule,getTrack,stats,
      dispose(){if(disposed)return;stopAll(true);disposed=true;playing=false;stats.playing=false;buffers.clear();for(const n of nodes)try{n.disconnect();}catch(_){}nodes.length=0;}
    };
  }
  G.FMusic={create,getModule,getTrack,warmup};
})(typeof window!=='undefined'?window:globalThis);
