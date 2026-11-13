// Parameter sweep of the Q3-style ground model (metres, 120 Hz substeps).
const HZ=120,DT=1/HZ;
function m(P){
  const fr=(v,h)=>{const s=Math.hypot(v[0],v[1]);if(s<1e-4){v[0]=v[1]=0;return;}const c=Math.max(s,P.stop),ns=Math.max(0,s-c*P.friction*h);v[0]*=ns/s;v[1]*=ns/s;};
  const ac=(v,w,ws,r,h)=>{const cur=v[0]*w[0]+v[1]*w[1],add=ws-cur;if(add<=0)return;const a=Math.min(r*ws*h,add);v[0]+=a*w[0];v[1]+=a*w[1];};
  let v=[0,0],t=0;while(v[1]<.9*P.run&&t<2){fr(v,DT);ac(v,[0,1],P.run,P.accel,DT);t+=DT;}const t90=t;
  v=[0,P.run];t=0;let d=0;while(Math.hypot(...v)>.05&&t<3){fr(v,DT);d+=v[1]*DT;t+=DT;}const stop=t,sd=d;
  v=[0,P.run];t=0;while(v[1]>-.9*P.run&&t<2){fr(v,DT);ac(v,[0,-1],P.run,P.accel,DT);t+=DT;}const rev=t;
  // steady speed reached under friction+accel
  v=[0,0];for(let i=0;i<600;i++){fr(v,DT);ac(v,[0,1],P.run,P.accel,DT);}
  return {accel:P.accel,friction:P.friction,stop:P.stop,t90_ms:Math.round(t90*1000),stop_ms:Math.round(stop*1000),stop_m:+sd.toFixed(2),reverse90_ms:Math.round(rev*1000),steady:+v[1].toFixed(2)};
}
const rows=[];for(const [a,f,s] of [[10,6,2.54],[12,10,2.5],[15,8,2.5],[16,9,2.2],[18,10,2.0],[20,10,2.5],[18,8,2.5],[14,8,3.0]])rows.push(m({run:7.6,accel:a,friction:f,stop:s}));
console.table(rows);
