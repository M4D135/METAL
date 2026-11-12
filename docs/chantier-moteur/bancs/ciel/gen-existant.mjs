// CIEL : page file:// qui rend le ciel EXISTANT avec le vrai renderer et le vrai générateur de monde de METAL 0.8
// (copies en mémoire ; le dépôt n'est jamais modifié). node gen-existant.mjs <racine-metal> <sortie.html>
import {readFileSync, writeFileSync} from 'node:fs';
const [root,out]=process.argv.slice(2);
const src=n=>readFileSync(root+'/src/'+n,'utf8');
const html=`<!doctype html><meta charset="utf-8"><title>ciel existant</title>
<style>html,body{margin:0;background:#000}canvas{display:block}</style>
<canvas id="c" style="width:1600px;height:900px"></canvas><pre id="out"></pre>
<script>${src('renderer.js')}</script>
<script>${src('world.js')}</script>
<script>
(async()=>{
  const out={shots:{},stats:{},errors:[]};
  window.onerror=(m,s,l,c)=>{out.errors.push(String(m)+' @'+l+':'+c);};
  try{
    const canvas=document.getElementById('c');
    const r=FRender.create(canvas);r.resize('high');
    out.backend=r.stats.backend;
    const flat=document.createElement('canvas');
    function grab(name){
      // copie 2D immédiate (tampon de dessin encore valide dans la même tâche)
      flat.width=canvas.width;flat.height=canvas.height;const ctx=flat.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0);
      out.shots[name]=flat.toDataURL('image/png');return ctx;
    }
    function bands(ctx,x){
      // bandes : longueur des plages de valeur identique le long d'une colonne (canal par canal)
      const h=ctx.canvas.height,d=ctx.getImageData(x,0,1,h).data,res={};
      for(const [k,name] of [[0,'r'],[1,'g'],[2,'b']]){
        let runs=[],run=1,levels=new Set([d[k]]);
        for(let y=1;y<h;y++){const a=d[y*4+k],b=d[(y-1)*4+k];levels.add(a);if(a===b)run++;else{runs.push(run);run=1;}}
        runs.push(run);runs.sort((a,b)=>a-b);
        res[name]={levels:levels.size,maxRun:runs[runs.length-1],medianRun:runs[runs.length>>1],first:d[k],last:d[(h-1)*4+k]};
      }
      return res;
    }
    for(const index of [0,1,2]){
      const w=FWorld.create('ciel',index,{campaign:true}),e=w.environment,s=e.sunDirection;
      const sunYaw=Math.atan2(s[0],-s[2]);
      r.setWorld(w.meshes,w.lights,e);
      const views=[
        ['soleil',{pos:[w.spawn.x,w.spawn.y+1.7,w.spawn.z],yaw:sunYaw+.35,pitch:.30,fov:75}],
        ['arene',{pos:[w.bossArena.x,w.bossArena.y+1.7,w.bossArena.z],yaw:sunYaw+2.3,pitch:.16,fov:75}]
      ];
      for(const [name,camera] of views){
        for(let i=0;i<3;i++)r.draw(camera,[],{time:20+i/60,shadows:true,bloom:true});
        grab('existant-monde'+index+'-'+e.biome+'-'+name);
      }
      // ciel seul (aucune géométrie) : sert à mesurer les bandes
      r.setWorld([],[],e);
      canvas.style.width='2560px';canvas.style.height='1440px';r.resize('high');
      const cam={pos:[0,1.7,0],yaw:sunYaw+2.6,pitch:.42,fov:75};
      r.draw(cam,[],{time:20,shadows:false,bloom:false});
      const ctx=grab('existant-cielseul-'+e.biome+'-2560');
      out.stats['bandes-'+e.biome]={size:[canvas.width,canvas.height],col640:bands(ctx,640),col1900:bands(ctx,1900)};
      canvas.style.width='1600px';canvas.style.height='900px';r.resize('high');
    }
  }catch(error){out.errors.push(String(error&&error.stack||error));}
  document.getElementById('out').textContent='@@JSON@@'+JSON.stringify(out)+'@@END@@';
})();
</script>`;
writeFileSync(out,html);console.log('wrote',out,html.length);
