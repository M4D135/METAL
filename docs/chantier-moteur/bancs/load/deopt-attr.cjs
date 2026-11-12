// Attribute --trace-deopt bailouts (printed between @@STEP markers) to simulation steps.
const lines=require("fs").readFileSync(process.argv[2],"utf8").split("\n");
let pending=[],per=[];let total=0,beforeFirst=0;const byFn=new Map();let started=false;
for(const l of lines){
  if(l.startsWith("@@STEP")){started=true;const [,i,ms,se,pe]=l.split(" ");per.push({i:+i,ms:+ms,se:+se,pe:+pe,deopts:pending});pending=[];continue;}
  if(l.startsWith("@@RECREATE")){console.log(l);continue;}
  const m=l.match(/\[bailout \(kind: ([^,]+), reason: ([^)]+)\): begin\. deoptimizing \S+ <JSFunction (\S+)/);
  if(m){if(!started){beforeFirst++;continue;}pending.push(m[3]+":"+m[2]);total++;const k=m[3]+" | "+m[2];byFn.set(k,(byFn.get(k)||0)+1);}
}
console.log("deopts during world+sim creation",beforeFirst,"; during steps",total);
console.log([...byFn].sort((a,b)=>b[1]-a[1]).slice(0,12).map(x=>"  "+x[1]+"  "+x[0]).join("\n"));
const steps=per;
const spikes=steps.filter(p=>p.ms>8);
console.log("spikes:\n"+spikes.map(p=>"  "+p.i+": "+p.ms+"ms searches="+p.se+" deopts="+p.deopts.length+" ["+[...new Set(p.deopts)].slice(0,5).join(", ")+"]").join("\n"));
const ranges=(process.argv[3]||"0-300,300-900,900-1200,1200-1800").split(",").map(r=>r.split("-").map(Number));
for(const [a,b] of ranges){const x=steps.filter(p=>p.i>=a&&p.i<b);if(!x.length)continue;console.log("steps",a+"-"+b,"deopts",x.reduce((n,p)=>n+p.deopts.length,0),"avg ms",(x.reduce((n,p)=>n+p.ms,0)/x.length).toFixed(3),"max",Math.max(...x.map(p=>p.ms)).toFixed(1));}
