import {createHash} from 'node:crypto';import {loadFast} from '../murs/lib.mjs';
const O=loadFast({modules:['renderer','world']});
console.log('pristine 673d6b2 create(1,2) sha256 =',createHash('sha256').update(JSON.stringify(O.FWorld.create(1,2))).digest('hex'));
