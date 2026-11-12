// Checks the prototype against the waveform rules of checks/audio.test.mjs (except the duration caps).
import {synth} from './doomish.mjs';
function waveform(pcm){let peak=0,sum=0,energy=0,tail=0;for(let i=0;i<pcm.length;i++){const x=pcm[i];peak=Math.max(peak,Math.abs(x));sum+=x;energy+=x*x;if(i>pcm.length*.85)tail+=x*x;}return {peak:+peak.toFixed(3),rms:+Math.sqrt(energy/pcm.length).toFixed(3),dc:+(sum/pcm.length).toFixed(5),tail:+(tail/energy).toFixed(4),seconds:+(pcm.length/22050).toFixed(3)};}
const rows={};for(const n of ['pistol','smg','shotgun','rocket']){const a=synth(n,0),b=synth(n,1);rows[n]={...waveform(a),variantsDiffer:!Buffer.from(a.buffer).equals(Buffer.from(b.buffer)),reproducible:Buffer.from(a.buffer).equals(Buffer.from(synth(n,0).buffer))};}
console.table(rows);console.log('regles du test: peak .8-.85, rms .025-.4, |dc|<.003, tail<.04, variantes differentes, reproductible; plafonds de duree actuels: pistol<.18 smg<.12 shotgun<.35 rocket<.45');
