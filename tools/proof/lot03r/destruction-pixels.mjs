import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [base,head,out]=process.argv.slice(2),{withChrome}=await import(pathToFileURL(head+'/tools/render/chrome.mjs')),{diffImages}=await import(pathToFileURL(head+'/tools/render/image-diff.mjs'));
const report={schema:'metal-03r-destruction-pixels-v1',base,head,scenarios:[]};
await withChrome({angle:'swiftshader',window:[800,500]},async browser=>{
  const pages=await Promise.all([base,head].map(root=>browser.openPage(root+'/tools/render/pages/lot03r-scene.html')));
  for(const stage of [6,17])for(const backend of ['webgl2','canvas2d']){
    const options={world:stage,campaign:true,width:640,height:400,quality:'auto',backend,dynamic:false},before=await pages[0].image('proof.render('+JSON.stringify(options)+')');
    const after=await pages[0].image('proof.render('+JSON.stringify({...options,destroy:true})+')'),actual=await pages[1].image('proof.render('+JSON.stringify({...options,destroy:true})+')');
    const diff=diffImages(after,actual),change=diffImages(before,after);assert(diff.identical,stage+' '+backend+' differs');assert(!change.identical,'destruction must visibly change the test scene');
    report.scenarios.push({stage,backend,identical:true,differentPixels:diff.differentPixels,destructionChangedPixels:change.differentPixels,baseSha256:after.sha256,headSha256:actual.sha256,stats:actual.extra?.stats});
  }
  for(const page of pages){assert.deepEqual(page.errors,[]);await page.close();}
});
writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
