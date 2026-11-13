// Test fixture: the METAL input table proposed for the hookup (game content, not engine code).
export const V1_KEYS = {forward:['KeyW','KeyZ','ArrowUp'],back:['KeyS','ArrowDown'],left:['KeyA','KeyQ'],right:['KeyD'],turnLeft:['ArrowLeft'],turnRight:['ArrowRight'],fire:['Enter'],fireLeft:['KeyC'],leftHand:['KeyX'],sprint:['ShiftLeft','ShiftRight'],dash:['Space'],pulse:['KeyE'],melee:['KeyV'],interact:['KeyF'],weapon1:['Digit1'],weapon2:['Digit2'],weapon3:['Digit3'],weapon4:['Digit4'],weapon5:['Digit5'],map:['KeyM'],pause:['KeyP']};
export const METAL_INPUT = {
  version: 2, device: 'keyboard',
  actions: [
    {id:'forward',label:'Avancer',type:'hold',keys:['KeyW','KeyZ','ArrowUp'],pad:[]},
    {id:'back',label:'Reculer',type:'hold',keys:['KeyS','ArrowDown'],pad:[]},
    {id:'left',label:'À gauche',type:'hold',keys:['KeyA','KeyQ'],pad:[]},
    {id:'right',label:'À droite',type:'hold',keys:['KeyD'],pad:[]},
    {id:'turnLeft',label:'Tourner à gauche',type:'hold',keys:['ArrowLeft'],pad:[]},
    {id:'turnRight',label:'Tourner à droite',type:'hold',keys:['ArrowRight'],pad:[]},
    {id:'fire',label:'Tirer · main droite',type:'hold',keys:['Enter'],pad:['RT'],mouse:'Clic',touch:'TIR'},
    {id:'fireLeft',label:'Tirer / bouclier · main gauche',type:'hold',keys:['KeyC'],pad:['LT'],mouse:'Clic droit',touch:'TIR G / GARDE',alt:['KeyG','KeyT','KeyY']},
    {id:'leftHand',label:'Changer la main gauche',type:'press',keys:['KeyX'],pad:['RB'],alt:['KeyG','KeyT','KeyY']},
    {id:'sprint',label:'Courir',type:'hold',keys:['ShiftLeft','ShiftRight'],pad:['L3']},
    {id:'jump',label:'Sauter',type:'press',keys:['Space'],pad:['A'],touch:'SAUT',alt:['KeyJ']},
    {id:'dash',label:'Esquive',type:'press',keys:['KeyR'],pad:['B'],touch:'ESQUIVE'},
    {id:'pulse',label:'Onde défensive',type:'press',keys:['KeyE'],pad:['LB'],touch:'ONDE'},
    {id:'melee',label:'Frappe / coup de crosse',type:'press',keys:['KeyV'],pad:['R3'],touch:'FRAPPE',alt:['KeyC','KeyB','KeyN','KeyH']},
    {id:'interact',label:'Interagir',type:'press',keys:['KeyF'],pad:['X']},
    {id:'weaponNext',label:'Arme suivante',type:'press',keys:[],pad:['Y'],mouse:'Molette'},
    {id:'weapon1',label:'Mitraillette',type:'press',keys:['Digit1'],pad:['Up']},
    {id:'weapon2',label:'Double pompe',type:'press',keys:['Digit2'],pad:['Right']},
    {id:'weapon3',label:'Lance-roquettes',type:'press',keys:['Digit3'],pad:['Down']},
    {id:'weapon4',label:'Lance-grenades',type:'press',keys:['Digit4'],pad:['Left'],alt:['KeyG','KeyT','KeyY']},
    {id:'weapon5',label:'Pistolet',type:'press',keys:['Digit5'],pad:[],alt:['KeyG','KeyT','KeyY']},
    {id:'map',label:'Carte',type:'press',keys:['KeyM'],pad:['Back']},
    {id:'pause',label:'Pause',type:'press',keys:['KeyP'],pad:['Start']}
  ],
  sticks: {
    move: {type:'move',x:['left','right'],y:['back','forward'],pad:'LS',run:'sprint'},
    look: {type:'look',x:['turnLeft','turnRight'],y:[],pad:'RS',rate:1.9}
  },
  // v1 -> v2 (FEEL-09): Space leaves the dodge for the jump; the dodge moves to R when R is free.
  migrate(raw, from) {
    const k = raw && raw.keys;
    if (from < 2 && k && typeof k === 'object' && Array.isArray(k.dash) && k.dash.includes('Space')) {
      const used = new Set(Object.keys(k).filter(id => id !== 'dash' && Array.isArray(k[id])).flatMap(id => k[id]));
      const rest = k.dash.filter(c => c !== 'Space');
      k.dash = rest.length ? rest : used.has('KeyR') ? [] : ['KeyR'];
    }
    return raw;
  }
};
export const PAD_IDS = {xbox:'Xbox 360 Controller (XInput STANDARD GAMEPAD)', ps:'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', other:'Generic USB Joystick'};
const NAMES = ['A','B','X','Y','LB','RB','LT','RT','Back','Start','L3','R3','Up','Down','Left','Right','Home'];
export function fakePad({index=0, id=PAD_IDS.xbox, mapping='standard', axes=[0,0,0,0], press={}, actuator=null}={}) {
  return {index, id, mapping, connected:true, timestamp:0, axes:axes.slice(),
    buttons: NAMES.map(n => { const v = press[n] ?? 0; return {pressed: v > .5, touched: v > 0, value: v}; }),
    vibrationActuator: actuator};
}
export function fakeActuator(mode='ok') {
  return {calls: [], playEffect(type, p) { this.calls.push({type, ...p});
    if (mode === 'throw') throw new Error('test'); return mode === 'reject' ? Promise.reject(new Error('test')) : Promise.resolve('complete'); }};
}
export function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
