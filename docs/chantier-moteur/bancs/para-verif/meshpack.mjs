// Contre-verification PARA-06 : cout reel d'un format de maillages COMPLET (identifiants en chaines compris).
import v8 from 'node:v8';import {loadMain,build} from '../para/load.mjs';
const win=loadMain();const {world,sim}=build(win,'campaign-w10');const meshes=sim.destruction.meshes;
const cpu=()=>{const u=process.threadCpuUsage();return (u.user+u.system)/1000;};
const uniq=k=>new Set(meshes.map(q=>q[k]).filter(v=>v!==undefined)).size;
const info={maillages:meshes.length,uniques:{destructibleId:uniq('destructibleId'),region:uniq('region'),category:uniq('category'),shape:uniq('shape'),surface:uniq('surface'),assembly:uniq('assembly'),trophyId:uniq('trophyId')}};
// format du banc d'origine : destructibleId ecrit tel quel dans un Float32Array
const f=new Float32Array(1);let nan=0;for(const q of meshes){f[0]=q.destructibleId??-1;if(Number.isNaN(f[0]))nan++;}info.identifiantsPerdusParLeFormatDuBanc=nan;
function packFull(){const n=meshes.length,W=22,a=new Float32Array(n*W);const D=[],I=new Map();const S=v=>{if(v===undefined)return -1;let i=I.get(v);if(i===undefined){i=D.length;D.push(v);I.set(v,i);}return i;};let o=0;
  for(const q of meshes){a[o++]=S(q.shape);a[o++]=q.p[0];a[o++]=q.p[1];a[o++]=q.p[2];a[o++]=q.s[0];a[o++]=q.s[1];a[o++]=q.s[2];a[o++]=q.mat;a[o++]=q.color?q.color[0]:NaN;a[o++]=q.color?q.color[1]:NaN;a[o++]=q.color?q.color[2]:NaN;a[o++]=q.r?q.r[0]:NaN;a[o++]=q.r?q.r[1]:NaN;a[o++]=q.r?q.r[2]:NaN;a[o++]=S(q.destructibleId);a[o++]=S(q.region);a[o++]=S(q.category);a[o++]=S(q.surface);a[o++]=q.emissive??NaN;a[o++]=q.detail??NaN;a[o++]=S(q.assembly)*64+ (S(q.trophyId)+1);a[o++]=(q.outdoor?1:0)|(q.ground===undefined?0:q.ground?2:4)|(q.solid===undefined?0:q.solid?8:16)|(q.structural?32:0)|(q.terrain?64:0)|(q.indestructible?128:0);}
  return {a,D};}
const R=[];for(let k=0;k<7;k++){const c0=cpu();const {a,D}=packFull();const c1=cpu();const ser=v8.serialize(D);const c2=cpu();const back=v8.deserialize(ser);const c3=cpu();
  // reconstruction d'objets cote page (ce dont renderer.setWorld a besoin aujourd'hui)
  const out=new Array(meshes.length);let o=0;const g=i=>i<0?undefined:back[i];for(let i=0;i<meshes.length;i++){const q={shape:g(a[o]),p:[a[o+1],a[o+2],a[o+3]],s:[a[o+4],a[o+5],a[o+6]],mat:a[o+7]};if(!Number.isNaN(a[o+8]))q.color=[a[o+8],a[o+9],a[o+10]];if(!Number.isNaN(a[o+11]))q.r=[a[o+11],a[o+12],a[o+13]];const d=g(a[o+14]);if(d!==undefined)q.destructibleId=d;q.region=g(a[o+15]);out[i]=q;o+=22;}
  const c4=cpu();R.push({packWorker:c1-c0,serDict:c2-c1,deserDictPage:c3-c2,rebuildObjetsPage:c4-c3,octets:a.byteLength+ser.length,dict:D.length});}
R.sort((x,y)=>x.deserDictPage+x.rebuildObjetsPage-y.deserDictPage-y.rebuildObjetsPage);const m=R[3];
info.formatComplet={octets:m.octets,entreesDictionnaire:m.dict,empaquetageWorkerMs:+m.packWorker.toFixed(2),dictSerialisationMs:+m.serDict.toFixed(2),pageDeserialisationDictMs:+m.deserDictPage.toFixed(2),pageReconstructionObjetsMs:+m.rebuildObjetsPage.toFixed(2)};
console.log(JSON.stringify(info,null,1));
