import {loadFast} from './lib.mjs';import {isFloor,isRelief} from './proto.mjs';
const W=loadFast();
for(const index of [0,1,2]){const w=W.FWorld.create(96,index,{campaign:true,campaignVersion:2}),cats={},high={};let n=0;
  for(const g of w.destructibles){if(!isFloor(w,g)||isRelief(w,g))continue;n++;for(const i of g.meshes){const m=w.meshes[i],k=m.category||'sans:mat'+m.mat;cats[k]=(cats[k]||0)+1;const floor=W.FWorld.floorHeight(w,m.p[0],m.p[2]);if(floor===null||m.p[1]-m.s[1]/2-floor>.25)high[k]=(high[k]||0)+1;}}
  console.log('monde',index+1,'groupes « sol »',n,'| maillages par catégorie',JSON.stringify(cats),'| dont à plus de 25 cm du sol',JSON.stringify(high));}
