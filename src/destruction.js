/* FERRO — persistent local demolition, without a voxel world or imported assets. */
(function(G){
  'use strict';
  const EPS=1e-6,MAX_PARTS=12,MAX_CUTS=12,MAX_DEBRIS=48,KEYS=['minX','maxX','minY','maxY','minZ','maxZ'];
  const finite=Number.isFinite,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const validPoint=p=>Array.isArray(p)&&p.length===3&&p.every(finite);
  const volume=b=>Math.max(0,b.maxX-b.minX)*Math.max(0,b.maxY-b.minY)*Math.max(0,b.maxZ-b.minZ);
  const copyBox=b=>Object.fromEntries(KEYS.map(k=>[k,b[k]]));
  const overlaps=(a,b)=>a.minX<b.maxX-EPS&&a.maxX>b.minX+EPS&&a.minY<b.maxY-EPS&&a.maxY>b.minY+EPS&&a.minZ<b.maxZ-EPS&&a.maxZ>b.minZ+EPS;
  const distance=(p,b)=>Math.hypot(Math.max(b.minX-p[0],0,p[0]-b.maxX),Math.max(b.minY-p[1],0,p[1]-b.maxY),Math.max(b.minZ-p[2],0,p[2]-b.maxZ));
  let foliageSource,foliageFaces;
  function sharedFoliage(){
    const triangles=G.FRender?.foliageTriangles?.();
    if(!Array.isArray(triangles)||!triangles.length)throw new Error('Foliage destruction requires the shared FRender geometry.');
    if(triangles===foliageSource)return foliageFaces;
    foliageSource=triangles;
    // One shared set of edges for the whole scene, not 72 copied triangles per
    // tree. The renderer and shots use exactly the same irregular silhouette.
    foliageFaces=triangles.map(([a,b,c])=>{
      const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
      return {a,ab,ac,n:[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]};
    });
    return foliageFaces;
  }
  function rotation(r=[0,0,0]){
    const [x,y,z]=r,a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
    return [e*c,e*d*b-f*a,e*d*a+f*b,f*c,f*d*b+e*a,f*d*a-e*b,-d,c*b,c*a];
  }
  function bounds(m){
    const a=rotation(m.r),p=m.p||[0,0,0],s=m.s||[1,1,1],h=[0,1,2].map(i=>(Math.abs(a[i*3]*s[0])+Math.abs(a[i*3+1]*s[1])+Math.abs(a[i*3+2]*s[2]))/2);
    return {minX:p[0]-h[0],maxX:p[0]+h[0],minY:p[1]-h[1],maxY:p[1]+h[1],minZ:p[2]-h[2],maxZ:p[2]+h[2]};
  }
  function union(boxes){return Object.fromEntries(KEYS.map(k=>[k,Math[k.startsWith('min')?'min':'max'](...boxes.map(b=>b[k]))]));}
  // A box minus one box is at most six disjoint solids. Keeping the exact same
  // bounds for render pieces and collision pieces makes the breach physical.
  function subtract(a,b){
    if(!overlaps(a,b))return [a];
    const lo=[Math.max(a.minX,b.minX),Math.max(a.minY,b.minY),Math.max(a.minZ,b.minZ)],hi=[Math.min(a.maxX,b.maxX),Math.min(a.maxY,b.maxY),Math.min(a.maxZ,b.maxZ)];
    const pieces=[],push=(x0,x1,y0,y1,z0,z1)=>{if(x1-x0>.035&&y1-y0>.035&&z1-z0>.035)pieces.push({minX:x0,maxX:x1,minY:y0,maxY:y1,minZ:z0,maxZ:z1});};
    push(a.minX,lo[0],a.minY,a.maxY,a.minZ,a.maxZ);push(hi[0],a.maxX,a.minY,a.maxY,a.minZ,a.maxZ);
    push(lo[0],hi[0],a.minY,lo[1],a.minZ,a.maxZ);push(lo[0],hi[0],hi[1],a.maxY,a.minZ,a.maxZ);
    push(lo[0],hi[0],lo[1],hi[1],a.minZ,lo[2]);push(lo[0],hi[0],lo[1],hi[1],hi[2],a.maxZ);
    return pieces;
  }
  function meshBox(m,b,id){return {...m,shape:'box',p:[(b.minX+b.maxX)/2,(b.minY+b.maxY)/2,(b.minZ+b.maxZ)/2],s:[b.maxX-b.minX,b.maxY-b.minY,b.maxZ-b.minZ],r:[0,0,0],destructibleId:id,fragment:true};}
  function rayBox(origin,dir,b,limit=Infinity){
    let enter=0,leave=limit,normal=[0,0,0];
    for(let i=0;i<3;i++){
      const lo=b[KEYS[i*2]],hi=b[KEYS[i*2+1]],v=dir[i];
      if(Math.abs(v)<1e-10){if(origin[i]<lo||origin[i]>hi)return null;continue;}
      let a=(lo-origin[i])/v,c=(hi-origin[i])/v,sign=-1;if(a>c){[a,c]=[c,a];sign=1;}
      if(a>enter){enter=a;normal=[0,0,0];normal[i]=sign;}leave=Math.min(leave,c);if(enter>leave)return null;
    }
    return leave>=0&&enter<=limit?{distance:Math.max(0,enter),normal,leave}:null;
  }
  function rayMesh(o,d,e,limit){
    const hit=rayBox(o,d,e.bounds,limit);if(!hit)return null;
    const m=e.mesh,a=e.rotation,p=m.p,s=m.s,offset=o.map((v,i)=>v-p[i]);
    const local=v=>[0,1,2].map(i=>(a[i]*v[0]+a[i+3]*v[1]+a[i+6]*v[2])/s[i]),q=local(offset),v=local(d),shape=m.shape||'box';
    const point=t=>q.map((x,i)=>x+v[i]*t),normal=t=>{
      const p=point(t),n=shape==='sphere'?p:shape==='cylinder'?(Math.abs(Math.abs(p[1])-.5)<.002?[0,Math.sign(p[1]),0]:[p[0],0,p[2]]):p.map(Math.sign);
      const scaled=n.map((x,i)=>x/s[i]),world=[0,1,2].map(i=>a[i*3]*scaled[0]+a[i*3+1]*scaled[1]+a[i*3+2]*scaled[2]),length=Math.hypot(...world)||1;return world.map(x=>x/length);
    };
    let t=null;
    if(shape==='box'||shape==='bevel'){
      const b=rayBox(q,v,{minX:-.5,maxX:.5,minY:-.5,maxY:.5,minZ:-.5,maxZ:.5},limit);
      if(!b)return null;const n=b.normal,t=b.distance;return {distance:t,normal:[0,1,2].map(i=>a[i*3]*n[0]+a[i*3+1]*n[1]+a[i*3+2]*n[2])};
    }
    if(shape==='foliage'){
      let nearest=limit,face=null;
      // Two-sided Möller–Trumbore in local coordinates. Keeping v unnormalised
      // preserves world-space distances under rotation and non-uniform scale.
      for(const f of e.triangles){
        const u=f.ab,w=f.ac,h=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]],det=u[0]*h[0]+u[1]*h[1]+u[2]*h[2];
        if(Math.abs(det)<1e-10)continue;
        const iq=1/det,dx=q[0]-f.a[0],dy=q[1]-f.a[1],dz=q[2]-f.a[2],b=(dx*h[0]+dy*h[1]+dz*h[2])*iq;
        if(b< -1e-8||b>1+1e-8)continue;
        const cross=[dy*u[2]-dz*u[1],dz*u[0]-dx*u[2],dx*u[1]-dy*u[0]],c=(v[0]*cross[0]+v[1]*cross[1]+v[2]*cross[2])*iq;
        if(c< -1e-8||b+c>1+1e-8)continue;
        const at=(w[0]*cross[0]+w[1]*cross[1]+w[2]*cross[2])*iq;
        if(at>=0&&at<=nearest){nearest=at;face=f;}
      }
      if(!face)return null;
      const n=face.n.map((v,i)=>v/s[i]),out=[0,1,2].map(i=>a[i*3]*n[0]+a[i*3+1]*n[1]+a[i*3+2]*n[2]),length=Math.hypot(...out)||1;
      return {distance:nearest,normal:out.map(v=>v/length)};
    }
    if(shape==='sphere'||shape==='cylinder'){
      const axes=shape==='sphere'?[0,1,2]:[0,2],aa=axes.reduce((n,i)=>n+v[i]*v[i],0),bb=axes.reduce((n,i)=>n+q[i]*v[i],0),cc=axes.reduce((n,i)=>n+q[i]*q[i],0)-.25,disc=bb*bb-aa*cc;
      const roots=[];if(aa>EPS&&disc>=0)roots.push((-bb-Math.sqrt(disc))/aa,(-bb+Math.sqrt(disc))/aa);
      if(shape==='cylinder'&&Math.abs(v[1])>EPS)for(const sign of [-1,1]){const at=(sign*.5-q[1])/v[1],p=point(at);if(p[0]*p[0]+p[2]*p[2]<=.25+EPS)roots.push(at);}
      t=roots.filter(t=>t>=0&&t<=limit&&(shape==='sphere'||Math.abs(point(t)[1])<=.5+EPS)).sort((a,b)=>a-b)[0];
    }else if(shape==='octa'){
      let enter=0,leave=limit;
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
        const start=x*q[0]+y*q[1]+z*q[2]-.5,speed=x*v[0]+y*v[1]+z*v[2];
        if(Math.abs(speed)<EPS){if(start>0)return null;}else if(speed<0)enter=Math.max(enter,-start/speed);else leave=Math.min(leave,-start/speed);
      }
      if(enter<=leave)t=enter;
    }else if(shape==='ring'){
      // The hollow torus remains hollow to shots; never use its filled AABB.
      const speed=Math.hypot(...v);let at=hit.distance;
      for(let i=0;i<72&&at<=Math.min(limit,hit.leave);i++){
        const p=point(at),sd=Math.hypot(Math.hypot(p[0],p[2])-.435,p[1])-.065;
        if(sd<.0015){t=at;break;}at+=Math.max(.0002,sd*.85/(speed||1));
      }
    }
    return finite(t)&&t>=0&&t<=limit?{distance:t,normal:normal(t)}:null;
  }
  function anchored(parts,base){
    const keep=new Set(),queue=[];
    parts.forEach((p,i)=>{if(p.minY<=base+.04){keep.add(i);queue.push(i);}});
    for(let k=0;k<queue.length;k++)for(let i=0;i<parts.length;i++)if(!keep.has(i)){
      const a=parts[queue[k]],b=parts[i],touch=[Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX),Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY),Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)];
      if(touch.every(v=>v>=-EPS)&&touch.filter(v=>v>.01).length>=2){keep.add(i);queue.push(i);}
    }
    return parts.filter((_,i)=>keep.has(i));
  }
  function create(world){
    const originalMeshes=world.meshes||[],originalColliders=world.colliders||[],groups=new Map(),meshOwner=new Map(),states=new Map(),leaked=new Set();
    let meshes=originalMeshes.slice(),colliders=originalColliders.map(c=>({...c})),lights=(world.lights||[]).slice(),revision=0;
    const definitions=world.destructibles||originalMeshes.map((m,i)=>m.ground||m.terrain?null:{id:'mesh-'+i,kind:'prop',strength:5,meshes:[i],colliders:originalColliders.flatMap((c,j)=>c.mesh===i?[j]:[])}).filter(Boolean);
    const foliage=originalMeshes.some(m=>m.shape==='foliage')?sharedFoliage():null;
    const entries=originalMeshes.map((mesh,source)=>({mesh,source,bounds:bounds(mesh),rotation:rotation(mesh.r),triangles:mesh.shape==='foliage'?foliage:null}));
    for(const d of definitions){
      const members=d.meshes.filter(i=>entries[i]);if(!members.length)continue;
      const g={...d,id:String(d.id),strength:d.strength||6,meshes:members,colliders:(d.colliders||[]).filter(i=>originalColliders[i]),bounds:d.bounds||union(members.map(i=>entries[i].bounds)),active:members.map(i=>entries[i]),solids:[],originalVolume:0};
      g.originalVolume=g.colliders.reduce((v,i)=>v+volume(originalColliders[i]),0);groups.set(g.id,g);for(const i of members)meshOwner.set(i,g.id);
    }
    const cells=new Map(),size=8;
    for(const g of groups.values())for(let x=Math.floor(g.bounds.minX/size);x<=Math.floor(g.bounds.maxX/size);x++)for(let z=Math.floor(g.bounds.minZ/size);z<=Math.floor(g.bounds.maxZ/size);z++){
      const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(g);
    }
    let signature=2166136261;for(const c of JSON.stringify([world.seed,world.stage,world.generation,definitions.map(d=>[d.id,d.bounds,d.meshes,d.colliders]),world.pipes||[]]))signature=Math.imul(signature^c.charCodeAt(0),16777619);signature=(signature>>>0).toString(36);
    const query=b=>{const found=new Set();for(let x=Math.floor(b.minX/size);x<=Math.floor(b.maxX/size);x++)for(let z=Math.floor(b.minZ/size);z<=Math.floor(b.maxZ/size);z++)for(const g of cells.get(x+','+z)||[])found.add(g);return Array.from(found);};
    const isAlive=id=>id===undefined||id===null||!states.get(String(id))?.removed;
    function compile(g,record){
      if(record?.removed)return {active:[],solids:[]};
      const cuts=record?.cuts||[],active=[],solids=[];
      for(const ci of g.colliders){
        const c=originalColliders[ci];let pieces=[copyBox(c)];for(const cut of cuts)pieces=pieces.flatMap(p=>subtract(p,cut));
        if(g.kind!=='roof'&&g.kind!=='decor')pieces=anchored(pieces,c.minY);
        for(const b of pieces)solids.push({bounds:b,source:ci,meshIndex:c.mesh});
      }
      for(const i of g.meshes){
        const e=entries[i],m=e.mesh,solidParts=solids.filter(q=>q.meshIndex===i);
        if(g.colliders.some(ci=>originalColliders[ci].mesh===i)){
          for(const p of solidParts){const mesh=cuts.length?meshBox(m,p.bounds,g.id):m;active.push({mesh,source:i,bounds:p.bounds,rotation:rotation(mesh.r),solid:p});}continue;
        }
        if(!cuts.length){active.push(e);continue;}
        const axisBox=(m.shape||'box')==='box'&&(!m.r||m.r.every(x=>Math.abs(x)<1e-8));
        if(axisBox){let boxes=[e.bounds];for(const c of cuts)boxes=boxes.flatMap(p=>subtract(p,c));for(const b of boxes){const mesh=meshBox(m,b,g.id);active.push({mesh,source:i,bounds:b,rotation:rotation(mesh.r)});}}
        else if(!cuts.some(c=>overlaps(e.bounds,c)))active.push(e);
      }
      const attached=record?.cuts.length&&g.colliders.length&&g.kind!=='roof'?active.filter(e=>e.solid||solids.some(q=>Math.hypot(Math.max(q.bounds.minX-e.bounds.maxX,0,e.bounds.minX-q.bounds.maxX),Math.max(q.bounds.minY-e.bounds.maxY,0,e.bounds.minY-q.bounds.maxY),Math.max(q.bounds.minZ-e.bounds.maxZ,0,e.bounds.minZ-q.bounds.maxZ))<.4)):active;
      return {active:attached,solids};
    }
    const renderSlots=new Array(originalMeshes.length),firstIndex=new Uint32Array(originalMeshes.length),claimed=new Set(definitions.flatMap(d=>d.colliders||[]));
    function rebuild(next=states){
      const output=[],boxes=[];
      for(const g of groups.values()){
        const record=next.get(g.id),count=record?.cuts.length||0,removed=!!record?.removed;
        if(g.cacheRecord===record&&g.cacheCount===count&&g.cacheRemoved===removed)continue;
        const built=compile(g,record);g.active=built.active;g.solids=built.solids;g.cacheRecord=record;g.cacheCount=count;g.cacheRemoved=removed;
        for(const i of g.meshes)renderSlots[i]=[];
        for(const e of g.active)renderSlots[e.source].push(e);
      }
      // Preserve original mesh ordering, including coplanar decorative surfaces.
      // Only a changed original mesh is replaced by its local surviving pieces.
      for(let i=0;i<originalMeshes.length;i++){
        const id=meshOwner.get(i);firstIndex[i]=output.length;
        if(!id){output.push(originalMeshes[i]);continue;}
        for(const e of renderSlots[i]||[]){const index=output.length;output.push(e.mesh);if(e.solid)boxes.push({...e.solid.bounds,mesh:index,destructibleId:id});}
      }
      for(let i=0;i<originalColliders.length;i++)if(!claimed.has(i)){const c=originalColliders[i];boxes.push({...c,mesh:firstIndex[c.mesh]});}
      meshes=output;colliders=boxes;lights=(world.lights||[]).filter(l=>!next.get(String(l.destructibleId))?.removed);
    }
    rebuild();
    function raycast(origin,direction,maxDistance=100){
      if(!validPoint(origin)||!validPoint(direction)||!finite(maxDistance)||maxDistance<=0)return null;
      const length=Math.hypot(...direction);if(length<EPS)return null;const dir=direction.map(v=>v/length),end=origin.map((v,i)=>v+dir[i]*Math.min(300,maxDistance));
      const candidates=query({minX:Math.min(origin[0],end[0]),maxX:Math.max(origin[0],end[0]),minZ:Math.min(origin[2],end[2]),maxZ:Math.max(origin[2],end[2])});
      let nearest=null,limit=Math.min(maxDistance,300);
      for(const g of candidates){if(!isAlive(g.id)||!rayBox(origin,dir,g.bounds,limit))continue;for(const e of g.active){const h=rayMesh(origin,dir,e,limit);if(h&&h.distance<limit){limit=h.distance;nearest={...h,id:g.id,point:origin.map((v,i)=>v+dir[i]*h.distance)};}}}
      return nearest;
    }
    function debrisFor(g,point,power,out){
      const material=entries[g.meshes[0]].mesh,seed=g.meshes[0]+revision*911;let n=seed|0;
      const random=()=>{n=Math.imul(n^n>>>15,2246822519);n=Math.imul(n^n>>>13,3266489917);return ((n^n>>>16)>>>0)/4294967296;};
      const count=Math.min(8,Math.max(3,Math.ceil(power/10)),MAX_DEBRIS-out.length);
      for(let i=0;i<count;i++){
        const span=g.kind==='roof'?1.1+random()*1.3:g.kind==='wall'?.25+random()*.55:g.kind==='tree'?.2+random()*.45:.09+random()*.30,a=random()*Math.PI*2,speed=1.8+random()*3.2;
        out.push({x:point[0]+(random()-.5)*.4,y:point[1]+(random()-.5)*.3,z:point[2]+(random()-.5)*.4,size:[span,g.kind==='roof'?.18+random()*.18:span*(.6+random()),span*(.6+random())],mat:material.mat||0,color:material.color?material.color.slice():undefined,velocity:[Math.cos(a)*speed,g.kind==='roof'?-1-random():2+random()*3,Math.sin(a)*speed],life:1.4+random()*1.3,seed:seed+i});
      }
    }
    function damage(point,radius,power,bullet,ignoreId){
      const result={changed:false,revision,debris:[],pipeLeaks:[],collapsed:[]};
      if(!validPoint(point)||!finite(radius)||!finite(power)||radius<=0||power<=0)return result;
      radius=clamp(radius,.05,12);power=clamp(power,0,1000);
      const reach={minX:point[0]-radius,maxX:point[0]+radius,minY:point[1]-radius,maxY:point[1]+radius,minZ:point[2]-radius,maxZ:point[2]+radius};
      let targets=query(reach).filter(g=>g.id!==String(ignoreId)&&isAlive(g.id)&&g.active.some(e=>distance(point,e.bounds)<=radius));
      if(bullet)targets=targets.sort((a,b)=>Math.min(...a.active.map(e=>distance(point,e.bounds)))-Math.min(...b.active.map(e=>distance(point,e.bounds)))).slice(0,1);
      const touched=[];
      for(const g of targets){
        const nearest=g.active.reduce((best,e)=>!best||distance(point,e.bounds)<distance(point,best.bounds)?e:best,null),d=distance(point,nearest.bounds),impact=[Math.max(nearest.bounds.minX,Math.min(point[0],nearest.bounds.maxX)),Math.max(nearest.bounds.minY,Math.min(point[1],nearest.bounds.maxY)),Math.max(nearest.bounds.minZ,Math.min(point[2],nearest.bounds.maxZ))],amount=power*(bullet?1:Math.pow(Math.max(0,1-d/radius),.45));if(amount<=.02)continue;
        const record=states.get(g.id)||{damage:0,cuts:[],removed:false};record.damage+=amount;states.set(g.id,record);
        if(record.damage<g.strength){debrisFor(g,point,Math.min(5,amount),result.debris);continue;}
        record.damage=0;debrisFor(g,point,amount,result.debris);
        const before=g.solids.reduce((v,q)=>v+volume(q.bounds),0),r=bullet?clamp(.30+Math.sqrt(power)*.13,.40,.85):radius*.66;
        const cut={minX:impact[0]-r,maxX:impact[0]+r,minY:impact[1]-r,maxY:impact[1]+r,minZ:impact[2]-r,maxZ:impact[2]+r};
        if(['tree','decor','pipe'].includes(g.kind)||!g.colliders.length&&g.kind!=='roof')record.removed=true;
        else record.cuts.push(cut);
        let built=compile(g,record);
        const remains=built.solids.reduce((v,q)=>v+volume(q.bounds),0);
        if(built.solids.length>MAX_PARTS||record.cuts.length>MAX_CUTS||g.colliders.length&&(!built.solids.length||remains<g.originalVolume*.035))record.removed=true;
        if(record.removed){record.cuts=[];built={active:[],solids:[]};result.collapsed.push(g.id);}
        // A grazing explosion must not create a fake revision or damage hole.
        if(record.removed||remains<before-EPS||built.active.length!==g.active.length||record.cuts.length){result.changed=true;touched.push(g.id);g.active=built.active;g.solids=built.solids;}
        for(const p of world.pipes||[])if(p.destructibleId===g.id&&!leaked.has(p.id)){leaked.add(p.id);result.pipeLeaks.push(p.id);}
      }
      if(result.changed){
        for(const roof of groups.values())if(roof.supports?.length&&isAlive(roof.id)){
          const supports=roof.supports.map(id=>groups.get(String(id))).filter(Boolean),original=supports.reduce((v,g)=>v+g.originalVolume,0),remaining=supports.reduce((v,g)=>v+g.solids.reduce((n,q)=>n+volume(q.bounds),0),0);
          if(original>0&&remaining/original<(roof.supportRatio||.38)){
            states.set(roof.id,{damage:0,cuts:[],removed:true});roof.active=[];roof.solids=[];result.collapsed.push(roof.id);
            for(const id of roof.dependents||[]){const g=groups.get(id);if(g&&isAlive(id)){states.set(id,{damage:0,cuts:[],removed:true});g.active=[];g.solids=[];result.collapsed.push(id);}}
            if(result.debris.length>MAX_DEBRIS-5)result.debris.length=MAX_DEBRIS-5;
            debrisFor(roof,[(roof.bounds.minX+roof.bounds.maxX)/2,roof.bounds.minY,(roof.bounds.minZ+roof.bounds.maxZ)/2],45,result.debris);
          }
        }
        // Collapse only a locally over-fragmented body; never erase unrelated
        // scenery to meet a global budget or emit blocking cosmetic debris.
        let total=Array.from(groups.values()).reduce((n,g)=>n+g.solids.length,0),limit=Math.max(512,originalColliders.length+384);
        for(const id of touched)if(total>limit){const g=groups.get(id);total-=g.solids.length;states.set(id,{damage:0,cuts:[],removed:true});g.active=[];g.solids=[];if(!result.collapsed.includes(id))result.collapsed.push(id);}
        rebuild();revision++;result.revision=revision;
      }
      return result;
    }
    function snapshot(){return {version:1,signature,revision,states:Array.from(states,([id,s])=>({id,damage:s.damage,removed:!!s.removed,cuts:s.cuts.map(copyBox)})),leaks:Array.from(leaked)};}
    function restore(value,options={}){
      if(!value||value.version!==1||value.signature!==signature||!Number.isInteger(value.revision)||value.revision<0||value.revision>1e9||!Array.isArray(value.states)||value.states.length>groups.size||!Array.isArray(value.leaks))return false;
      const next=new Map(),nextLeaks=new Set(),pipeIds=new Set((world.pipes||[]).map(p=>p.id));
      for(const s of value.states){
        if(!s||typeof s.id!=='string'||!groups.has(s.id)||next.has(s.id)||!finite(s.damage)||s.damage<0||s.damage>=groups.get(s.id).strength||typeof s.removed!=='boolean'||!Array.isArray(s.cuts)||s.cuts.length>MAX_CUTS||s.removed&&s.cuts.length)return false;
        const cuts=[];
        for(const b of s.cuts){if(!b||!KEYS.every(k=>finite(b[k]))||!(b.maxX>b.minX&&b.maxY>b.minY&&b.maxZ>b.minZ)||Math.max(b.maxX-b.minX,b.maxY-b.minY,b.maxZ-b.minZ)>24||!overlaps(b,groups.get(s.id).bounds))return false;cuts.push(copyBox(b));}
        const record={damage:s.damage,removed:s.removed,cuts},built=compile(groups.get(s.id),record);if(built.solids.length>MAX_PARTS)return false;next.set(s.id,record);
      }
      for(const id of value.leaks){if(!pipeIds.has(id)||nextLeaks.has(id))return false;nextLeaks.add(id);}
      const total=Array.from(groups.values()).reduce((n,g)=>n+compile(g,next.get(g.id)).solids.length,0);
      if(total>Math.max(512,originalColliders.length+384))return false;
      // Validation finishes before any live array or state is replaced.
      states.clear();for(const [id,s] of next)states.set(id,s);leaked.clear();for(const id of nextLeaks)leaked.add(id);
      rebuild();revision=options.exactRevision?value.revision:Math.max(revision+1,value.revision);return true;
    }
    return {get meshes(){return meshes;},get colliders(){return colliders;},get lights(){return lights;},get revision(){return revision;},isAlive,raycast,
      hit:(point,power,direction)=>damage(point,.22,power,true),blast:(point,radius,power,ignoreId)=>damage(point,radius,power,false,ignoreId),snapshot,restore};
  }
  G.FDestruction={create};
})(typeof window!=='undefined'?window:globalThis);
