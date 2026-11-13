// Évalué dans la page (Runtime.evaluate) : relève les rectangles des cibles tactiles et du HUD pendant le jeu.
// Renvoie cibles (taille, marges, test de frappe au centre), chevauchements, tailles de texte.
(function(extraTargets){
  const W=innerWidth,H=innerHeight;
  const vis=el=>{if(!el)return false;const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||el.closest('[hidden]'))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const R=el=>{const r=el.getBoundingClientRect();return {x:+r.left.toFixed(1),y:+r.top.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)};};
  const name=el=>el.id?'#'+el.id:(el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:el.tagName.toLowerCase());
  // Cibles tactiles : tout ce que le pouce doit atteindre pendant le jeu.
  const ids=['move-zone','fire-button','left-fire-button','dash-button','pulse-button','melee-button','interact-button','map-button','pause-button','weapon-switch','left-hand-setting',...(extraTargets||[])];
  const targets=[];
  for(const id of ids){const el=document.getElementById(id);if(!el)continue;let forced=false;if(id==='interact-button'&&el.hidden){el.hidden=false;forced=true;}
    if(vis(el)){const r=R(el),cx=r.x+r.w/2,cy=r.y+r.h/2,top=document.elementFromPoint(cx,cy);
      targets.push({id:'#'+id,...r,min:Math.min(r.w,r.h),contextual:forced,disabled:!!el.disabled,pe:getComputedStyle(el).pointerEvents,
        hit:top===el||el.contains(top)?'ok':(top?name(top):'rien'),edge:{left:r.x,top:r.y,right:+(W-r.x-r.w).toFixed(1),bottom:+(H-r.y-r.h).toFixed(1)}});}
    if(forced)el.hidden=true;}
  for(const el of document.querySelectorAll('#weapon-slots .weapon-slot'))if(vis(el)){const r=R(el);targets.push({id:'#'+el.id,...r,min:Math.min(r.w,r.h),disabled:el.disabled,pe:getComputedStyle(el).pointerEvents,hit:(t=>t===el||el.contains(t)?'ok':(t?name(t):'rien'))(document.elementFromPoint(r.x+r.w/2,r.y+r.h/2)),edge:{left:r.x,top:r.y,right:+(W-r.x-r.w).toFixed(1),bottom:+(H-r.y-r.h).toFixed(1)}});}
  // Blocs du HUD (non interactifs) : pour les chevauchements avec les cibles.
  const blocks=[];
  for(const sel of ['.hud-top','.sector-tag','.top-buttons','.score-status','.objective','#wave-status','#supply-hint','#crosshair','#toast','#encounter','#boss-status','#direction','#radar-wrap','#health-panel','#arsenal','#weapon-readout','.touch-move-label','.touch-look-label']){
    const el=document.querySelector(sel);let forced=false;if(el&&(sel==='#boss-status'||sel==='#wave-status'||sel==='#supply-hint')&&el.hidden){el.hidden=false;forced=true;}
    if(el&&vis(el))blocks.push({id:sel,...R(el),contextual:forced});if(forced)el.hidden=true;}
  const inter=(a,b)=>{const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return w>0&&h>0?+(w*h).toFixed(0):0;};
  const overlaps=[];
  for(let i=0;i<targets.length;i++){
    for(let j=i+1;j<targets.length;j++){const a=inter(targets[i],targets[j]);if(a>0)overlaps.push({a:targets[i].id,b:targets[j].id,px2:a,kind:'cible/cible'});}
    for(const b of blocks){if(b.id==='.hud-top'||b.id==='.top-buttons'&&['#map-button','#pause-button'].includes(targets[i].id))continue;
      if(['#arsenal','#weapon-readout'].includes(b.id)&&(targets[i].id.startsWith('#weapon-slot')||['#weapon-switch','#left-hand-setting'].includes(targets[i].id)))continue;
      const a=inter(targets[i],b);if(a>0)overlaps.push({a:targets[i].id,b:b.id,px2:a,kind:'cible/HUD'+(b.contextual||targets[i].contextual?' (contextuel)':'')});}}
  // Écart minimal entre cibles voisines (bord à bord).
  const gaps=[];for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){const a=targets[i],b=targets[j];const dx=Math.max(0,Math.max(a.x,b.x)-Math.min(a.x+a.w,b.x+b.w)),dy=Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.h,b.y+b.h)),d=Math.hypot(dx,dy);if(d<12&&!inter(a,b))gaps.push({a:a.id,b:b.id,gap:+d.toFixed(1)});}
  // Tailles de texte visibles dans le HUD.
  const texts=[];
  const walker=document.createTreeWalker(document.getElementById('hud'),NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){const t=n.textContent.trim();if(!t)continue;const el=n.parentElement;if(!vis(el))continue;const r=el.getBoundingClientRect();if(r.right<0||r.left>W||r.bottom<0||r.top>H)continue;
    texts.push({el:name(el),px:+parseFloat(getComputedStyle(el).fontSize).toFixed(1),text:t.slice(0,28)});}
  texts.sort((a,b)=>a.px-b.px);
  const hist={};for(const t of texts){const k=t.px<6?'<6':t.px<8?'6-8':t.px<10?'8-10':t.px<12?'10-12':'>=12';hist[k]=(hist[k]||0)+1;}
  const safe=el=>{const d=document.createElement('div');d.style.cssText='position:fixed;left:env(safe-area-inset-left);top:env(safe-area-inset-top);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom)';document.body.appendChild(d);const r=d.getBoundingClientRect();d.remove();return {left:r.left,top:r.top,right:W-r.right,bottom:H-r.bottom};};
  return {viewport:{w:W,h:H,dpr:devicePixelRatio},state:document.body.dataset.state,touchClass:document.body.classList.contains('touch'),canvas:{w:document.getElementById('world').width,h:document.getElementById('world').height},safeArea:safe(),
    targets,blocks,overlaps,gaps,textCount:texts.length,textHist:hist,smallest:texts.slice(0,14),
    minTarget:targets.filter(t=>!t.disabled||true).reduce((m,t)=>Math.min(m,t.min),1e9),under48:targets.filter(t=>t.min<48).map(t=>t.id+' '+t.w+'×'+t.h),under44:targets.filter(t=>t.min<44).length};
})
