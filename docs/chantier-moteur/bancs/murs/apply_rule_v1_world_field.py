#!/usr/bin/env python3
# Applique la règle « murs = armes lourdes » à la COPIE DE TRAVAIL bench/murs/work (jamais au dépôt).
# usage : apply_rule.py <racine de la copie> [R2|R3]
import sys,io
root=sys.argv[1];DEF=sys.argv[2] if len(sys.argv)>2 else 'R3'
def patch(name,pairs):
    p=f"{root}/src/{name}.js";s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        n=s.count(a)
        if n!=1:raise SystemExit(f"{name}: ancre trouvée {n} fois : {a[:90]}")
        s=s.replace(a,b)
    open(p,'w',encoding='utf-8').write(s)
boundary="m.category==='boundary'||" if DEF=='R3' else ""
patch('world',[
 ("    w.destructibles=groups;w.destructionVersion=1;",
  "    w.destructibles=groups;w.destructionVersion=1;\n"
  "    // Walls, roofs, perimeter walls and load-bearing piers yield only to heavy\n"
  "    // ordnance. The list lives beside w.destructibles so that simulation\n"
  "    // fingerprints, and therefore existing checkpoints, remain valid.\n"
  "    w.armored=groups.filter(g=>{const c=g.colliders.length?w.colliders[g.colliders[0]]:null,m=c?out[c.mesh]:null;return g.kind==='wall'||g.kind==='roof'||!!m&&("+boundary+"g.kind==='support'&&Math.min(c.maxX-c.minX,c.maxZ-c.minZ)>=.6);}).map(g=>g.id);"),
])
patch('destruction',[
 ("    const foliage=originalMeshes.some(m=>m.shape==='foliage')?sharedFoliage():null;",
  "    const armored=new Set(world.armored||[]);\n    const foliage=originalMeshes.some(m=>m.shape==='foliage')?sharedFoliage():null;"),
 ("g.originalVolume=g.colliders.reduce((v,i)=>v+volume(originalColliders[i]),0);groups.set(g.id,g);",
  "g.originalVolume=g.colliders.reduce((v,i)=>v+volume(originalColliders[i]),0);g.armored=armored.has(g.id);groups.set(g.id,g);"),
 ("    function damage(point,radius,power,bullet,ignoreId,direction){",
  "    function damage(point,radius,power,bullet,ignoreId,direction,heavy=!bullet){"),
 ("amount=power*(bullet?1:Math.pow(Math.max(0,1-d/radius),.45));if(amount<=.02)continue;",
  "amount=power*(bullet?1:Math.pow(Math.max(0,1-d/radius),.45));if(amount<=.02)continue;\n"
  "        // Light fire on an armoured body is feedback only: chips and an impact\n"
  "        // event, no accumulated damage, no cut, no revision, no saved state.\n"
  "        if(g.armored&&!heavy){chipsFor(g,nearest,impact,amount,result.debris);result.events.push({name:'materialImpact',x:impact[0],y:impact[1],z:impact[2],sourceId:g.id,material:materialOf(nearest.mesh),power:amount,seed:nearest.source*977+(revision+1)*911,deflected:true});result.deflected++;continue;}"),
 ("const result={changed:false,revision,debris:[],events:[],pipeLeaks:[],collapsed:[]},fallen=[];",
  "const result={changed:false,revision,debris:[],events:[],pipeLeaks:[],collapsed:[],deflected:0},fallen=[];"),
 ("hit:(point,power,direction)=>damage(point,.22,power,true,undefined,validPoint(direction)?direction:undefined),blast:(point,radius,power,ignoreId)=>damage(point,radius,power,false,ignoreId)",
  "isArmored:id=>!!groups.get(String(id))?.armored,\n      hit:(point,power,direction,options)=>damage(point,.22,power,true,undefined,validPoint(direction)?direction:undefined,options?.heavy===true),blast:(point,radius,power,ignoreId,options)=>damage(point,radius,power,false,ignoreId,undefined,options?.heavy!==false)"),
])
patch('simulation',[
 ("    function damageScenery(point,power,r=0,direction,ignoreId){",
  "    function damageScenery(point,power,r=0,direction,ignoreId,heavy=r>0){"),
 ("const result=destruction&&(r>0?destruction.blast(point,r,power,ignoreId):destruction.hit(point,power,direction));sceneryResult(result,point,power);",
  "const result=destruction&&(r>0?destruction.blast(point,r,power,ignoreId,{heavy}):destruction.hit(point,power,direction,{heavy}));sceneryResult(result,point,power);\n"
  "      if(result?.deflected&&!ricochetWait){ricochetWait=.09;emit('ricochet',{x:point[0],y:point[1],z:point[2],material:result.events.find(e=>e.deflected)?.material||'stone',count:result.deflected});}"),
 ("        d.hp=Math.max(0,d.hp-power*(r?Math.max(.2,1-distance/r):1));",
  "        if(!heavy){if(!ricochetWait){ricochetWait=.09;emit('ricochet',{x:point[0],y:point[1],z:point[2],material:'metal',count:1,door:d.id});}continue;}\n"
  "        d.hp=Math.max(0,d.hp-power*(r?Math.max(.2,1-distance/r):1));"),
 ("      damageScenery(point,terrainPower,r,undefined,ignoreId);syncDestruction();hear(point[0],point[2],34,point[1]);",
  "      damageScenery(point,terrainPower,r,undefined,ignoreId,kind!=='steam');syncDestruction();hear(point[0],point[2],34,point[1]);"),
 ("      s.time+=dt;s.elapsed+=dt;fireWait=Math.max(0,fireWait-dt);",
  "      s.time+=dt;s.elapsed+=dt;ricochetWait=Math.max(0,ricochetWait-dt);fireWait=Math.max(0,fireWait-dt);"),
 ("    function distanceBox(point,q){",
  "    let ricochetWait=0;\n    function distanceBox(point,q){"),
])
print('règle appliquée :',DEF)
