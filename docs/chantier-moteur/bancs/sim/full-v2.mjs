// all-v2 (ground, blocked, segment, debris, nav) + identity-v2 + ray-v2, applied in sequence on one source string.
import {allPatch} from './all-v2.mjs';import {identityV2} from './identity-v2.mjs';import {rayV2} from './ray-v2.mjs';
export const fullPatch=()=>({simulation:[...allPatch().simulation,...identityV2.simulation,...rayV2.simulation]});
