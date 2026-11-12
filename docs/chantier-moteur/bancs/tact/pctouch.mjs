// PC à écran tactile (navigator.maxTouchPoints=10, souris présente, pas de ?touch=1) : le jeu passe-t-il en mode tactile ?
import {createHarness} from '../loop/harness.mjs';
const root=process.argv[2];
async function run(mtp){
  let lockCalls=0;
  const H=createHarness(root,{search:'',width:1920,height:1080,dpr:1,beforeGame(ctx){ctx.navigator.maxTouchPoints=mtp;}});
  const rl=H.canvas.requestPointerLock.bind(H.canvas);H.canvas.requestPointerLock=()=>{lockCalls++;return rl();};
  await H.startGame();for(let i=0;i<10;i++)H.frame(H.now+16.6);
  const p=H.G.sim.state.player,yaw0=p.yaw;
  H.mouse.move(200,0);H.frame(H.now+16.6);const afterMove=p.yaw-yaw0;
  return {maxTouchPoints:mtp,classeTouch:H.doc.body.classList.contains('touch'),appelsPointerLock:lockCalls,verrouille:!!H.doc.pointerLockElement,lacetApresSouris200px:+afterMove.toFixed(4),assist:H.G.input.assist,fov:H.G.prefs.fov};
}
console.log(JSON.stringify([await run(0),await run(10)],null,1));
