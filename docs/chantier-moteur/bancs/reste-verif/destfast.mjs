// RESTE-verif: prototype of RESTE-06 (a): damage() hands its compile() result to rebuild() through the group cache.
export const destFast={destruction:[[
`touched.push(g.id);g.active=built.active;g.solids=built.solids;`,
`touched.push(g.id);g.active=built.active;g.solids=built.solids;g.cacheRecord=record;g.cacheCount=record.cuts.length;g.cacheRemoved=!!record.removed;for(const i of g.meshes)renderSlots[i]=[];for(const e of g.active)renderSlots[e.source].push(e);`]]};
export const destTime={destruction:[
[`rebuild();revision++;result.revision=revision;`,`{const __t=performance.now();rebuild();__H.rb+=performance.now()-__t;__H.rbn++;}revision++;result.revision=revision;`],
[`const built=compile(g,record);g.active=built.active;g.solids=built.solids;g.cacheRecord=record;`,`const __t=performance.now();const built=compile(g,record);__H.rc+=performance.now()-__t;__H.rcn++;g.active=built.active;g.solids=built.solids;g.cacheRecord=record;`],
[`let built=compile(g,record);`,`const __u=performance.now();let built=compile(g,record);__H.dc+=performance.now()-__u;__H.dcn++;`],
[`function damage(point,radius,power,bullet,ignoreId,direction){`,`function damage(point,radius,power,bullet,ignoreId,direction){const __d=performance.now();try{return damage0(point,radius,power,bullet,ignoreId,direction);}finally{__H.dm+=performance.now()-__d;__H.dmn++;}}function damage0(point,radius,power,bullet,ignoreId,direction){`]]};
