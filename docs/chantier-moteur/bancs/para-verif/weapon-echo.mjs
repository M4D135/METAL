// PARA-V : input.weapon est un echo de niveau de l'etat (game.js:686,694,237). Avec un etat en retard d'un tick, l'echo perime annule un ramassage d'arme.
// Le ramassage est emule exactement comme simulation.js:611 : inventory.weapons[k]=true puis selectWeapon(k).
import {loadMain,build} from '../para/load.mjs';
const win=loadMain();
for(const sc of ['legacy-s0','campaign-w10']){const {sim}=build(win,sc);const s=sim.state;const w0=s.weapon;sim.step(1/60,{weapon:w0});
  let k=-1;for(let i=0;i<s.inventory.weapons.length;i++)if(i!==w0&&!s.inventory.weapons[i]){k=i;break;}
  if(k<0){for(let i=0;i<s.inventory.weapons.length;i++)if(i!==w0){k=i;break;}}
  s.inventory.weapons[k]=true;const ok=sim.selectWeapon(k);const apresRamassage=s.weapon;
  sim.step(1/60,{weapon:w0});const apresEchoPerime=s.weapon;
  sim.selectWeapon(k);sim.step(1/60,{weapon:s.weapon});const apresEchoAJour=s.weapon;
  console.log(JSON.stringify({scenario:sc,armeInitiale:w0,armeRamassee:k,selectOk:ok,apresRamassage,apresUnPasAvecEchoPerime:apresEchoPerime,apresUnPasAvecEchoAJour:apresEchoAJour}));}
