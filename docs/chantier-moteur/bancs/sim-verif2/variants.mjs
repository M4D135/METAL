import {allPatch} from '../sim/all-v2.mjs';import {identityV2} from '../sim/identity-v2.mjs';import {rayV2} from '../sim/ray-v2.mjs';
export const ground=()=>allPatch('ground'),blocked=()=>allPatch('blocked'),segment=()=>allPatch('segment'),debris=()=>allPatch('debris'),nav=()=>allPatch('nav'),all=()=>allPatch(),nonav=()=>allPatch('ground','blocked','segment','debris');
export const identity=()=>identityV2,ray=()=>rayV2;
