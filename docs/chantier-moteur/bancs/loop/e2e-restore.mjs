// Bout en bout dans le vrai game.js : roquettes 12 s en secteur classique, point de reprise,
// mort simulée, bouton « continuer » -> quel message ? node e2e-restore.mjs <ferro>
import {createHarness} from './harness.mjs';
const H=await createHarness(process.argv[2]);await H.startGame();
H.G.load(0,96,{inventory:{weapons:[true,true,true],ammo:[180,36,12]}},false,1);H.G.saveCheckpoint();H.G.start('bench');
let t=H.now;H.key('keydown','Digit3');H.key('keyup','Digit3');H.key('keydown','KeyW');
for(let i=0;i<720;i++){t+=1000/60;if(i%40===0)H.mouse.down(0);if(i%40===10)H.mouse.up(0);H.mouse.move(i%240<120?4:-4,0);H.G.sim.state.player.hp=Math.max(H.G.sim.state.player.hp,60);H.frame(t);if(H.G.mode!=='playing')H.G.setMode('playing');}
H.key('keyup','KeyW');for(let i=0;i<60&&H.G.sim.state.player.airborne;i++){t+=16.7;H.frame(t);}
H.G.saveCheckpoint();
const raw=H.store.get('ferro-expedition-v2');const saved=JSON.parse(raw);
console.log('sauvegarde',raw.length,'caractères ; débris structurels',saved.checkpoint.state.rubble?.length,'; révision destruction',H.G.sim.destruction?.revision);
H.G.setMode('dead');H.doc.getElementById('continue').click();
for(let i=0;i<400&&H.G.mode!=='playing';i++){t+=16.7;H.frame(t);await H.settle();}
console.log('mode',H.G.mode,'| message :',H.doc.getElementById('toast').textContent);
process.exit(0);
