// usage: node ctx.cjs file pattern [before] [after] [max]
const fs=require('fs');const [file,pat,b='200',a='300',max='40']=process.argv.slice(2);
const lines=fs.readFileSync(file,'utf8').split('\n');const re=new RegExp(pat,'g');let n=0;
lines.forEach((l,i)=>{let m;re.lastIndex=0;while((m=re.exec(l))){if(n++>=+max)return;console.log((i+1)+':'+m.index+': '+l.slice(Math.max(0,m.index-+b),m.index+ +a));console.log('');}});
