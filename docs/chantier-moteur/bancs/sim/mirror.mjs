// Shared CSR mirror of collisionBuckets (rebuilt lazily whenever `solids` is replaced):
// mirrorStart[cell]..mirrorStart[cell+1] index into mirrorIdx (solids index) and mirrorBox (6 doubles).
export const MIRROR_ANCHOR='    function syncDestruction(){';
export const MIRROR=`    let mirrorFor=null,mirrorStart=new Int32Array(0),mirrorIdx=new Int32Array(0),mirrorBox=new Float64Array(0),solidStamp=new Uint32Array(0),solidSerial=0;
    function ensureMirror(){
      if(mirrorFor===solids)return;mirrorFor=solids;
      const cells=collisionBuckets.length,at=new Map();for(let n=0;n<solids.length;n++)at.set(solids[n],n);
      let total=0;mirrorStart=new Int32Array(cells+1);for(let k=0;k<cells;k++){mirrorStart[k]=total;total+=collisionBuckets[k].length;}mirrorStart[cells]=total;
      mirrorIdx=new Int32Array(total);mirrorBox=new Float64Array(total*6);
      for(let k=0;k<cells;k++){const list=collisionBuckets[k];for(let j=0,o=mirrorStart[k];j<list.length;j++,o++){const q=list[j];mirrorIdx[o]=at.get(q);mirrorBox[o*6]=q.minX;mirrorBox[o*6+1]=q.maxX;mirrorBox[o*6+2]=q.minY;mirrorBox[o*6+3]=q.maxY;mirrorBox[o*6+4]=q.minZ;mirrorBox[o*6+5]=q.maxZ;}}
      solidStamp=new Uint32Array(solids.length);solidSerial=0;
    }
`;
export const mirrorPatch=[MIRROR_ANCHOR,MIRROR+MIRROR_ANCHOR];
