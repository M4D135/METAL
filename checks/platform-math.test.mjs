// Les preuves doivent charger les dépendances du monde aussi avec FMath injecté.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {census, loadFMath, worldFactory} from '../tools/platform-math.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('census instrumente les six mondes classiques avec FPassages chargé',()=>{
  const report=census(root,{seeds:[],samples:0});
  assert.equal(report.schema,'metal-platform-math-census-v1');
  assert.equal(report.worlds,6);
  assert.equal(report.perWorld.length,6);
  assert.ok(report.total.hypot2.calls>0,'le FMath injecté doit réellement être utilisé');
});

test('worldFactory conserve le FMath injecté et produit le même monde campagne V2',()=>{
  const F=loadFMath(root);
  let calls=0;
  const FM=Object.freeze({...F,hypot2(x,y){calls++;return F.hypot2(x,y);}});
  const normal=worldFactory(root).create(96,9,{campaign:true,campaignVersion:2});
  const instrumented=worldFactory(root,Math,FM).create(96,9,{campaign:true,campaignVersion:2});
  assert.ok(calls>0,'l’instrumentation ne doit pas être écrasée par un rechargement de fmath');
  assert.equal(digest(instrumented),digest(normal));
});

test('worldFactory reste compatible avec une racine historique sans passages.js',()=>{
  const legacy=mkdtempSync(join(tmpdir(),'metal-world-legacy-'));
  try {
    mkdirSync(join(legacy,'src'));
    writeFileSync(join(legacy,'src/world.js'),'window.FWorld={create:(seed)=>({seed})};');
    assert.deepEqual(worldFactory(legacy).create(96),{seed:96});
  } finally {rmSync(legacy,{recursive:true,force:true});}
});
