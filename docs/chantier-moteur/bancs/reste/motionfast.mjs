// RESTE-P1: exact, allocation-light FMotion.vector/mount/place (src/motion.js, identical file in METAL 673d6b2 and FERRO 248043a).
// Same arithmetic in the same order; per-frame-object memo of the two Euler terms that do not depend on rx,
// and of the rx-dependent term for the last rx seen (parts of one model mostly share rx).
export const motionFast={motion:[
 [`  const vector=(axes,v)=>[0,1,2].map(k=>axes[0][k]*v[0]+axes[1][k]*v[1]+axes[2][k]*v[2]);`,
  `  const vector=(axes,v)=>{const a=axes[0],b=axes[1],c=axes[2],x=v[0],y=v[1],z=v[2];return [a[0]*x+b[0]*y+c[0]*z,a[1]*x+b[1]*y+c[1]*z,a[2]*x+b[2]*y+c[2]*z];};`],
 [`    return {pos:camera.pos.map((v,k)=>v+shift[k]),axes:rotation(...angles).map(v=>vector(axes,v))};`,
  `    const R=rotation(angles[0],angles[1],angles[2]),P=camera.pos;
    return {pos:P.length===3?[P[0]+shift[0],P[1]+shift[1],P[2]+shift[2]]:P.map((v,k)=>v+shift[k]),axes:[vector(axes,R[0]),vector(axes,R[1]),vector(axes,R[2])],ry:NaN,rz:0,regular:false,rx:NaN,r0:0};`],
 [`    const shift=vector(frame.axes,offset),c=Math.cos(rx),s=Math.sin(rx);
    const axes=[frame.axes[0],frame.axes[1].map((v,k)=>v*c+frame.axes[2][k]*s),frame.axes[2].map((v,k)=>v*c-frame.axes[1][k]*s)];
    const ry=Math.asin(clamp(-axes[0][2],-1,1)),regular=Math.abs(Math.cos(ry))>1e-6;
    const r=regular?[Math.atan2(axes[1][2],axes[2][2]),ry,Math.atan2(axes[0][1],axes[0][0])]:[Math.atan2(-axes[2][1],axes[1][1]),ry,0];
    return {p:frame.pos.map((v,k)=>v+shift[k]),r};`,
  `    const A=frame.axes,a0=A[0],a1=A[1],a2=A[2],P=frame.pos,x=offset[0],y=offset[1],z=offset[2];
    if(frame.ry===undefined||frame.ry!==frame.ry){frame.ry=Math.asin(clamp(-a0[2],-1,1));frame.regular=Math.abs(Math.cos(frame.ry))>1e-6;frame.rz=frame.regular?Math.atan2(a0[1],a0[0]):0;frame.rx=NaN;}
    if(frame.rx!==rx){const c=Math.cos(rx),s=Math.sin(rx);frame.r0=frame.regular?Math.atan2(a1[2]*c+a2[2]*s,a2[2]*c-a1[2]*s):Math.atan2(-(a2[1]*c-a1[1]*s),a1[1]*c+a2[1]*s);frame.rx=rx;}
    return {p:[P[0]+(a0[0]*x+a1[0]*y+a2[0]*z),P[1]+(a0[1]*x+a1[1]*y+a2[1]*z),P[2]+(a0[2]*x+a1[2]*y+a2[2]*z)],r:[frame.r0,frame.ry,frame.rz]};`],
]};
