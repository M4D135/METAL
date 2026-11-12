#!/usr/bin/env python3
# Version 2 de la règle « murs = armes lourdes », appliquée à la COPIE DE TRAVAIL bench/murs/work (jamais au dépôt).
# world.js n'est PAS modifié : la classe de blindage est une fonction pure des données existantes (kind, category,
# dimensions), passée à FDestruction.create(world,{armor}). L'objet monde, son JSON, l'empreinte de simulation et la
# signature de destruction restent identiques octet pour octet.
# usage : apply_rule.py <racine de la copie> <racine METAL d'origine>
import sys,shutil
root,orig=sys.argv[1],sys.argv[2]
for n in ['world','destruction','simulation']:shutil.copyfile(f"{orig}/src/{n}.js",f"{root}/src/{n}.js")
def patch(name,pairs):
    p=f"{root}/src/{name}.js";s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        n=s.count(a)
        if n!=1:raise SystemExit(f"{name}: ancre trouvée {n} fois : {a[:90]}")
        s=s.replace(a,b)
    open(p,'w',encoding='utf-8').write(s)
patch('destruction',[
 ("  function create(world){\n    const originalMeshes=world.meshes||[]",
  "  function create(world,options={}){\n    const armorOf=typeof options.armor==='function'?options.armor:null;\n    const originalMeshes=world.meshes||[]"),
 ("g.originalVolume=g.colliders.reduce((v,i)=>v+volume(originalColliders[i]),0);groups.set(g.id,g);",
  "g.originalVolume=g.colliders.reduce((v,i)=>v+volume(originalColliders[i]),0);g.armor=armorOf?Math.max(0,Math.min(2,armorOf(g,world)|0)):0;groups.set(g.id,g);"),
 ("    function damage(point,radius,power,bullet,ignoreId,direction){",
  "    function damage(point,radius,power,bullet,ignoreId,direction,heavy=!bullet){"),
 ("const result={changed:false,revision,debris:[],events:[],pipeLeaks:[],collapsed:[]},fallen=[];",
  "const result={changed:false,revision,debris:[],events:[],pipeLeaks:[],collapsed:[],deflected:0},fallen=[];"),
 ("amount=power*(bullet?1:Math.pow(Math.max(0,1-d/radius),.45));if(amount<=.02)continue;",
  "amount=power*(bullet?1:Math.pow(Math.max(0,1-d/radius),.45));if(amount<=.02)continue;\n"
  "        // Armour 1 yields only to heavy ordnance, armour 2 to nothing. A refused\n"
  "        // blow is feedback only: chips and an impact event, no accumulated\n"
  "        // damage, no cut, no revision and no saved state.\n"
  "        if(g.armor>(heavy?1:0)){if(bullet||g.armor<2)chipsFor(g,nearest,impact,amount,result.debris);result.events.push({name:'materialImpact',x:impact[0],y:impact[1],z:impact[2],sourceId:g.id,material:materialOf(nearest.mesh),power:amount,seed:nearest.source*977+(revision+1)*911+Math.imul(Math.round(impact[0]*97)+Math.round(impact[1]*193)+Math.round(impact[2]*389),2654435761),deflected:true});result.deflected++;continue;}"),
 ("hit:(point,power,direction)=>damage(point,.22,power,true,undefined,validPoint(direction)?direction:undefined),blast:(point,radius,power,ignoreId)=>damage(point,radius,power,false,ignoreId)",
  "armor:id=>groups.get(String(id))?.armor||0,\n      hit:(point,power,direction,options)=>damage(point,.22,power,true,undefined,validPoint(direction)?direction:undefined,options?.heavy===true),blast:(point,radius,power,ignoreId,options)=>damage(point,radius,power,false,ignoreId,undefined,options?.heavy!==false)"),
])
patch('simulation',[
 ("  const ownsGear=(gear,inventory)=>",
  "  // Breach rule: walls, roofs, perimeter walls and load-bearing piers yield only to\n"
  "  // heavy ordnance (1); backdrop relief and flat floor dressing never break (2).\n"
  "  // A pure function of existing world data: the world object, its fingerprint and\n"
  "  // every saved checkpoint stay exactly as they were.\n"
  "  const RELIEF=['hill','cliff','cliff_stratum'],FLOOR=['arena_inlay','floor_drain','threshold','hazard_marking','trail','ground_patch','leaf_litter','jump_landing','dock_warning','trap_warning','arena_path_mark','trap_plate'];\n"
  "  const breachArmor=(g,world)=>{\n"
  "    const meshes=g.meshes.map(i=>world.meshes[i]),c=g.colliders.length?world.colliders[g.colliders[0]]:null,m=c?world.meshes[c.mesh]:null;\n"
  "    if(meshes.some(q=>RELIEF.includes(q.category))||!c&&meshes.every(q=>FLOOR.includes(q.category)||q.s[1]<=.06&&!(q.r||[]).some(v=>Math.abs(v)>.01)))return 2;\n"
  "    return g.kind==='wall'||g.kind==='roof'||!!m&&(m.category==='boundary'||g.kind==='support'&&Math.min(c.maxX-c.minX,c.maxZ-c.minZ)>=.6)?1:0;\n"
  "  };\n"
  "  const ownsGear=(gear,inventory)=>"),
 ("    let destruction=G.FDestruction?.create(world)||null,trapStates=[];",
  "    let destruction=G.FDestruction?.create(world,{armor:breachArmor})||null,trapStates=[];"),
 ("        let candidate=G.FDestruction?.create(world)||null;",
  "        let candidate=G.FDestruction?.create(world,{armor:breachArmor})||null;"),
 ("    function damageScenery(point,power,r=0,direction,ignoreId){",
  "    function damageScenery(point,power,r=0,direction,ignoreId,heavy=r>0){"),
 ("const result=destruction&&(r>0?destruction.blast(point,r,power,ignoreId):destruction.hit(point,power,direction));sceneryResult(result,point,power);",
  "const result=destruction&&(r>0?destruction.blast(point,r,power,ignoreId,{heavy}):destruction.hit(point,power,direction,{heavy}));sceneryResult(result,point,power);\n"
  "      if(result?.deflected&&!r&&!ricochetWait){ricochetWait=.09;emit('ricochet',{x:point[0],y:point[1],z:point[2],material:result.events.find(e=>e.deflected)?.material||'stone',count:result.deflected});}"),
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
print('règle v2 appliquée (world.js inchangé)')
