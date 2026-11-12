// usage: node ctx.mjs <file> <regex> [chars]
import {readFileSync} from 'node:fs';
const [file,pat,w='110']=process.argv.slice(2);const W=+w;const re=new RegExp(pat,'g');
readFileSync(file,'utf8').split('\n').forEach((line,i)=>{let m;re.lastIndex=0;while((m=re.exec(line))){console.log((i+1)+': '+line.slice(Math.max(0,m.index-W),m.index+m[0].length+W));if(!m[0].length)re.lastIndex++;}});
