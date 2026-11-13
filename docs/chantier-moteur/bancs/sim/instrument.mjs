// In-memory source instrumentation: wraps named inner functions of simulation.js with
// a call-stack tracker so each call is attributed to its parent and to the step phase.
export function wrapFunctions(src,names){
  let out=src;
  for(const name of names){
    const sig='function '+name+'(';let at=out.indexOf(sig);
    if(at<0)throw new Error('no function '+name);
    if(out.indexOf(sig,at+1)>=0)throw new Error('duplicate function '+name);
    out=out.slice(0,at)+'function '+name+'__raw('+out.slice(at+sig.length);
    // Insert a hoisted wrapper declaration right before the original.
    const wrapper='function '+name+'(){const __s=__T.stack;__T.enter("'+name+'");__s.push("'+name+'");try{return '+name+'__raw.apply(undefined,arguments);}finally{__s.pop();}}\n';
    out=out.slice(0,at)+wrapper+out.slice(at);
  }
  return out;
}
export function tracker(){
  const T={stack:[],step:0,counts:new Map(),parents:new Map(),phases:new Map(),perStep:new Map(),cur:new Map()};
  T.enter=name=>{
    const st=T.stack,parent=st.length?st[st.length-1]:'(root)',phase=st.length>1?st[1]:st.length===1?'(step-body)':'(outside)';
    T.cur.set(name,(T.cur.get(name)||0)+1);
    const pk=name+' <- '+parent;T.parents.set(pk,(T.parents.get(pk)||0)+1);
    const fk=name+' @ '+phase;T.phases.set(fk,(T.phases.get(fk)||0)+1);
  };
  T.endStep=()=>{for(const [k,v] of T.cur){let a=T.perStep.get(k);if(!a)T.perStep.set(k,a=[]);while(a.length<T.step)a.push(0);a.push(v);}T.cur.clear();T.step++;};
  return T;
}
