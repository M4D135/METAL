// Prototype patches for the navigation axis, applied in memory to simulation.js.
// Flags (comma separated):
//   heap    typed-array binary heap, no [i,cost] allocation, no neighbour array      (result-neutral)
//   nearest nearestNode tests candidates by increasing distance, stops at first      (result-neutral)
//   long    long sweeps scan only the collision buckets under the segment AABB       (result-neutral)
//   labels  canonical grid edges baked in time slices + connected-component labels;
//           route() rejects start/end in different components in O(1)              (result-neutral with the
//           exact predicate; consumes the search budget unless 'free')
//   static  static fast grid edge predicate: closed doors + solids, no trap boxes,
//           ground without trap displacement, cached cell heights                   (behaviour change: traps)
//   free    a label rejection does not consume routeBudget                            (behaviour change)
//   local   destruction/door refresh is local (changed groups only): nav cells, edges,
//           incremental union-find labels, only crossing paths replan; no refresh at all
//           when no collider changed                                                 (behaviour change)
//   defer   a budget-deferred search is not a failure: setGoal keeps the current path and
//           retries soon; reinforcement probing stops instead of rejecting candidates (behaviour change)
import {rep} from './load.mjs';

export function protoPatch(src,flags){
  const F=new Set(String(flags||'').split(',').filter(Boolean));
  const BAKE=+(process.env.BAKE||3000);
  if(F.has('heap')){
    src=rep(src,'    function route(e,x,z){',`    const heapNode=new Int32Array(9608),heapKey=new Float64Array(9608);let hn=0;
    function hpush(i,cost){let at=hn++;while(at){const parent=(at-1)>>1;if(heapKey[parent]<=cost)break;heapNode[at]=heapNode[parent];heapKey[at]=heapKey[parent];at=parent;}heapNode[at]=i;heapKey[at]=cost;}
    function hpop(){const value=heapNode[0];hn--;if(hn){const lastN=heapNode[hn],lastK=heapKey[hn];let at=0;while(at*2+1<hn){let child=at*2+1;if(child+1<hn&&heapKey[child+1]<heapKey[child])child++;if(heapKey[child]>=lastK)break;heapNode[at]=heapNode[child];heapKey[at]=heapKey[child];at=child;}heapNode[at]=lastN;heapKey[at]=lastK;}return value;}
    function route(e,x,z){`);
    src=rep(src,'const stamp=++routeSerial,heap=[];','const stamp=++routeSerial;hn=0;');
    src=rep(src,'      function push(i,cost){let at=heap.length;heap.push([i,cost]);while(at){const parent=(at-1)>>1;if(heap[parent][1]<=cost)break;heap[at]=heap[parent];at=parent;}heap[at]=[i,cost];}\n','');
    src=rep(src,'      function pop(){const value=heap[0],last=heap.pop();if(heap.length){let at=0;while(at*2+1<heap.length){let child=at*2+1;if(child+1<heap.length&&heap[child+1][1]<heap[child][1])child++;if(heap[child][1]>=last[1])break;heap[at]=heap[child];at=child;}heap[at]=last;}return value[0];}\n','');
    src=rep(src,'push(start,heuristic(start));','hpush(start,heuristic(start));');
    src=rep(src,'while(heap.length&&explored++<2400){','while(hn&&explored++<2400){');
    src=rep(src,'const i=pop();if(routeClosed[i]===stamp)continue;','const i=hpop();if(routeClosed[i]===stamp)continue;');
    src=rep(src,'const ix=i%nx,neighbors=[ix?i-1:-1,ix<nx-1?i+1:-1,i-nx,i+nx];','const ix=i%nx;');
    src=rep(src,'const j=neighbors[k];if(j<0||j>=nav.length','const j=k===0?(ix?i-1:-1):k===1?(ix<nx-1?i+1:-1):k===2?i-nx:i+nx;if(j<0||j>=nav.length');
    src=rep(src,'routeStamp[j]=stamp;routeCost[j]=cost;routePrev[j]=i;push(j,cost+heuristic(j));','routeStamp[j]=stamp;routeCost[j]=cost;routePrev[j]=i;hpush(j,cost+heuristic(j));');
  }
  if(F.has('nearest')){
    src=rep(src,`    function nearestNode(x,z,r){
      const center=idx(x,z),cx=center%nx,cz=Math.floor(center/nx);let best=-1,distance=Infinity;
      for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
        const ix=cx+dx,iz=cz+dz;if(ix<0||ix>=nx||iz<0||iz>=nz)continue;
        const j=iz*nx+ix;if(!nav[j])continue;
        const [px,pz]=coord(j),d=(px-x)**2+(pz-z)**2;
        if(d<distance&&segmentFree(x,z,px,pz,r)){best=j;distance=d;}
      }
      return best;
    }`,`    const nearJ=new Int32Array(49),nearD=new Float64Array(49);
    function nearestNode(x,z,r){
      // Same answer as the row-major scan (minimum distance, first row-major on ties),
      // but the expensive sweep runs in increasing distance and stops at the first success.
      const center=idx(x,z),cx=center%nx,cz=Math.floor(center/nx);let n=0;
      for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
        const ix=cx+dx,iz=cz+dz;if(ix<0||ix>=nx||iz<0||iz>=nz)continue;
        const j=iz*nx+ix;if(!nav[j])continue;
        const [px,pz]=coord(j),d=(px-x)**2+(pz-z)**2;
        let at=n++;while(at>0&&nearD[at-1]>d){nearD[at]=nearD[at-1];nearJ[at]=nearJ[at-1];at--;}nearD[at]=d;nearJ[at]=j;
      }
      for(let k=0;k<n;k++){const [px,pz]=coord(nearJ[k]);if(segmentFree(x,z,px,pz,r))return nearJ[k];}
      return -1;
    }`);
  }
  if(F.has('long')){
    src=rep(src,`      const local=short?collisionBuckets[(Math.floor((az+bz)/2/bucketSize)-bucketZ)*bucketWidth+Math.floor((ax+bx)/2/bucketSize)-bucketX]||solids:solids;
      for(const list of [local,doorBoxes])for(const q of list){`,`      let lists;
      if(short)lists=[collisionBuckets[(Math.floor((az+bz)/2/bucketSize)-bucketZ)*bucketWidth+Math.floor((ax+bx)/2/bucketSize)-bucketX]||solids,doorBoxes];
      else if(r<=bucketRadius){
        // Every box within r of the segment is listed in the bucket of the nearest segment point.
        const x0=Math.max(0,Math.floor(minX/bucketSize)-bucketX),x1=Math.min(bucketWidth-1,Math.floor(maxX/bucketSize)-bucketX),z0=Math.max(0,Math.floor(minZ/bucketSize)-bucketZ),z1=Math.min(bucketDepth-1,Math.floor(maxZ/bucketSize)-bucketZ);
        lists=[];for(let gz=z0;gz<=z1;gz++)for(let gx=x0;gx<=x1;gx++)lists.push(collisionBuckets[gz*bucketWidth+gx]);lists.push(doorBoxes);
      }else lists=[solids,doorBoxes];
      for(const list of lists)for(const q of list){`);
  }
  const labels=F.has('labels')||F.has('local');
  if(labels){
    const statik=F.has('static');
    if(statik)src=rep(src,'    for(let i=0;i<nav.length;i++){const [x,z]=coord(i);nav[i]=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1;}\n    function rebuildNav(){',
      '    const navY=new Float64Array(nav.length);\n    for(let i=0;i<nav.length;i++){const [x,z]=coord(i);navY[i]=ground(x,z,[]);nav[i]=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1;}\n    function rebuildNav(){');
    src=rep(src,'let routeSerial=0,navHead=0,navTail=0,navPending=0;',`let routeSerial=0,navHead=0,navTail=0,navPending=0;
    // Connectivity: canonical bits 2 (right) / 8 (down) on the lower cell, mirrored 1 / 4.
    const navComp=new Int32Array(nav.length).fill(-1),compParent=new Int32Array(nav.length+1),labelQueue=new Int32Array(nav.length);let labelsReady=false,bakeAt=0,bakeDirty=true,compCount=0;
    const findComp=c=>{while(compParent[c]!==c){compParent[c]=compParent[compParent[c]];c=compParent[c];}return c;};
    const navStats={bakeTests:0,relabels:0,unions:0,localRefresh:0,skippedRefresh:0,splitFallback:0,labelRejects:0,deferKeep:0,localTests:0,localCells:0};globalThis.__navProbe={get labelsReady(){return labelsReady;},stats:navStats};
    ${statik?`const staticTraps=[];
    function edgeTest(i,j){
      // Static grid edge: solids + door boxes, terrain without trap displacement.
      // Same sweep and step rules as segmentFree(coord(i),coord(j),.4) on a trap-free world.
      const [ax,az]=coord(i),[bx,bz]=coord(j),r=.4,ay=navY[i],by=navY[j];
      if(!Number.isFinite(ay)||!Number.isFinite(by))return false;
      const dx=bx-ax,dz=bz-az,minX=Math.min(ax,bx)-r-1e-7,maxX=Math.max(ax,bx)+r+1e-7,minZ=Math.min(az,bz)-r-1e-7,maxZ=Math.max(az,bz)+r+1e-7,lo=Math.min(ay,by),hi=Math.max(ay,by);
      const local=collisionBuckets[(Math.floor((az+bz)/2/bucketSize)-bucketZ)*bucketWidth+Math.floor((ax+bx)/2/bucketSize)-bucketX]||solids;
      for(let L=0;L<2;L++){const list=L?doorBoxes:local;for(let n=0;n<list.length;n++){const q=list[n];
        if(q.maxY<=lo+.06||q.minY>=hi+1.8||q.maxX<minX||q.minX>maxX||q.maxZ<minZ||q.minZ>maxZ)continue;
        let a0=0,a1=1;
        if(Math.abs(dx)<1e-8){if(ax<q.minX-r||ax>q.maxX+r)continue;}else{let a=(q.minX-r-ax)/dx,c=(q.maxX+r-ax)/dx;if(a>c){const t=a;a=c;c=t;}a0=Math.max(a0,a);a1=Math.min(a1,c);if(a1<a0)continue;}
        if(Math.abs(dz)<1e-8){if(az<q.minZ-r||az>q.maxZ+r)continue;}else{let a=(q.minZ-r-az)/dz,c=(q.maxZ+r-az)/dz;if(a>c){const t=a;a=c;c=t;}a0=Math.max(a0,a);a1=Math.min(a1,c);if(a1<a0)continue;}
        if(a1>=a0&&a1>=0&&a0<=1)return false;}}
      let previous=ay;
      for(let k=1;k<=3;k++){const x=ax+dx*k/3,z=az+dz*k/3,y=k===3?by:ground(x,z,staticTraps);
        if(!Number.isFinite(y)||Math.abs(y-previous)>.42)return false;
        // Inside the endpoint height band the sweep above already covered this disc exactly.
        if(k<3&&(y<lo||y>hi)&&blocked(x,z,r,y,doorBoxes,solids,staticTraps))return false;previous=y;}
      return true;
    }`:`function edgeTest(i,j){return segmentFree(...coord(i),...coord(j),.4);}`}
    function setEdge(i,j,bit,back){navStats.bakeTests++;edgeKnown[i]|=bit;edgeKnown[j]|=back;if(edgeTest(i,j)){edgeOpen[i]|=bit;edgeOpen[j]|=back;return true;}edgeOpen[i]&=~bit;edgeOpen[j]&=~back;return false;}
    function bakeEdges(limit){
      let work=0;
      while(bakeAt<nav.length&&work<limit){const i=bakeAt++;if(!nav[i])continue;const ix=i%nx;
        if(ix<nx-1&&nav[i+1]&&!(edgeKnown[i]&2)){setEdge(i,i+1,2,1);work++;}
        if(i+nx<nav.length&&nav[i+nx]&&!(edgeKnown[i]&8)){setEdge(i,i+nx,8,4);work++;}
      }
      if(bakeAt>=nav.length&&bakeDirty&&!navPending){labelNav();bakeDirty=false;labelsReady=true;}
      return work;
    }
    function labelNav(){
      navStats.relabels++;navComp.fill(-1);let id=0;
      for(let c=0;c<nav.length;c++){if(!nav[c]||navComp[c]>=0)continue;let h=0,t=0;labelQueue[t++]=c;navComp[c]=id;
        while(h<t){const i=labelQueue[h++],ix=i%nx,m=edgeOpen[i];
          if((m&2)&&navComp[i+1]<0){navComp[i+1]=id;labelQueue[t++]=i+1;}
          if((m&1)&&navComp[i-1]<0){navComp[i-1]=id;labelQueue[t++]=i-1;}
          if((m&8)&&navComp[i+nx]<0){navComp[i+nx]=id;labelQueue[t++]=i+nx;}
          if((m&4)&&navComp[i-nx]<0){navComp[i-nx]=id;labelQueue[t++]=i-nx;}}
        compParent[id]=id;id++;}
      compCount=id;
    }`);
    // the bake runs in the existing per-step maintenance slot, after the amortised pump
    src=rep(src,'s.aiStats.navUpdates=work;s.aiStats.navPending=navPending;',`s.aiStats.navUpdates=work;s.aiStats.navPending=navPending;if(!navPending&&(bakeAt<nav.length||bakeDirty))s.aiStats.navBaked=bakeEdges(${BAKE});`);
    // lazy A* edge test uses the same predicate and mirrors the bit
    src=rep(src,'if(!(edgeKnown[i]&mask)){edgeKnown[i]|=mask;if(segmentFree(...coord(i),...coord(j),.4))edgeOpen[i]|=mask;}',
      'if(!(edgeKnown[i]&mask))setEdge(i,j,mask,k===0?2:k===1?1:k===2?8:4);');
    // O(1) rejection of a disconnected pair
    const reject='if(labelsReady&&navComp[start]>=0&&navComp[end]>=0&&findComp(navComp[start])!==findComp(navComp[end])){navStats.labelRejects++;globalThis.__labelRejects=(globalThis.__labelRejects||0)+1;return null;}';
    if(F.has('free'))src=rep(src,'if(routeBudget<=0){routeDeferred++;return null;}routeBudget--;routeSearches++;\n      const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);if(start<0||end<0)return null;',
        'const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);if(start<0||end<0)return null;'+reject+'\n      if(routeBudget<=0){routeDeferred++;return DEFER;}routeBudget--;routeSearches++;');
    else src=rep(src,'const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);if(start<0||end<0)return null;','const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);if(start<0||end<0)return null;'+reject);
    // a global refresh restarts the bake
    src=rep(src,'edgeKnown.fill(0);edgeOpen.fill(0);if(reset)for(const e of s.enemies)','edgeKnown.fill(0);edgeOpen.fill(0);bakeAt=0;bakeDirty=true;labelsReady=false;if(reset)for(const e of s.enemies)');
  }
  // DEFER is null unless 'defer' distinguishes it
  src=rep(src,'    function route(e,x,z){','    const DEFER='+(F.has('defer')?'false':'null')+';\n    function route(e,x,z){');
  if(!F.has('free'))src=rep(src,'if(routeBudget<=0){routeDeferred++;return null;}','if(routeBudget<=0){routeDeferred++;return DEFER;}');
  if(F.has('defer')){
    // setGoal: a deferred search keeps the current plan and retries within 0.1 s.
    src=rep(src,'const path=route(e,x,z);if(!path)return false;','const path=route(e,x,z);if(path===false){e.thinkWait=Math.min(e.thinkWait,.1);if(globalThis.__navProbe)globalThis.__navProbe.stats.deferKeep++;return true;}if(!path)return false;');
    src=rep(src,'if(bossProgression&&q.naturalEntries){approachPath=route({...e,x:candidate.x,z:candidate.z},q.trigger.x,q.trigger.z);if(approachPath===null)continue;}',
      'if(bossProgression&&q.naturalEntries){approachPath=route({...e,x:candidate.x,z:candidate.z},q.trigger.x,q.trigger.z);if(approachPath===false){approachPath=null;probes=0;break;}if(approachPath===null)continue;}');
    // stuck replanning: a deferred search keeps the old path
    src=rep(src,'const path=route(e,e.goalX,e.goalZ);e.planWait=0;e.path=path||[];e.pathAt=0;e.stuck=0;','const path=route(e,e.goalX,e.goalZ);e.planWait=0;if(path!==false){e.path=path||[];e.pathAt=0;}e.stuck=0;');
  }
  if(F.has('local')){
    src=rep(src,'let navDirty=false,routeBudget=Infinity,routeSearches=0,routeDeferred=0;','let navDirty=false,routeBudget=Infinity,routeSearches=0,routeDeferred=0;let dirtyMinX=Infinity,dirtyMaxX=-Infinity,dirtyMinZ=Infinity,dirtyMaxZ=-Infinity,dirtyAny=false;\n    const markDirty=q=>{dirtyAny=true;dirtyMinX=Math.min(dirtyMinX,q.minX);dirtyMaxX=Math.max(dirtyMaxX,q.maxX);dirtyMinZ=Math.min(dirtyMinZ,q.minZ);dirtyMaxZ=Math.max(dirtyMaxZ,q.maxZ);};');
    // destruction: only the groups whose collider set changed (by destructibleId) mark a region
    src=rep(src,'solids=destruction.colliders;seenDestructionRevision=destruction.revision;s.destructionRevision++;rebuildCollision();navDirty=terrainDirty=true;',
      `{const next=destruction.colliders,sig=new Map(),add=(q,w)=>{if(q.destructibleId===undefined)return;const k=q.destructibleId;let v=sig.get(k);if(!v)sig.set(k,v=[0,0]);v[0]+=w;v[1]+=w*(q.minX*1.31+q.minY*2.17+q.minZ*3.07+q.maxX*5.11+q.maxY*7.19+q.maxZ*11.3);};
        for(const q of solids)add(q,1);for(const q of next)add(q,-1);
        for(const list of [solids,next])for(const q of list)if(q.destructibleId!==undefined){const v=sig.get(q.destructibleId);if(v[0]!==0||Math.abs(v[1])>1e-6)markDirty(q);}}
      solids=destruction.colliders;seenDestructionRevision=destruction.revision;s.destructionRevision++;rebuildCollision();if(dirtyAny)navDirty=true;else navStats.skippedRefresh++;terrainDirty=true;`);
    src=rep(src,"d.open=d.progress>=1;if(d.open&&!was){navDirty=true;","d.open=d.progress>=1;if(d.open&&!was){navDirty=true;markDirty({minX:d.x-d.w/2,maxX:d.x+d.w/2,minZ:d.z-d.d/2,maxZ:d.z+d.d/2});");
    src=rep(src,"d.destroyed=true;d.progress=1;d.open=true;navDirty=true;","d.destroyed=true;d.progress=1;d.open=true;navDirty=true;markDirty({minX:d.x-d.w/2,maxX:d.x+d.w/2,minZ:d.z-d.d/2,maxZ:d.z+d.d/2});");
    src=rep(src,'      if(navDirty){refreshNav();navDirty=terrainDirty=false;}\n','      if(navDirty){if(advanced&&dirtyAny)refreshLocal();else refreshNav();navDirty=terrainDirty=false;}\n');
    src=rep(src,'    function nearestNode(x,z,r){',`    function refreshLocal(){
      // Cells whose disc (.4) or whose 0.8 m edges can touch the changed boxes.
      navStats.localRefresh++;
      const m=.4+cell+.05,x0=clamp(Math.floor((dirtyMinX-m-b.minX)/cell),0,nx-1),x1=clamp(Math.ceil((dirtyMaxX+m-b.minX)/cell),0,nx-1),z0=clamp(Math.floor((dirtyMinZ-m-b.minZ)/cell),0,nz-1),z1=clamp(Math.ceil((dirtyMaxZ+m-b.minZ)/cell),0,nz-1);
      dirtyMinX=dirtyMinZ=Infinity;dirtyMaxX=dirtyMaxZ=-Infinity;dirtyAny=false;let closed=false;
      for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){const i=iz*nx+ix,[x,z]=coord(i),v=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1;if(nav[i]&&!v)closed=true;
        if(v&&!nav[i]&&labelsReady){navComp[i]=compCount;compParent[compCount]=compCount;compCount++;}nav[i]=v;navStats.localCells++;}
      // reset and re-test every edge with an endpoint in the box (a few hundred tests)
      for(let iz=Math.max(0,z0-1);iz<=z1;iz++)for(let ix=Math.max(0,x0-1);ix<=x1;ix++){const i=iz*nx+ix;
        for(const [j,bit,back,ok] of [[i+1,2,1,ix<nx-1],[i+nx,8,4,iz<nz-1]]){if(!ok)continue;const wasOpen=(edgeOpen[i]&bit)!==0;edgeKnown[i]&=~bit;edgeKnown[j]&=~back;edgeOpen[i]&=~bit;edgeOpen[j]&=~back;
          if(!nav[i]||!nav[j]){if(wasOpen)closed=true;continue;}navStats.localTests++;const open=setEdge(i,j,bit,back);if(wasOpen&&!open)closed=true;
          if(open&&labelsReady){const a=findComp(navComp[i]),c=findComp(navComp[j]);if(a!==c){compParent[Math.max(a,c)]=Math.min(a,c);navStats.unions++;}}}}
      if(closed&&labelsReady){navStats.splitFallback++;labelNav();}else if(!labelsReady)bakeDirty=true;
      // only bodies whose remaining route crosses the region replan
      for(const e of s.enemies){if(!e.path.length)continue;let hit=false;for(let k=e.pathAt;k<e.path.length&&!hit;k++){const c=e.path[k],cx=c%nx,cz=Math.floor(c/nx);hit=cx>=x0-1&&cx<=x1+1&&cz>=z0-1&&cz<=z1+1;}
        if(hit){e.path=[];e.pathAt=0;e.planWait=0;e.thinkWait=Math.min(e.thinkWait,(e.id%8)*.06);}}
    }
    function nearestNode(x,z,r){`);
  }
  return src;
}
