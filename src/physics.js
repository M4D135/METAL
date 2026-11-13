/* FERRO — FPhysics: deterministic rigid bodies (oriented boxes, spheres, capsules) against static boxes.
   Rules: no clock, no random source; Math.sqrt/abs/floor/imul/min/max only (trig only in TRIG blocks);
   fixed iteration order; typed arrays; no allocation per step; canonical derived values; -0 normalised.
   Determinism, the five writing rules:
   1. Math: sqrt, abs, floor, imul, min, max and PI only; sin, cos, atan2 and asin only between the TRIG
      markers (angle conversions, joint limits), never in the solver; no exponent operator.
   2. Fixed order: bodies by increasing index, grid cells z then x, statics by index, contacts in emission
      order, joints by slot; no Map, Set, sort or key enumeration inside step().
   3. Canonical derived values: inertia, rotation, bounds and tolerance come from one function each, called
      at creation, at the end of a sub-step and on restore, from saved values only (inverse mass, never 1/(1/m)).
   4. The fingerprint covers every setting; a snapshot carries it.
   5. -0 is normalised by x+0 at the end of each sub-step, in the impulse cache and in joints.
   Time only enters through dt: the same calls with the same arguments give the same bits. */
(function(G){
  'use strict';
  // Material id = index (the host game keeps the same order).
  const MATERIALS=Object.freeze([
    Object.freeze({name:'metal',friction:.45,restitution:.24,density:65}),
    Object.freeze({name:'stone',friction:.7,restitution:.16,density:28}),
    Object.freeze({name:'wood',friction:.55,restitution:.22,density:8}),
    Object.freeze({name:'glass',friction:.35,restitution:.16,density:25}),
    Object.freeze({name:'dirt',friction:.8,restitution:.05,density:12})
  ]);
  const I32=2147483647;
  // Settings after bounds, in fingerprint order: [name, default, kind, low, high].
  // Kinds: f finite, p > 0, z >= 0, g null or finite, i integer in [low, high].
  // Integer limits keep encodings exact: body handle gen*4096+index, joint handle gen*4096+slot,
  // pair key lo*(capacity+maxStatics+2)+hi below 2^31.
  const SETTINGS=[
    ['cell',2,'p'],['gravity',-12,'f'],['ground',null,'g'],['floorThickness',.5,'p'],['minY',-60,'f'],['tick',1/120,'p'],
    ['maxSubsteps',8,'i',1,I32],['capacity',384,'i',1,4095],['maxStatics',4096,'i',1,65535],['maxContacts',16384,'i',1,1048576],
    ['maxJoints',128,'i',0,4095],['iterations',2,'i',1,I32],['relaxIterations',1,'i',0,I32],['hardIterations',4,'i',0,I32],
    ['hardRelaxIterations',2,'i',0,I32],['hardRatio',8,'z'],['contactHertz',30,'p'],['dampingRatio',10,'z'],['pushout',3,'z'],
    ['restitutionThreshold',1,'z'],['jointHertz',60,'p'],['jointDampingRatio',2,'z'],['linearDamping',.02,'z'],
    ['angularDamping',.06,'z'],['rollingDamping',2,'z'],['maxLinear',40,'p'],['maxAngular',30,'p'],['margin',.02,'z'],
    ['slop',.005,'z'],['slopRatio',.12,'z'],['minHalf',.02,'z'],['sleepLinear',.08,'z'],['sleepAngular',.12,'z'],
    ['sleepTime',.5,'z'],['splitTime',1,'z'],['fallbackTime',6,'z'],['fallbackDistance',.002,'z'],['wakeSpeed',.25,'z'],
    ['supportSpeed',.08,'z'],['massMin',3,'p'],['massMax',120,'p'],['maxAwake',160,'i',0,I32],['spawnBudget',24,'i',1,I32],
    ['eventSpeed',1.2,'z'],['maxEvents',16,'i',0,I32]
  ];
  const fail=text=>{throw new TypeError('FPhysics.create: '+text);};
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  // FNV-1a 32 bits over character codes, as 8 hex digits.
  function textHash(text){
    let h=2166136261;
    for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
    return (h>>>0).toString(16).padStart(8,'0');
  }
  // Validated settings (-0 normalised), plus durations converted to whole sub-steps.
  function settings(o){
    if(!o||typeof o!=='object')fail('options object with bounds required');
    const b=o.bounds;
    if(!b||typeof b!=='object')fail('bounds {minX, maxX, minZ, maxZ} required');
    for(const k of ['minX','maxX','minZ','maxZ'])if(!finite(b[k]))fail('bounds.'+k+' must be a finite number');
    if(!(b.minX<b.maxX&&b.minZ<b.maxZ))fail('bounds need minX < maxX and minZ < maxZ');
    const c={bounds:Object.freeze({minX:b.minX+0,maxX:b.maxX+0,minZ:b.minZ+0,maxZ:b.maxZ+0})};
    for(const [name,def,kind,low,high] of SETTINGS){
      let v=o[name];
      if(v===undefined||kind==='g'&&v===null)v=def;
      else if(!finite(v))fail(name+' must be a finite number'+(kind==='g'?' or null':''));
      else if(kind==='p'&&!(v>0))fail(name+' must be > 0');
      else if(kind==='z'&&!(v>=0))fail(name+' must be >= 0');
      else if(kind==='i'&&!(Number.isInteger(v)&&v>=low&&v<=high))fail(name+' must be an integer from '+low+' to '+high);
      c[name]=v===null?null:v+0;
    }
    if(c.massMin>c.massMax)fail('massMin must not exceed massMax');
    const t=c.tick,steps=d=>Math.floor(d/t+.5);
    c.sleepSteps=steps(c.sleepTime);c.splitSteps=steps(c.splitTime);c.fallbackSteps=steps(c.fallbackTime);c.windowSteps=steps(1);
    // clock (bench only, never part of the state) is checked here and kept out of config.
    if(o.clock!==undefined&&o.clock!==null&&typeof o.clock!=='function')fail('clock must be a function or null');
    return Object.freeze(c);
  }
  // Fingerprint: FNV-1a of 'FPhysics2|' + settings in table order, bounds flat, ground 'none' when null.
  function fingerprintOf(c){
    const b=c.bounds,values=[b.minX,b.maxX,b.minZ,b.maxZ];
    for(const s of SETTINGS)values.push(c[s[0]]===null?'none':c[s[0]]);
    return textHash('FPhysics2|'+values.join('|'));
  }
  function create(o){
    const C=settings(o);
    return {config:C,fingerprint:fingerprintOf(C)};
  }
  // TRIG-BEGIN
  // Angle conversions, game convention: rotation [rx, ry, rz] with M = Rz*Ry*Rx (outside step only).
  function eulerToQuat(rx,ry,rz,out=[0,0,0,0]){
    const cx=Math.cos(rx/2),sx=Math.sin(rx/2),cy=Math.cos(ry/2),sy=Math.sin(ry/2),cz=Math.cos(rz/2),sz=Math.sin(rz/2);
    out[0]=cz*cy*sx-sz*sy*cx;out[1]=cz*sy*cx+sz*cy*sx;out[2]=sz*cy*cx-cz*sy*sx;out[3]=cz*cy*cx+sz*sy*sx;
    return out;
  }
  function quatToEuler(x,y,z,w,out=[0,0,0]){
    const r0=1-2*(y*y+z*z),r1=2*(x*y-w*z),r3=2*(x*y+w*z),r4=1-2*(x*x+z*z),r6=2*(x*z-w*y),r7=2*(y*z+w*x),r8=1-2*(x*x+y*y);
    const m=Math.max(-1,Math.min(1,-r6));
    out[1]=Math.asin(m);
    if(Math.abs(m)<.9999999){out[0]=Math.atan2(r7,r8);out[2]=Math.atan2(r3,r0);}
    else{out[0]=0;out[2]=Math.atan2(-r1,r4);}
    return out;
  }
  // TRIG-END
  G.FPhysics={VERSION:2,MATERIALS,create,eulerToQuat,quatToEuler};
})(typeof window!=='undefined'?window:globalThis);
