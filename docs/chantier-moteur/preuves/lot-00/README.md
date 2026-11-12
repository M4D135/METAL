# Preuves du lot 00 / T1 — SIM-11, IA-06

Référence : `63668aca7045e62cd524973b226f21e9ec5703e8`, METAL 0.8.1.
Le [rapport du lot](../../RAPPORT.md) expose les résultats, le contexte et les
limites. [summary.json](summary.json) en donne les valeurs structurées ;
[manifest.json](manifest.json) donne les tailles et SHA-256 de chaque archive
et de son contenu original.

## Contenu et résultats

| Archives | Contenu conservé |
|---|---|
| `profile-steps-a.json.gz`, `profile-steps-b.json.gz` | Deux profils indépendants, quatre scénarios × 1 800 pas ; chauffe, mesures et rejeu instrumenté complets. Même checksum, états et compteurs par pas. |
| `aa.json.gz` | A/A alterné complet ; identité de chaque pas et du snapshot ; asymétrie CPU médiane B/A de 5,1 à 10,2 %. |
| `aa-v2-short.json.gz` | A/A de 120 pas sur `campaign2-w1` et `campaign2-w10`, avec chauffe exclue et rejeu instrumenté. |
| `realm-check.json.gz` | Vrai diagnostic principal/VM : deux scénarios, chauffe et deux passages mesurés, 65 536 probes et 1 200 pas par passage. |
| `loader-self-check.json.gz`, `tool-self-check.json.gz` | Isolation, globales conservées, intrinsics natifs, instrumentation et détection des divergences Float64. |
| `migration-check.json.gz` | Résultat des comparaisons JSON et octet à octet des anciens outils. |
| `campaign-profiles.json.gz`, `campaign-balance.json.gz`, `boss-profiles.json.gz` | Rapports originaux, identiques aux sorties après migration. Une seule copie par paire identique ; les alias avant/après sont dans le manifeste. |
| `reference-environment.json.gz`, `reference-realm-check.stdout.txt.gz`, `reference-counter-realm.stdout.txt.gz` | Environnement et sorties brutes des bancs de référence exécutés avant modification. |
| `baseline-main-tests.log.gz`, `lot00-tests.log.gz` | `npm test` avant/après : 422/422 ici ; contrôle de distribution PASS, 803 375 octets, même SHA-256. |

Les 16 archives totalisent **2 105 101 octets compressés**. Leurs contenus
originaux totalisent **34 150 943 octets**. Les JSON complets conservent chaque
pas et la chauffe, sans échantillonnage ni arrondi des valeurs. Les archives
ne font pas partie du HTML autonome ni de sa taille brute.

Les sources et les empreintes de référence sont dans
[`tools/proof`](../../../../tools/proof/README.md). La sélection `all` désigne
toujours les quatre scénarios historiques, dont les deux campagnes V1.
Les 18 identifiants V2 sont des sélections explicites ; leurs campagnes
complètes seront mesurées au lot 02.

## Encodage et contrôle d'intégrité

Encodage gzip niveau 9, date `mtime=0`, aucun nom de fichier dans l'en-tête,
octet OS 255. La compression a été refaite deux fois et comparée ; chaque
archive a ensuite été décompressée et comparée octet à octet à son original.
Il n'y a pas de timestamp ou de chemin de fichier variable dans l'en-tête.

Depuis la racine du dépôt, le contrôle suivant vérifie les 16 archives :

```sh
python3 - <<'PY'
import gzip, hashlib, json, pathlib
root = pathlib.Path('docs/chantier-moteur/preuves/lot-00')
manifest = json.loads((root / 'manifest.json').read_text())
for entry in manifest['files']:
    packed = (root / entry['file']).read_bytes()
    original = gzip.decompress(packed)
    assert len(packed) == entry['compressedBytes']
    assert hashlib.sha256(packed).hexdigest() == entry['compressedSha256']
    assert len(original) == entry['uncompressedBytes']
    assert hashlib.sha256(original).hexdigest() == entry['uncompressedSha256']
print('PASS:', len(manifest['files']), 'archives')
PY
```

Pour examiner un rapport sans l'ajouter au dépôt :

```sh
gzip -dc docs/chantier-moteur/preuves/lot-00/profile-steps-a.json.gz > /tmp/metal-profile-a.json
node tools/proof/reference-check.mjs /tmp/metal-profile-a.json
```

## Reproduction des mesures

```sh
node tools/realm-loader.mjs
node tools/proof/self-check.mjs
node tools/profile-steps.mjs . --steps 1800 --reps 2 --out /tmp/metal-profile-a.json
node tools/profile-steps.mjs . --steps 1800 --reps 2 --out /tmp/metal-profile-b.json
node tools/ab2.mjs . . --steps 1800 --reps 2 --out /tmp/metal-aa.json
node tools/realm-check.mjs . --steps 1200 --reps 2 --out /tmp/metal-realms.json
node tools/ab2.mjs . . --scenario campaign2-w1,campaign2-w10 --steps 120 --reps 1 --out /tmp/metal-v2-aa.json
node tools/proof/reference-check.mjs /tmp/metal-profile-a.json
node tools/proof/reference-check.mjs /tmp/metal-profile-b.json
```

Les timings changeront selon la charge, le CPU et V8. Les empreintes de
référence portent sur le pilote, la graine, le pas de temps et les sources
documentés. Le CPU comprend GC/JIT et le chronomètre n'est pas soustrait.
Le contrôle A/A ne permet pas de conclure à un gain de 5 à 10 %. Les ratios du
Mac d'audit ne sont pas des seuils portables. Aucune mesure de navigateur,
GPU, écran ou appareil réel n'est déduite de ces archives.
