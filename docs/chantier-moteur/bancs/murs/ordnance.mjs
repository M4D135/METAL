import {loadFast} from './lib.mjs';
const W=loadFast();
for(const index of [0,3,9,17]){
  const w=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});
  const ord=w.enemies.map((e,i)=>({i,weapon:e.weapon,type:e.type,deployed:e.deployed})).filter(e=>e.weapon==='rocket'||e.weapon==='grenade');
  console.log('monde',index+1,'ennemis',w.enemies.length,'grenadiers',ord.filter(e=>e.weapon==='grenade').length,'roquettiers',ord.filter(e=>e.weapon==='rocket').length,'profil',JSON.stringify(w.campaignProfile).slice(0,160));
  for(const q of w.encounters||[]){const per=q.waves.map(wv=>wv.enemyIds.filter(id=>['rocket','grenade'].includes(w.enemies[id].weapon)).length+'/'+wv.enemyIds.length);console.log('   ',q.id,'zone',q.zoneId,w.rooms[q.zoneId]?.bossArena?'(arène)':'','vagues (explosifs/total):',per.join(' '));}
}
