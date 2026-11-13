// Paired, alternated, same process: main realm vs node:vm, min of 9 alternations.
import {loadSet} from './lib.mjs';
const root=process.argv[2];const A=loadSet(root,{realm:'main'}),B=loadSet(root,{realm:'vm'});
const mk=W=>{const w=W.FWorld.create(96,9,{campaign:true,campaignVersion:2});return W.FSimulation.create(w);};
const a=mk(A),b=mk(B);const N=a.nav;const cells=[];for(let i=0;i<N.cells.length;i++)if(N.cells[i])cells.push(i);
let rnd=12345;const R=()=>(rnd=(rnd*1103515245+12345)>>>0)/4294967296;
const pts=Array.from({length:2048},()=>{const [x,z]=N.coord(cells[Math.floor(R()*cells.length)]);return [x+R()*.8-.4,z+R()*.8-.4];});
const edges=[];while(edges.length<2048){const i=cells[Math.floor(R()*cells.length)],j=i+1;if(N.cells[j])edges.push([...N.coord(i),...N.coord(j)]);}
const T={ground:(s,k)=>s.ground(pts[k][0],pts[k][1]),blocked:(s,k)=>s.blocked(pts[k][0],pts[k][1],.4),edge:(s,k)=>s.nav.canTraverse(edges[k][0],edges[k][1],edges[k][2],edges[k][3],.4)};
for(const [name,f] of Object.entries(T)){const m={main:[],vm:[]};
  for(let r=0;r<11;r++)for(const [lab,s] of [['main',a],['vm',b]]){let sink=0;const t=performance.now();for(let rep=0;rep<10;rep++)for(let k=0;k<2048;k++)sink+=f(s,k)?1:0;if(r>1)m[lab].push((performance.now()-t)*1e6/20480);}
  const mn=x=>Math.min(...x);console.log(name,'main min',mn(m.main).toFixed(0),'ns  vm min',mn(m.vm).toFixed(0),'ns  ratio',(mn(m.vm)/mn(m.main)).toFixed(1));}
