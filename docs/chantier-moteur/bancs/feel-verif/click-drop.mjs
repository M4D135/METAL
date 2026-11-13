// Does a short click (mousedown+mouseup between two frames) fire? Real game.js shell, stubbed browser.
import {harness,world} from './shell-harness.mjs';
const app=harness(null,{},world);app.element('start').click();app.frame(16);
const sim=app.simulations.at(-1);
const shots=()=>sim.state.shots;
for(let i=0;i<40;i++)app.frame(16); // settle
const r={};
let s0=shots();app.element('world').emit('mousedown',{button:0});app.frame(16);app.emit('mouseup',{button:0});for(let i=0;i<40;i++)app.frame(16);r.clicTenuUneImage=shots()-s0;
s0=shots();app.element('world').emit('mousedown',{button:0});app.emit('mouseup',{button:0});for(let i=0;i<40;i++)app.frame(16);r.clicBrefEntreDeuxImages=shots()-s0;
s0=shots();app.key('Enter');app.key('Enter',false);for(let i=0;i<40;i++)app.frame(16);r.toucheEntreeBreve=shots()-s0;
s0=shots();const d0=sim.state.player.dash;app.key('Space');app.key('Space',false);app.frame(16);r.espaceBrefDeclencheEsquive=sim.state.player.dash>d0;
console.log(JSON.stringify(r));
