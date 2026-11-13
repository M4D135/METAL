// Rendu sans interface du module ciel FSky (src/skies.js) : table des préréglages dans Node, puis sonde GPU, contrôle
// miroir, captures et banc de tools/ciel/apercu.html dans Chrome sans tête (constats CIEL-10 et CIEL-11).
// Une commande par appel :
//   --table                          une ligne par monde, distances minimales de signature, temps de resolve ; sans Chrome
//   --sonde                          retient les drapeaux GPU et écrit <travail>/ciel-gpu.json
//   --verif                          apercu.html#mode=verif ; code 1 si maxDiff > 2 ou si la page signale une erreur
//   --captures [--taille 960x540]    monde-NN-<id>.png en mode vue (réglages par défaut), puis planche.png en 1920×540
//   --banc [--res 2560x1440] [--tours 40] [--passes 6] [--leviers]   coût GPU, après le garde-fou de l'ancien ciel
// Options : --chrome <exécutable> ; --gpu auto (ciel-gpu.json, ou sonde s'il manque) ou swiftshader ;
//   --travail <dossier> : profils Chrome neufs et ciel-gpu.json (défaut $TMPDIR/fsky-rendu, hors du dépôt) ;
//   --sortie <dossier> : rendu.json et captures (défaut docs/chantier-moteur/preuves/module-ciel).
// Codes : 0 réussite, 1 contrôle échoué, 2 erreur d'outil. Chrome est lancé par execFileSync, sans shell, ni serveur ni port.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const RACINE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),PAGE=path.join(RACINE,'tools/ciel/apercu.html'),
 MAC=process.platform==='darwin',
 // Annexe F : drapeaux communs ; sur Mac, trousseau factice (HOME déplacé : sans lui, chaque lancement attend environ 11 s).
 COMMUNS=['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update',
  '--disable-sync','--disable-extensions','--disable-breakpad','--disable-crash-reporter','--hide-scrollbars','--force-device-scale-factor=1',
  ...(MAC?['--use-mock-keychain']:[])],
 // Ordre de la sonde : ANGLE Metal d'abord sur Mac, puis les deux jeux GPU de l'annexe F, SwiftShader en dernier recours.
 SWIFTSHADER=['--use-angle=swiftshader','--enable-unsafe-swiftshader'],
 JEUX=[...(MAC?[['--use-angle=metal']]:[]),['--enable-gpu','--ignore-gpu-blocklist','--use-angle=vulkan','--enable-features=Vulkan'],
  ['--enable-gpu','--ignore-gpu-blocklist','--use-angle=gl'],SWIFTSHADER],
 LOGICIEL=/SwiftShader|llvmpipe|softpipe|Software/i,
 AIDE='usage : node tools/ciel/rendu.mjs --table | --sonde | --verif | --captures [--taille LxH] | --banc [--res LxH] [--tours N]'+
  ' [--passes N] [--leviers]\n  options : --chrome EXÉCUTABLE, --gpu auto|swiftshader, --travail DOSSIER, --sortie DOSSIER';

class Arret extends Error{constructor(code,message){super(message);this.code=code;}}
const outil=m=>{throw new Arret(2,m);},
 lireTexte=f=>{try{return fs.readFileSync(path.join(RACINE,f),'utf8');}catch(e){return outil(f+' illisible ('+e.code+')');}};

function lireArguments(argv){
  const o={commande:null,taille:'960x540',res:'2560x1440',tours:'40',passes:'6',leviers:false,gpu:'auto',chrome:null,
   travail:path.join(process.env.TMPDIR||'/tmp','fsky-rendu'),sortie:path.join(RACINE,'docs/chantier-moteur/preuves/module-ciel')},
   propres={taille:['captures'],res:['banc'],tours:['banc'],passes:['banc'],leviers:['banc'],gpu:['verif','captures','banc']},vus=[];
  for(let i=0;i<argv.length;i++){const a=argv[i],k=a.slice(2);
   if(['--table','--sonde','--verif','--captures','--banc'].includes(a)){if(o.commande)outil('une seule commande par appel\n'+AIDE);o.commande=k;}
   else if(a==='--leviers'){o.leviers=true;vus.push(k);}
   else if(a.startsWith('--')&&k!=='commande'&&k!=='leviers'&&Object.prototype.hasOwnProperty.call(o,k)){
    const v=argv[++i];if(v===undefined||v.startsWith('--'))outil(a+' : valeur attendue');o[k]=v;vus.push(k);}
   else outil('argument inconnu : '+a+'\n'+AIDE);}
  if(!o.commande)outil('commande attendue\n'+AIDE);
  for(const k of vus)if(propres[k]&&!propres[k].includes(o.commande))outil('--'+k+' ne s\'applique pas à --'+o.commande);
  const dims=k=>{const m=/^(\d+)x(\d+)$/.exec(o[k]);if(!m||+m[1]<1||+m[2]<1||+m[1]>16384||+m[2]>16384)outil('--'+k+' : LxH attendu, de 1 à 16384 ('+o[k]+')');
    return[+m[1],+m[2]];},
   entier=(k,max)=>{const n=Number(o[k]);if(!/^\d+$/.test(o[k])||n<1||n>max)outil('--'+k+' : entier de 1 à '+max+' attendu ('+o[k]+')');return n;};
  o.taille=dims('taille');o.res=dims('res');o.tours=entier('tours',100000);o.passes=entier('passes',10000);
  if(!['auto','swiftshader'].includes(o.gpu))outil('--gpu : auto ou swiftshader attendu ('+o.gpu+')');
  o.travail=path.resolve(o.travail);o.sortie=path.resolve(o.sortie);
  o.exe=o.chrome===null?(MAC?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'google-chrome'):o.chrome.includes('/')?path.resolve(o.chrome):o.chrome;
  return o;
}

// FSky dans le domaine principal (vm.runInThisContext) : le chantier ne mesure jamais dans un contexte séparé.
let FS=null;
const fsky=()=>{if(!FS){vm.runInThisContext(lireTexte('src/skies.js'),{filename:'src/skies.js'});FS=globalThis.FSky;
  if(!FS||!Array.isArray(FS.presets)||!FS.presets.length)outil('src/skies.js ne pose pas FSky.presets');}return FS;};

function table(){
  const F=fsky(),N=F.presets.length,hex=c=>'#'+F.encode(c).map(v=>v.toString(16).padStart(2,'0')).join(''),
   etats=F.presets.map(p=>F.resolve(p)),ids=etats.map(s=>s.id),sig=etats.map(s=>Array.from(F.signature(s))),pb=[];
  console.log('FSky : '+N+' préréglages ; src/skies.js '+Buffer.byteLength(lireTexte('src/skies.js'))+' octets');
  console.log(' i  id                        principal  exposition  zénith   brouillard  brouillard linéaire');
  etats.forEach((s,i)=>console.log(String(i).padStart(2)+'  '+s.id.padEnd(24)+'  '+s.principal.padEnd(9)+'  '+s.exposure.toPrecision(3).padStart(10)+
   '  '+hex(F.radianceAt(s,[0,1,0]))+'  '+hex(s.fog)+'     '+Array.from(s.fog,v=>v.toFixed(3)).join(' ')));
  // Distances L1 des signatures (annexe D) : totale sur les 22 valeurs, couleur sur les 15 premières ; seuils 60 et 30 (T12).
  if(sig.some(s=>s.length!==22))outil('FSky.signature : 22 entiers attendus');
  if(N>1){let t={d:Infinity},c={d:Infinity};
   for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){let a=0,b=0;for(let k=0;k<22;k++){const e=Math.abs(sig[i][k]-sig[j][k]);a+=e;if(k<15)b+=e;}
    if(a<t.d)t={d:a,i,j};if(b<c.d)c={d:b,i,j};}
   const paire=x=>ids[x.i]+'/'+ids[x.j];
   console.log('distance min '+t.d+' ('+paire(t)+'), couleur '+c.d+(c.i===t.i&&c.j===t.j?'':' ('+paire(c)+')')+' ; seuils 60 et 30');
   if(t.d<60)pb.push('distance totale '+t.d+' < 60 ('+paire(t)+')');if(c.d<30)pb.push('distance couleur '+c.d+' < 30 ('+paire(c)+')');}
  // Temps de resolve (§6.2) : 3 appels de chauffe puis médiane de 21 par préréglage ; objectif 5 ms, limite 15 ms.
  const med=a=>[...a].sort((x,y)=>x-y)[a.length>>1],
   temps=F.presets.map(p=>{for(let k=0;k<3;k++)F.resolve(p);const d=[];
    for(let k=0;k<21;k++){const t0=performance.now();F.resolve(p);d.push(performance.now()-t0);}return med(d);}),
   iMax=temps.indexOf(Math.max(...temps)),moy=temps.reduce((x,y)=>x+y,0)/N;
  console.log('resolve (domaine principal, 3 chauffes puis médiane de 21 appels) : médiane maximale '+temps[iMax].toFixed(3)+' ms ('+ids[iMax]+
   '), moyenne '+moy.toFixed(3)+' ms ; objectif 5 ms, limite 15 ms');
  if(temps[iMax]>15)pb.push('resolve : '+temps[iMax].toFixed(3)+' ms > 15 ms');
  for(const p of pb)console.log('contrôle échoué : '+p);
  return pb.length?1:0;
}

// --dump-dom échappe le texte du pre ; messages de Chrome sans préfixe [pid:tid:date:niveau] ni doublons ; taille lue dans l'IHDR.
const desechapper=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(t,n)=>n[0]==='#'?
  String.fromCodePoint(/^#x/i.test(n)?parseInt(n.slice(2),16):+n.slice(1)):{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'}[n.toLowerCase()]),
 resume=s=>[...new Set(s.split('\n').map(l=>l.replace(/^\[[^\]]*\]\s*/,'').trim()).filter(Boolean))].slice(0,8).join(' | ').slice(0,1500),
 dimensions=b=>b&&b.length>24&&b.readUInt32BE(0)===0x89504e47&&b.toString('latin1',12,16)==='IHDR'?[b.readUInt32BE(16),b.readUInt32BE(20)]:null,
 raison=x=>!x.r?'aucun marqueur dans la sortie'+(x.echec?' ('+x.echec+')':'')+' : '+x.sortie.slice(0,2000)+(x.err?' ; Chrome : '+resume(x.err):''):
  x.r.webgl2===false?'WebGL2 indisponible ('+(x.r.erreurs||[]).join(' ; ')+')':x.image?'capture non conforme':'capture absente (fichier non écrit par Chrome)',
 // JSON lisible : tableaux de valeurs simples et petits objets plats sur une ligne, le reste indenté de deux espaces.
 simple=x=>x===null||typeof x!=='object',
 joli=(v,i='')=>{if(simple(v))return JSON.stringify(v)??'null';
  const t=Array.isArray(v),e=t?v.map(x=>[0,x]):Object.entries(v).filter(p=>p[1]!==undefined),un=([k,x])=>(t?'':JSON.stringify(k)+': ')+joli(x,i+'  '),
   ligne=(t?'[':'{')+e.map(un).join(', ')+(t?']':'}');
  if(!e.length||t&&v.every(simple)||!t&&e.every(p=>simple(p[1])||Array.isArray(p[1])&&p[1].every(simple))&&i.length+ligne.length<=200)return ligne;
  return (t?'[':'{')+'\n'+e.map(p=>i+'  '+un(p)).join(',\n')+'\n'+i+(t?']':'}');};

// Un lancement : profil neuf sous <travail>, supprimé ensuite ; environnement de l'annexe F ; --dump-dom toujours, et --screenshot
// pour une capture : Chrome les écrit après le chargement, pendant lequel la page fait tout son travail.
function lancer(c,frag,{taille=[960,540],capture=false,delai=60}={}){
  fs.mkdirSync(c.travail,{recursive:true});
  const dir=fs.mkdtempSync(path.join(c.travail,'chrome-')),png=path.join(dir,'capture.png'),journal=path.join(dir,'stderr.txt'),home=path.join(dir,'home'),
   env={...process.env,HOME:home,XDG_CONFIG_HOME:path.join(home,'.config'),XDG_CACHE_HOME:path.join(home,'.cache'),TMPDIR:path.join(dir,'tmp')};
  for(const d of [env.XDG_CONFIG_HOME,env.XDG_CACHE_HOME,env.TMPDIR])fs.mkdirSync(d,{recursive:true});
  const args=[...COMMUNS,'--user-data-dir='+path.join(dir,'profil'),'--window-size='+taille.join(','),...c.drapeaux,...(c.sansBac?['--no-sandbox']:[]),
   ...(capture?['--screenshot='+png]:[]),'--dump-dom',pathToFileURL(PAGE).href+'#'+frag],fd=fs.openSync(journal,'w');
  let sortie='',echec='',absent=false;
  try{sortie=execFileSync(c.exe,args,{env,cwd:dir,timeout:delai*1000,encoding:'utf8',maxBuffer:1<<26,stdio:['ignore','pipe',fd]});}
  catch(e){if(e.code==='ENOENT'||e.code==='EACCES')absent=true;else{sortie=String(e.stdout||'');echec=e.code==='ETIMEDOUT'?'délai de '+delai+' s dépassé':'sortie '+(e.signal||e.status);}}
  finally{fs.closeSync(fd);}
  const err=fs.readFileSync(journal,'utf8'),m=[...sortie.matchAll(/@@JSON@@([\s\S]*?)@@END@@/g)].pop(),image=capture&&fs.existsSync(png)?fs.readFileSync(png):null;
  let r=null;if(m)try{r=JSON.parse(desechapper(m[1]));}catch(e){echec='JSON illisible : '+e.message;}
  try{fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{console.log('avertissement : profil non supprimé : '+dir);}
  if(absent)outil('Chrome introuvable ou non exécutable : '+c.exe+' (option --chrome)');
  return {r,image,sortie,err,echec};
}
// Relance une fois si le marqueur, WebGL2 ou une capture conforme manque ; une fois de plus avec --no-sandbox si Chrome
// n'a rien rendu en citant le bac à sable (annexe F : fichiers locaux seulement ; signalé dans rendu.json).
function essayer(c,frag,opts={},conforme=()=>true){
  for(let n=0;;){const x=lancer(c,frag,opts);
   x.ok=!!x.r&&x.r.webgl2!==false&&(!opts.capture||!!x.image)&&conforme(x);
   if(x.ok)return x;
   if(!x.r&&!c.sansBac&&/sandbox/i.test(x.err)){c.sansBac=true;console.log('Chrome cite le bac à sable : relance avec --no-sandbox');continue;}
   if(++n>1)return x;}
}

function version(exe){
  try{return execFileSync(exe,['--version'],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','ignore']}).trim()||'inconnue';}
  catch(e){if(e.code==='ENOENT'||e.code==='EACCES')outil('Chrome introuvable ou non exécutable : '+exe+' (option --chrome)');return 'inconnue';}
}
// Sonde : premier jeu qui donne WebGL2 sans erreur avec un vrai GPU ; à défaut SwiftShader ; sinon erreur d'outil.
function sonder(o,chrome=version(o.exe)){
  const essais=[];let retenu=null,repli=null;
  for(const jeu of JEUX){
   const c={exe:o.exe,travail:o.travail,drapeaux:jeu,sansBac:false},x=essayer(c,'mode=sonde'),r=x.r||{},
    e={drapeaux:jeu,renderer:r.renderer||null,webgl2:r.webgl2===true,programme:r.programme===true,erreurs:x.r?r.erreurs||[]:[raison(x).slice(0,500)],
     sansBacASable:c.sansBac,logiciel:LOGICIEL.test(r.renderer||'')},bon=x.ok&&e.webgl2&&e.programme&&!e.erreurs.length;
   essais.push(e);
   console.log('sonde '+jeu.join(' ')+' : '+(bon?e.renderer+(e.logiciel?' (rendu logiciel)':''):'échec, '+(e.erreurs.join(' ; ')||'WebGL2 absent').slice(0,300)));
   const v={...e,webgl:r.version,MAX_FRAGMENT_UNIFORM_VECTORS:r.MAX_FRAGMENT_UNIFORM_VECTORS};
   if(bon&&(!e.logiciel||jeu===SWIFTSHADER)){retenu=v;break;}
   if(bon&&!repli)repli=v;}
  retenu=retenu||repli;
  if(!retenu)outil('sonde : ni GPU ni SwiftShader ne donnent WebGL2 sans erreur');
  const f=path.join(o.travail,'ciel-gpu.json'),doc={executable:o.exe,chrome,plateforme:process.platform,drapeaux:retenu.drapeaux,
   renderer:retenu.renderer,logiciel:retenu.logiciel,sansBacASable:retenu.sansBacASable,webgl:retenu.webgl,
   MAX_FRAGMENT_UNIFORM_VECTORS:retenu.MAX_FRAGMENT_UNIFORM_VECTORS,essais};
  fs.mkdirSync(o.travail,{recursive:true});fs.writeFileSync(f,joli(doc)+'\n');
  console.log('sonde : '+chrome+' ; drapeaux '+doc.drapeaux.join(' ')+(doc.sansBacASable?' --no-sandbox':'')+' ; renderer '+doc.renderer+
   (doc.logiciel?' (rendu logiciel : coûts processeur)':'')+' ; écrit '+f);
  return doc;
}
// Drapeaux de la sonde mise en cache dans <travail>, refaite si Chrome ou la plateforme ont changé ; --gpu swiftshader la court-circuite.
function configuration(o){
  const chrome=version(o.exe),base={exe:o.exe,chrome,travail:o.travail};
  if(o.gpu==='swiftshader')return {...base,drapeaux:SWIFTSHADER,sansBac:false};
  const f=path.join(o.travail,'ciel-gpu.json');let s=null;
  try{s=JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){if(e.code!=='ENOENT')console.log('sonde : '+f+' illisible');}
  if(!s||s.executable!==o.exe||s.chrome!==chrome||s.plateforme!==process.platform||!Array.isArray(s.drapeaux)){
   console.log('sonde : '+(s?'Chrome a changé depuis '+f:f+' absent')+', sonde lancée');s=sonder(o,chrome);}
  return {...base,drapeaux:s.drapeaux,sansBac:!!s.sansBacASable};
}

// rendu.json : format de la fiche pour le moteur principal (le premier enregistré), autres[renderer] pour un autre moteur.
// Chemins relatifs, aucune date ; tout chemin absolu qui viendrait d'un message est retiré avant l'écriture (R10).
const ORDRE=['chrome','drapeaux','renderer','sansBacASable','verif','captures','banc','autres'],
 ordonner=x=>Object.fromEntries([...ORDRE.filter(k=>k in x),...Object.keys(x).filter(k=>!ORDRE.includes(k))].map(k=>[k,x[k]])),
 relatif=f=>{const r=path.relative(RACINE,f);return r&&!r.startsWith('..')&&!path.isAbsolute(r)?r.split(path.sep).join('/'):path.basename(f);};
function lireRendu(o){const f=path.join(o.sortie,'rendu.json');
  try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){return e.code==='ENOENT'?{}:outil(f+' illisible ('+e.message+') : rien n\'est écrit');}}
function enregistrer(o,c,renderer,maj){
  const f=path.join(o.sortie,'rendu.json'),doc=lireRendu(o);
  if(!doc.renderer)doc.renderer=renderer;
  const cible=doc.renderer===renderer?doc:((doc.autres=doc.autres||{})[renderer]=doc.autres[renderer]||{});
  Object.assign(cible,{chrome:c.chrome,drapeaux:c.drapeaux,sansBacASable:!!c.sansBac});maj(cible);
  if(doc.autres)for(const k in doc.autres)doc.autres[k]=ordonner(doc.autres[k]);
  let s=joli(ordonner(doc));
  const h=process.env.HOME||'';
  for(const [a,b] of [[pathToFileURL(RACINE).href+'/',''],[RACINE+path.sep,''],[o.travail,'<travail>'],...(h.length>1?[[h,'~']]:[])])s=s.split(a).join(b);
  fs.mkdirSync(o.sortie,{recursive:true});fs.writeFileSync(f,s+'\n');
  return f;
}

function verif(o){
  const c=configuration(o),x=essayer(c,'mode=verif');if(!x.ok)outil('verif : '+raison(x));
  const r=x.r,N=fsky().presets.length,mondes=Array.isArray(r.mondes)?r.mondes:[],pb=[...(r.erreurs||[])];
  if(!(r.maxDiff<=2)&&!pb.some(p=>p.startsWith('contrôle miroir')))pb.push('contrôle miroir : maxDiff '+r.maxDiff+' > 2');
  if(mondes.length!==N||mondes.some(m=>!Array.isArray(m.cameras)||m.cameras.length!==2))pb.push(N+' mondes × 2 caméras attendus');
  if(r.controle!==true)pb.push('shader de contrôle FOG_GLSL non lié');
  console.log('verif : '+r.renderer+' ; drapeaux '+c.drapeaux.join(' ')+(c.sansBac?' --no-sandbox':''));
  console.log(' contrôle miroir : maxDiff '+r.maxDiff+' sur '+mondes.length+' mondes × 2 caméras ('+r.points+' points), moyenne '+r.moyenne);
  console.log(' par monde (2 caméras) : '+mondes.map(m=>String(m.monde).padStart(2,'0')+':'+(m.cameras||[]).join('/')).join(' '));
  if(r.tramage)console.log(' tramage : écart max '+r.tramage.maxEcart+', part des niveaux modifiés '+r.tramage.part);
  if(r.brouillard)console.log(' FOG_GLSL seul : maxDiff '+r.brouillard.maxDiff+' ('+r.brouillard.uniformes+' uniformes posés)');
  if(r.masque)console.log(' masque du disque solaire : '+r.masque.id+', alpha '+r.masque.alphaMin+' à '+r.masque.alphaMax+', '+r.masque.pixels+
   ' pixels, écart au disque '+r.masque.ecart+' px');
  console.log(' uniformes actifs : '+r.actifs+', inconnus '+(r.inconnus||[]).length+' ; gl.getError '+r.glError);
  for(const p of pb)console.log('contrôle échoué : '+p);
  const {mode,renderer,webgl2,...reste}=r,f=enregistrer(o,c,r.renderer,d=>{d.verif=reste;});
  console.log((pb.length?'échec':'réussite')+' ; section verif de '+f);
  return pb.length?1:0;
}

// Captures : tout est vérifié (JSON de la page, moteur unique, taille IHDR, au moins 50 000 octets) avant d'écrire quoi que ce soit.
function captures(o){
  const c=configuration(o),F=fsky(),N=F.presets.length,[W,H]=o.taille,PW=320*Math.ceil(N/3),principal=lireRendu(o).renderer,lots=[],pb=[];
  let moteur=null,vide=false;
  const prendre=(frag,taille,nom,attendu,entree)=>{
   const conforme=x=>{const d=dimensions(x.image);return !!d&&d[0]===taille[0]&&d[1]===taille[1]&&x.image.length>=50000&&(moteur===null||x.r.renderer===moteur);},
    x=essayer(c,frag,{taille,capture:true},conforme);
   if(!x.r||x.r.webgl2===false||!x.image)outil(nom+' : '+raison(x));
   const r=x.r,d=dimensions(x.image),e=[...(r.erreurs||[])];
   if(moteur===null){moteur=r.renderer;
    if(principal&&principal!==moteur)outil('les captures de '+o.sortie+' viennent de '+principal+' (moteur principal de rendu.json), pas de '+moteur+
     ' : choisir un autre --sortie');
    console.log('captures '+W+'x'+H+' : '+moteur+' ; fov '+r.fov+', vignette '+r.vignette+', tramage '+r.tramage+', couches '+r.couches+', t '+r.t+', graine '+r.graine);}
   else if(r.renderer!==moteur)e.push('moteur '+r.renderer+' au lieu de '+moteur);
   if(!d||d[0]!==taille[0]||d[1]!==taille[1])e.push('taille '+(d?d.join('x'):'illisible')+' au lieu de '+taille.join('x'));
   if(x.image.length<50000){vide=true;e.push(x.image.length+' octets, moins de 50 000 : image probablement vide');}
   for(const k in attendu)if(r[k]!==attendu[k])e.push(k+' '+r[k]+' au lieu de '+attendu[k]);
   console.log(' '+nom+' '+(d?d.join('x'):'?')+' '+x.image.length+' octets'+(e.length?' : '+e.join(' ; '):''));
   if(e.length)pb.push(nom);else lots.push({nom,image:x.image,entree:{...entree,octets:x.image.length,taille:taille.join('x')}});};
  for(let i=0;i<N;i++){const id=F.presets[i].id,nom='monde-'+String(i).padStart(2,'0')+'-'+id+'.png';
   prendre('mode=vue&monde='+i+'&w='+W+'&h='+H,[W,H],nom,{mode:'vue',monde:i,id,w:W,h:H},{monde:i,id});}
  prendre('mode=planche',[PW,540],'planche.png',{mode:'planche',w:PW,h:540},{monde:null,id:'planche'});
  if(pb.length){console.log('contrôle échoué : '+pb.join(', ')+' ; rien n\'est écrit dans '+o.sortie);
   // Constaté sur GB10 (Vulkan, Linux) : le canvas est juste (verif), mais --screenshot rend une image unie, avec ou sans --dump-dom.
   if(vide&&!LOGICIEL.test(moteur))console.log(' indice : Chrome sans tête peut ne pas composer la surface WebGL d\'un GPU (Vulkan sous Linux) ;'+
    ' --gpu swiftshader produit les captures en rendu logiciel (dans un --sortie dont rendu.json n\'a pas déjà un moteur GPU)');
   return 1;}
  fs.mkdirSync(o.sortie,{recursive:true});
  const liste=lots.map(l=>{const f=path.join(o.sortie,l.nom);fs.writeFileSync(f,l.image);return {...l.entree,fichier:relatif(f)};}),
   total=liste.reduce((s,l)=>s+l.octets,0),f=enregistrer(o,c,moteur,d=>{d.captures=liste.map(({monde,id,fichier,octets,taille})=>({monde,id,fichier,octets,taille}));});
  console.log('réussite : '+liste.length+' fichiers, '+total+' octets'+(total>15e6?' (plus de 15 Mo : refaire avec --taille 800x450)':'')+' ; section captures de '+f);
  return 0;
}

// Garde-fou du banc : l'ancien ciel d'apercu.html doit être la copie exacte de POST_VERT et SKY_FRAG de src/renderer.js.
function garde(){
  const extrait=(f,nom)=>{const m=new RegExp('const '+nom+'=`([^`]*)`').exec(lireTexte(f));if(!m)outil('garde-fou : '+nom+' introuvable dans '+f);
   return m[1].replace(/\s+/g,' ').trim();};
  for(const [a,b] of [['ANCIEN_VERT','POST_VERT'],['ANCIEN_FRAG','SKY_FRAG']]){const x=extrait('tools/ciel/apercu.html',a),y=extrait('src/renderer.js',b);
   if(x!==y){let i=0;while(x[i]===y[i])i++;const bout=s=>(i>24?'…':'')+s.slice(Math.max(0,i-24),i+24)+(s.length>i+24?'…':'');
    outil('garde-fou : '+a+' (tools/ciel/apercu.html) diffère de '+b+' (src/renderer.js) au caractère '+i+' après normalisation des blancs : « '+
     bout(x)+' » contre « '+bout(y)+' » ; recopier l\'ancien ciel avant de mesurer');}}
}
function banc(o){
  garde();
  const c=configuration(o),x=essayer(c,'mode=banc&res='+o.res.join('x')+'&tours='+o.tours+'&passes='+o.passes+(o.leviers?'&leviers=1':''),{delai:300});
  if(!x.ok)outil('banc : '+raison(x));
  const r=x.r,b=r.banc;
  if((r.erreurs||[]).length||!b||!b.ancien)outil('banc : '+((r.erreurs||[]).join(' ; ')||'aucun résultat'));
  console.log('banc '+b.res+', '+b.tours+' tours, '+b.passes+' passes'+(b.leviers?', leviers':'')+' : '+r.renderer);
  console.log(' variante          médiane      p10      p90  rapport   (ms par passe, écart au remplissage uni du même tour)');
  // Un rapport vaut null quand la médiane de l'ancien ciel est nulle (résolution minuscule) : affiché « - », jamais jugé.
  const fini=v=>typeof v==='number'&&Number.isFinite(v),n3=v=>(fini(v)?v.toFixed(3):'-').padStart(9);
  for(const [k,v] of Object.entries(b))if(v&&typeof v==='object')console.log(' '+k.padEnd(14)+[v.mediane,v.p10,v.p90].map(n3).join('')+('rapport' in v?n3(v.rapport):''));
  if(!b.representatif)console.log(' rendu logiciel : coûts processeur, sans valeur pour un GPU (representatif: false)');
  else{const R=k=>b[k]&&fini(b[k].rapport)?b[k].rapport:undefined,j=R('fsky-jour'),cv=R('fsky-couvert'),n=R('fsky-nuit'),l=[],trop=[];
   if(j!==undefined){l.push('fsky-jour '+j+' (objectif 1.0 '+(j<=1?'tenu':'manqué')+', limite 1.15 '+(j<=1.15?'tenue':'dépassée')+')');if(j>1.15)trop.push('fsky-jour');}
   if(cv!==undefined){l.push('fsky-couvert '+cv+' (limite 1.15 '+(cv<=1.15?'tenue':'dépassée')+')');if(cv>1.15)trop.push('fsky-couvert');}
   if(n!==undefined)l.push('fsky-nuit '+n+' (objectif 1.0 '+(n<=1?'tenu':'manqué')+')');
   console.log(' objectifs GPU : '+(l.length?l.join(' ; '):'rapports indisponibles (médiane de l\'ancien ciel nulle)'));
   if(trop.length&&!b.leviers)console.log(' limite dépassée ('+trop.join(', ')+') : mesurer les leviers de coût avec --leviers');
   // L'horloge de la page avance par pas de 0,1 ms : un échantillon trop court donne des médianes grossières (cas du GB10).
   const a=b.ancien.mediane;
   if(fini(a)&&a*b.passes<2)console.log(' conseil : un échantillon de l\'ancien ciel ne dure que '+(a*b.passes).toFixed(2)+' ms pour une horloge au pas de 0,1 ms ;'+
    ' relancer avec --passes '+Math.max(30,6*Math.ceil(2/Math.max(a,.01)/6)));}
  const cle=b.res+(b.leviers?'-leviers':''),f=enregistrer(o,c,r.renderer,d=>{(d.banc=d.banc||{})[cle]=b;});
  console.log('section banc["'+cle+'"] de '+f);
  return 0;
}

try{const o=lireArguments(process.argv.slice(2));
 process.exitCode=o.commande==='table'?table():o.commande==='sonde'?(sonder(o),0):o.commande==='verif'?verif(o):o.commande==='captures'?captures(o):banc(o);}
catch(e){console.error('rendu.mjs : '+(e instanceof Arret?e.message:e&&e.stack||e));process.exitCode=e instanceof Arret?e.code:2;}
