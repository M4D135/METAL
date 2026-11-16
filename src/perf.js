/* METAL — modest computers (David, 16/11/2026). A first-launch preset chosen
   from the graphics chip, then a governor that switches costly effects off
   one by one when the frame rate stays low during play. The native
   resolution is never lowered automatically (David, 14/11/2026). */
(function(G){'use strict';
  // Integrated, old or software graphics; and clearly discrete ones.
  const LOW=/swiftshader|llvmpipe|softpipe|software|microsoft basic|intel(\(r\))? (hd|uhd)( graphics)?\b|\bgma\b|mali-(t|g[1-5]\d\b)|adreno( \(tm\))? [3-5]\d\d|powervr|radeon(\(tm\))? r[2-7]\b|vega [3-8] graphics|geforce (gt [1-7]\d\d|[2-9]\d\dm?\b|mx1\d0)/i;
  const HIGH=/\brtx\b|gtx (9[78]0|10[6-8]0|16[5-6]0)|radeon rx|radeon pro|apple m[1-4] (pro|max|ultra)|quadro|titan/i;
  function tier(info){
    const name=String(info&&info.name||''),cores=Number(info&&info.cores)||4,memory=Number(info&&info.memory)||8;
    if(LOW.test(name)||cores<=2||memory<=2)return 'low';
    if(HIGH.test(name)&&cores>=6)return 'high';
    return 'mid';
  }
  function probe(gl,nav){
    let name='';
    try{const ext=gl&&gl.getExtension&&gl.getExtension('WEBGL_debug_renderer_info');name=String(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl&&gl.getParameter?gl.getParameter(gl.RENDERER):'');}catch(_){name='';}
    const info={name,cores:Number(nav&&nav.hardwareConcurrency)||0,memory:Number(nav&&nav.deviceMemory)||0};
    return {...info,tier:tier(info)};
  }
  // Applied once, on the first launch of this version; later choices stay.
  const PRESETS={low:{quality:'low',reflections:'off',shadows:false,bloom:false},mid:{},high:{}};
  function preset(prefs,info){
    if(!prefs||prefs.perfVersion===1)return null;
    const level=info&&PRESETS[info.tier]?info.tier:'mid',changes=PRESETS[level];
    Object.assign(prefs,changes,{perfVersion:1});return {tier:level,changes:Object.keys(changes)};
  }
  // Cheapest visible loss first on integrated graphics.
  const STEPS=[{key:'reflections',value:'off',label:'reflets coupés'},{key:'shadows',value:false,label:'ombres coupées'},{key:'bloom',value:false,label:'éclat lumineux coupé'},{key:'quality',value:'low',label:'détails en économie'}];
  // Fed with the measured frame rate about every 0.75 s. Six low readings in
  // a row (≈ 4.5 s under 83 % of the cadence) take one step, then it waits.
  function governor(){
    let slow=0,wait=0;
    return {
      sample(fps,{cadence=60,playing=false,prefs}={}){
        if(!playing||!prefs||prefs.autoTune===false||!(fps>0)){slow=0;return null;}
        if(wait>0){wait--;return null;}
        if(fps<Math.max(20,cadence*.83))slow++;else slow=Math.max(0,slow-2);
        if(slow<6)return null;
        slow=0;wait=8;return STEPS.find(q=>prefs[q.key]!==q.value)||null;
      },
      reset(){slow=0;wait=0;}
    };
  }
  G.MetalPerf={tier,probe,preset,governor,STEPS,PRESETS};
})(typeof window!=='undefined'?window:globalThis);
