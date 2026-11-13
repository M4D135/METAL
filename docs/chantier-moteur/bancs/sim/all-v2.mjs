// Combination of the exact patches (applied in sequence on the same source string).
import {groundPatch} from './ground-v2.mjs';import {blockedV2,segmentV2} from './blocked-v2.mjs';import {debrisV2} from './debris-v2.mjs';import {navLocal} from './nav-local.mjs';import {mirrorPatch} from './mirror.mjs';
export const allPatch=(...which)=>{const set=which.length?which:['ground','blocked','segment','debris','nav'];const list=[];if(set.includes('blocked')||set.includes('debris'))list.push(mirrorPatch);
  if(set.includes('ground'))list.push(...groundPatch(2).simulation);if(set.includes('blocked'))list.push(...blockedV2.simulation);if(set.includes('segment'))list.push(...segmentV2.simulation);
  if(set.includes('debris'))list.push(...debrisV2.simulation);if(set.includes('nav'))list.push(...navLocal.simulation);return {simulation:list};};
