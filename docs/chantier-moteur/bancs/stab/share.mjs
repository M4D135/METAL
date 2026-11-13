// Part de CPU réellement obtenue (boucle serrée) et vitesse du cœur (itérations par ms CPU).
const t0=process.threadCpuUsage();let x=0;const a=performance.now();const N=+(process.argv[2]||4e7);for(let i=0;i<N;i++)x+=Math.sqrt(i);const b=performance.now();const d=process.threadCpuUsage(t0);const cpu=(d.user+d.system)/1000;
console.log(JSON.stringify({wallMs:+(b-a).toFixed(0),cpuMs:+cpu.toFixed(0),share:+(cpu/(b-a)).toFixed(2),MiterPerCpuMs:+(N/cpu/1e6).toFixed(3)}));
