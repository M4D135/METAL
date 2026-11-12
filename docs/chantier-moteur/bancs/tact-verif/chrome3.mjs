import {launch} from '../tact/cdp.mjs';
const root=process.argv[2],here=new URL('.',import.meta.url).pathname;
const C=await launch(here+'chrome-profile');const out={};
try{
  try{await C.send('Emulation.setFocusEmulationEnabled',{enabled:true});}catch{}
  for(const [w,h] of [[390,844],[844,390]]){
    await C.size(w,h,3,true);
    await C.navigate('file://'+root+'/dist/index.html?touch=1');await C.evaluate('localStorage.clear()');await C.navigate('file://'+root+'/dist/index.html?touch=1');
    const b=await C.evaluate(`(()=>{const r=document.getElementById('start').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await C.tap(b.x,b.y,70);await C.waitFor('document.body.dataset.state==="playing"',45000);await C.sleep(7000);
    out[w+'x'+h]=await C.evaluate(`(()=>{const W=innerWidth,H=innerHeight,inter=new Set(['BUTTON','SELECT','INPUT','A']);const z={aim:{n:0,canvas:0,ctrl:0,dead:{}},left:{n:0,canvas:0,ctrl:0,dead:{}}};
      for(let y=2;y<H;y+=4)for(let x=2;x<W;x+=4){const e=document.elementFromPoint(x,y);const k=x>W*.36?'aim':'left';z[k].n++;if(!e)continue;if(e.id==='world'){z[k].canvas++;continue;}
        let n=e,ctl=false;while(n&&n!==document.body){if(inter.has(n.tagName)||n.id==='move-zone'){ctl=true;break;}n=n.parentElement;}
        if(ctl){z[k].ctrl++;continue;}let top=e;while(top.parentElement&&top.parentElement.id!=='hud'&&top.parentElement!==document.body)top=top.parentElement;const nm=top.id?'#'+top.id:'.'+String(top.className).split(' ')[0];z[k].dead[nm]=(z[k].dead[nm]||0)+1;}
      const pc=(a,b)=>+(100*a/b).toFixed(1);const r={};for(const k in z){const d=z[k];r[k]={canvasPct:pc(d.canvas,d.n),commandesPct:pc(d.ctrl,d.n),mortPct:pc(Object.values(d.dead).reduce((a,b)=>a+b,0),d.n),morts:Object.fromEntries(Object.entries(d.dead).map(([a,b])=>[a,pc(b,d.n)]))};}return r;})()`);
  }
}catch(e){out.erreur=String(e.stack||e).slice(0,600);}finally{await C.close();}
console.log(JSON.stringify(out,null,1));
