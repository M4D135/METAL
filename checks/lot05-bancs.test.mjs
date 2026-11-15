// Non-régression [Lot 05, problème 1] : les bancs cités par les preuves doivent exister et
// pouvoir être résolus par Node. Le commit 3cea9a8 affirmait « les bancs sont maintenant dans
// le dépôt et les chemins des preuves pointent sur eux » alors que gc-bench.mjs et effects-ab.mjs
// importaient un ./harness.mjs jamais committé : ERR_MODULE_NOT_FOUND à l'exécution, et aucune
// preuve reproductible pour T3 ni T9.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync, statSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';

const racine = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function fichiers(dir, filtre) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiers(p, filtre));
    else if (filtre(e)) out.push(p);
  }
  return out;
}

const bancs = fichiers(join(racine, 'tools', 'proof'), f => f.endsWith('.mjs'));
const preuves = fichiers(join(racine, 'docs', 'chantier-moteur', 'preuves', 'lot-05-rendu-cpu'), f => f.endsWith('.json'));

test('tout import relatif d un banc tools/proof pointe sur un fichier committé', () => {
  assert.ok(bancs.length >= 14, 'bancs introuvables : ' + bancs.length);
  const manquants = [];
  for (const f of bancs) {
    const src = readFileSync(f, 'utf8');
    const specifiers = [...src.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g)]
      .map(m => m[1]).filter(s => s.startsWith('.'));
    for (const s of specifiers) {
      const cible = resolve(dirname(f), s);
      if (!existsSync(cible)) manquants.push(`${f.slice(racine.length + 1)} -> ${s}`);
    }
  }
  assert.deepEqual(manquants, [], 'imports résolus nulle part : ' + manquants.join(', '));
});

test('tout chemin de banc ou de doc cité par une preuve du lot 05 existe', () => {
  assert.ok(preuves.length >= 20, 'preuves introuvables : ' + preuves.length);
  const manquants = [];
  for (const f of preuves) {
    const src = readFileSync(f, 'utf8');
    const cites = new Set([...src.matchAll(/((?:tools|docs|src|checks)\/[\w./-]*\.(?:mjs|py|js|json))/g)].map(m => m[1]));
    for (const c of cites) {
      if (!existsSync(join(racine, c))) manquants.push(`${f.slice(racine.length + 1)} cite ${c}`);
    }
  }
  assert.deepEqual(manquants, [], 'chemins cités inexistants : ' + manquants.join(', '));
});

test('tout banc qui écrit un fichier importe bien writeFileSync', () => {
  const distraits = [];
  for (const f of bancs) {
    const src = readFileSync(f, 'utf8');
    const importe = /\bwriteFileSync\b[^;]*from\s+['"]node:fs['"]/.test(src) || /import\s*\(\s*['"]node:fs['"]\s*\)/.test(src);
    if (/\bwriteFileSync\s*\(/.test(src) && !importe) {
      distraits.push(f.slice(racine.length + 1));
    }
  }
  assert.deepEqual(distraits, [], 'writeFileSync utilisé sans import : ' + distraits.join(', '));
});

test('une preuve qui publie un chiffre d alloc-image.mjs donne médiane et intervalle', () => {
  // Le tour 1 publiait « koParImageImageComplete: 92,2 » issu d'une seule exécution
  // de heapUsed entre deux GC : 343,6 puis 116,9 puis 56,8 sur la même racine.
  // Un fichier peut citer le banc pour dire qu'il est instable (t17/cout.json) : il
  // ne doit alors publier aucun chiffre de ce banc.
  const fautives = [];
  for (const f of preuves) {
    const src = readFileSync(f, 'utf8');
    if (!/"[\w"]*ImageComplete[\w"]*\s*:\s*\d/.test(src)) continue;
    if (!/intervalle/i.test(src) || !/ex[eé]cut/i.test(src)) {
      fautives.push(f.slice(racine.length + 1));
    }
  }
  assert.deepEqual(fautives, [], 'chiffre d\'allocation publié sans médiane ni intervalle : ' + fautives.join(', '));
});

test('les bancs de coût à deux racines mesurent en lockstep et publient un contrôle', () => {
  // canvas-cost.mjs déroulait `for (r) for (root of [base,tete]) timing(root,1)` : un bloc
  // de 300 images par racine, la tête toujours en second. Son ratio ne reproduisait pas
  // la preuve (1,0233 mesuré pour 0,938 annoncé).
  const exige = ['tools/proof/lot05/canvas-cost.mjs'];
  const fautifs = [];
  for (const f of exige) {
    const src = readFileSync(join(racine, f), 'utf8');
    const lockstep = /reverse\s*\(\s*\)/.test(src) && /for\s*\(\s*const j of order\s*\)/.test(src);
    const controle = /controle/i.test(src);
    if (!lockstep || !controle) fautifs.push(`${f} (lockstep=${lockstep}, controle=${controle})`);
  }
  assert.deepEqual(fautifs, [], 'banc non apparié ou sans contrôle : ' + fautifs.join(', '));
});

test('les deux bancs exigés par les preuves T3 et T9 sont bien dans le dépôt', () => {
  for (const f of ['tools/proof/lot05/gc-bench.mjs', 'tools/proof/lot05/effects-ab.mjs',
    'tools/proof/lot05/effects-ab2.mjs', 'tools/proof/lot05/alloc-image.mjs',
    'tools/proof/lot05/canvas-cost.mjs', 'tools/proof/lot05/phase-cost.mjs']) {
    assert.ok(existsSync(join(racine, f)), f + ' manque du dépôt');
  }
});
