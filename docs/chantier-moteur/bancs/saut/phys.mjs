// FEEL-08 + FEEL-09 prototype, applied IN MEMORY to src/simulation.js (repo untouched).
// Modern motion profile only (progression || generation>=6). Legacy profile: no code path changes.
export const DEFAULTS={walk:4.2,sprint:7.6,accel:16,friction:9,stop:2.2,air:1.1,cap:10.5,jump:6.2,g:20,coyote:.1,buffer:.12,fatal:7.75,rebound:false,clip:0,airStep:0,rushReach:.9,rushStart:.65};
export function physPatches(opt={}){
  const P={...DEFAULTS,...opt};
  const S=[];
  // A) profile + state + hook object
  S.push(["const motionProfile=progression||world.generation>=6?{walk:5.4,sprint:7.6,accel:30,friction:42,reverse:50,dash:15.2,air:2.2}:",
    `const motionProfile=progression||world.generation>=6?{walk:${P.walk},sprint:${P.sprint},accel:30,friction:42,reverse:50,dash:15.2,air:2.2,q:{accel:${P.accel},friction:${P.friction},stop:${P.stop},air:${P.air},cap:${P.cap},jump:${P.jump},g:${P.g},coyote:${P.coyote},buffer:${P.buffer},fatal:${P.fatal}}}:`]);
  S.push(["let velocityX=0,velocityZ=0,dashAge=.2,dashX=0,dashZ=0;",
    "let velocityX=0,velocityZ=0,dashAge=.2,dashX=0,dashZ=0;const Q=motionProfile.q||null;let jumpBuffer=0,coyote=0,jumpHeld=false;const HK={frozen:0,frozenNear:0,head:0,clipHits:0,clipMaxRel:-1,jumps:0,rebounds:0,lands:0,maxFeetOverClip:-1};const clipBoxes=[];"]);
  // B) clip boxes (player only) built from outdoorBoundaries; rebuilt lazily after world colliders known
  S.push(["function actorBlocked(e,x,z,r,y){",
    `function actorBlocked(e,x,z,r,y){
      if(e===p&&clipBoxes.length)for(const q of clipBoxes){if(q.maxY<=y+.06||q.minY>=y+1.8-1e-7)continue;const dx=x<q.minX?q.minX-x:x>q.maxX?x-q.maxX:0,dz=z<q.minZ?q.minZ-z:z>q.maxZ?z-q.maxZ:0;if(dx*dx+dz*dz<r*r){if(y>q.base+.06){HK.clipHits++;if(y-q.base>HK.clipMaxRel)HK.clipMaxRel=y-q.base;}return true;}}`]);
  // C) ledge walk-off keeps coyote time
  S.push(["if(advanced&&e===p&&next<y-.42&&free(e.x+dx,e.z,y)){Object.assign(e,{airborne:true,airVX:velocityX,airVY:0,airVZ:velocityZ,airTime:0});e.x+=dx;p.dashing=0;stopMotion();break;}",
    "if(advanced&&e===p&&next<y-.42&&free(e.x+dx,e.z,y)){Object.assign(e,{airborne:true,airVX:velocityX,airVY:0,airVZ:velocityZ,airTime:0});e.x+=dx;p.dashing=0;stopMotion();if(Q)coyote=Q.coyote;break;}"]);
  S.push(["if(advanced&&e===p&&next<y-.42&&free(e.x,e.z+dz,y)){Object.assign(e,{airborne:true,airVX:velocityX,airVY:0,airVZ:velocityZ,airTime:0});e.z+=dz;p.dashing=0;stopMotion();break;}",
    "if(advanced&&e===p&&next<y-.42&&free(e.x,e.z+dz,y)){Object.assign(e,{airborne:true,airVX:velocityX,airVY:0,airVZ:velocityZ,airTime:0});e.z+=dz;p.dashing=0;stopMotion();if(Q)coyote=Q.coyote;break;}"]);
  // D) land(): fatal threshold, momentum kept (not after a pad), optional same-substep rebound
  S.push(["if(e===p&&impact>6&&fallbackLanding(e.x,e.z,y)){putHeight(e,y);fatalFall();return;}",
    `if(e===p&&impact>(Q?Q.fatal:6)&&fallbackLanding(e.x,e.z,y)){putHeight(e,y);HK.fatal=(HK.fatal||0)+1;fatalFall();return;}
      if(e===p&&Q){HK.lands++;HK.lastImpact=impact;HK.lastFallback=fallbackLanding(e.x,e.z,y);}
      if(e===p&&Q&&${P.rebound}&&jumpBuffer>0&&e.padId===null){putHeight(e,y);e.airVY=Q.jump;e.airTime=0;jumpBuffer=0;coyote=0;HK.jumps++;HK.rebounds++;emit('land',{actor:'player',hard:impact>9,impact,x:e.x,y,z:e.z});emit('jump');return;}
      const keepX=e.airVX,keepZ=e.airVZ,fromPad=e.padId!==null;`]);
  S.push(["if(e===p){stopMotion();p.dashing=0;}\n      else{e.goalX=e.x;e.goalZ=e.z;e.path=[];",
    "if(e===p){stopMotion();p.dashing=0;if(Q&&!fromPad){velocityX=keepX;velocityZ=keepZ;}}\n      else{e.goalX=e.x;e.goalZ=e.z;e.path=[];"]);
  // E) airMove: Q3-style air acceleration with cap, gravity 20 outside pads, coyote jump, instrumentation
  S.push([`e.airVX=clamp(e.airVX+(Math.cos(p.yaw)*mx+Math.sin(p.yaw)*my)*h*motionProfile.air,-32,32);
          e.airVZ=clamp(e.airVZ+(Math.sin(p.yaw)*mx-Math.cos(p.yaw)*my)*h*motionProfile.air,-32,32);`,
    `if(Q&&e.padId===null){
            const wx=Math.cos(p.yaw)*mx+Math.sin(p.yaw)*my,wz=Math.sin(p.yaw)*mx-Math.cos(p.yaw)*my,wl=Math.hypot(wx,wz);
            if(wl>1e-6){const ws=(input.sprint?motionProfile.sprint:motionProfile.walk)*Math.min(1,wl),ux=wx/wl,uz=wz/wl,add=ws-(e.airVX*ux+e.airVZ*uz);
              if(add>0){const before=Math.hypot(e.airVX,e.airVZ),a=Math.min(Q.air*ws*h,add);e.airVX+=a*ux;e.airVZ+=a*uz;const after=Math.hypot(e.airVX,e.airVZ),lim=Math.max(Q.cap,before);if(after>lim){e.airVX*=lim/after;e.airVZ*=lim/after;}}}
          }else{
          e.airVX=clamp(e.airVX+(Math.cos(p.yaw)*mx+Math.sin(p.yaw)*my)*h*motionProfile.air,-32,32);
          e.airVZ=clamp(e.airVZ+(Math.sin(p.yaw)*mx-Math.cos(p.yaw)*my)*h*motionProfile.air,-32,32);}`]);
  S.push(["const old=feet(e);let y=old+e.airVY*h-GRAVITY*h*h/2;e.airVY-=GRAVITY*h;e.airTime+=h;",
    `if(e===p&&Q&&coyote>0){if(jumpBuffer>0&&e.padId===null){e.airVY=Q.jump;e.airTime=0;jumpBuffer=0;coyote=0;HK.jumps++;HK.coyoteJumps=(HK.coyoteJumps||0)+1;emit('jump');}else coyote=Math.max(0,coyote-h);}
        const GR=e===p&&Q&&e.padId===null?Q.g:GRAVITY;const old=feet(e);let y=old+e.airVY*h-GR*h*h/2;e.airVY-=GR*h;e.airTime+=h;`]);
  S.push(["for(const list of [localSolids(e.x,e.z),doorBoxes,trapBoxes])for(const q of list)if(q.minY>=old+1.8-1e-7&&q.minY<y+1.8&&discBox(e.x,e.z,r,q)){y=Math.min(y,q.minY-1.8);e.airVY=0;}",
    "for(const list of [localSolids(e.x,e.z),doorBoxes,trapBoxes])for(const q of list)if(q.minY>=old+1.8-1e-7&&q.minY<y+1.8&&discBox(e.x,e.z,r,q)){y=Math.min(y,q.minY-1.8);e.airVY=0;if(e===p)HK.head++;}"]);
  // horizontal move: instrument the 'higher floor' freeze; optional air step-up (P.airStep metres) while descending
  S.push(["if(ground(nx,e.z)<=y+.02&&!blocked(nx,e.z,r,y)&&!actorBlocked(e,nx,e.z,r,y))e.x=nx;else e.airVX=0;\n        if(ground(e.x,nz)<=y+.02&&!blocked(e.x,nz,r,y)&&!actorBlocked(e,e.x,nz,r,y))e.z=nz;else e.airVZ=0;",
    `{const gxh=ground(nx,e.z);if(gxh<=y+.02&&!blocked(nx,e.z,r,y)&&!actorBlocked(e,nx,e.z,r,y))e.x=nx;else{if(e===p&&gxh>y+.02&&e.airVX!==0){HK.frozen++;if(gxh-y<=.42)HK.frozenNear++;HK.onFreeze&&HK.onFreeze(gxh-y,e.airVY);}
          if(e===p&&Q&&${P.airStep}>0&&e.airVY<=0&&gxh>y+.02&&gxh-y<=${P.airStep}&&!blocked(nx,e.z,r,gxh)&&!actorBlocked(e,nx,e.z,r,gxh)){e.x=nx;HK.airSteps=(HK.airSteps||0)+1;land(e,gxh,-e.airVY);break;}
          e.airVX=0;}
        const gzh=ground(e.x,nz);if(gzh<=y+.02&&!blocked(e.x,nz,r,y)&&!actorBlocked(e,e.x,nz,r,y))e.z=nz;else{if(e===p&&gzh>y+.02&&e.airVZ!==0){HK.frozen++;if(gzh-y<=.42)HK.frozenNear++;HK.onFreeze&&HK.onFreeze(gzh-y,e.airVY);}
          if(e===p&&Q&&${P.airStep}>0&&e.airVY<=0&&gzh>y+.02&&gzh-y<=${P.airStep}&&!blocked(e.x,nz,r,gzh)&&!actorBlocked(e,e.x,nz,r,gzh)){e.z=nz;HK.airSteps=(HK.airSteps||0)+1;land(e,gzh,-e.airVY);break;}
          e.airVZ=0;}}`]);
  // F) locomote: buffered jump at step start; Q3-style ground friction/acceleration for the modern profile
  S.push(["function locomote(dt,input){\n      if(p.airborne){",
    "function locomote(dt,input){\n      if(Q&&!p.airborne&&jumpBuffer>0&&dt>0&&!s.dead){const jx=velocityX,jz=velocityZ;stopMotion();Object.assign(p,{airborne:true,airVX:jx,airVY:Q.jump,airVZ:jz,airTime:0,padId:null});p.dashing=0;jumpBuffer=0;coyote=0;HK.jumps++;emit('jump');}\n      if(p.airborne){"]);
  S.push(["const dot=velocityX*targetX+velocityZ*targetZ,targetSquared=targetX*targetX+targetZ*targetZ;\n        if(magnitude&&dot<0){",
    `const dot=velocityX*targetX+velocityZ*targetZ,targetSquared=targetX*targetX+targetZ*targetZ;
        if(Q){
          const sp=Math.hypot(velocityX,velocityZ);
          if(sp>0){const ns=Math.max(0,sp-Math.max(sp,Q.stop)*Q.friction*part)/sp;velocityX*=ns;velocityZ*=ns;}
          const ws=Math.sqrt(targetSquared);
          if(ws>1e-6){const ux=targetX/ws,uz=targetZ/ws,add=ws-(velocityX*ux+velocityZ*uz);if(add>0){const a=Math.min(Q.accel*ws*part,add);velocityX+=a*ux;velocityZ+=a*uz;}}
          dx=velocityX*part;dz=velocityZ*part;
        }else if(magnitude&&dot<0){`]);
  // G) step(): jump input edge -> buffer; buffer ages after locomotion
  S.push(["locomote(dt,arsenal&&s.equipment.left==='shield'?{...input,dash:false}:input);if(checkPlayerBounds())return;checkPad(p);",
    "if(Q){if(input.jump&&!jumpHeld)jumpBuffer=Q.buffer;jumpHeld=!!input.jump;}locomote(dt,arsenal&&s.equipment.left==='shield'?{...input,dash:false}:input);if(Q)jumpBuffer=Math.max(0,jumpBuffer-dt);if(checkPlayerBounds())return;checkPad(p);"]);
  // H) rush reach (parade prototypes)
  if(P.rushReach!==.9||P.rushStart!==.65){
    S.push(["if(!e.rushHit&&Math.abs(e.baseY-p.y)<.9&&","if(!e.rushHit&&p.y-e.baseY<"+P.rushReach+"&&e.baseY-p.y<.9&&"]);
    S.push(["Math.abs(e.aimY-1.45-e.baseY)<.65&&segmentFree(e.x,e.z,e.aimX,e.aimZ,.38)","e.aimY-1.45-e.baseY<"+P.rushStart+"&&e.baseY-(e.aimY-1.45)<.65&&segmentFree(e.x,e.z,e.aimX,e.aimZ,.38)"]);
  }
  // I) internals for the benches
  S.push(["return {state:s,get destruction(){return destruction;},",
    `const __I={HK,Q,clipBoxes,get solids(){return solids;},doorBoxes,updateDoorBoxes,locomote,airMove,move,support,landingAt,ground,blocked,actorBlocked,checkPad,checkPlayerBounds,beneathTerrain,fallbackLanding,stopMotion,activateMechanism,ray,sight,localSolids,discBox,
      setVel(x,z){velocityX=x;velocityZ=z;},getVel(){return [velocityX,velocityZ];},setJump(b,c){jumpBuffer=b;coyote=c||0;},getJump(){return [jumpBuffer,coyote];},
      setClip(height){clipBoxes.length=0;if(!(height>0))return 0;for(const bd of world.outdoorBoundaries||[]){const c=world.colliders.find(c=>c.mesh===bd.mesh);if(!c)continue;clipBoxes.push({minX:c.minX,maxX:c.maxX,minZ:c.minZ,maxZ:c.maxZ,minY:c.minY,maxY:c.minY+height,base:c.minY,top:c.maxY});}return clipBoxes.length;},
      reachMech(m){const d=Math.hypot(m.x-p.x,m.z-p.z);return d<=2.6&&Math.abs((m.y||0)-p.y)<1.05&&ray([p.x,p.y+1.4,p.z],[(m.x-p.x)/(d||1),0,(m.z-p.z)/(d||1)],Math.max(0,d-.55))>=d-.6;}};
    return {__I,state:s,get destruction(){return destruction;},`]);
  if(P.clip>0)S.push(["rebuildCollision();\n    function syncDestruction(){","rebuildCollision();\n    function syncDestruction(){"]);
  return {simulation:S};
}
// Minimal patch used for the legacy-identity proof: only the internals hook (no behaviour change).
export function hookOnly(){return {simulation:[]};}
