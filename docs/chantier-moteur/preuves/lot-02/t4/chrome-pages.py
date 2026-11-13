# Sonde T4 : pages de mesure tirées de deux dist/index.html (A avant, B après).
# Chaque page charge, avant le script du jeu, une sauvegarde réelle (facultative) puis la sonde.
# python3 -I chrome-pages.py <dist-A.html> <dist-B.html> <dossier> <dossier des preuves>
# Le dossier doit déjà contenir save-legacy-s2.js et save-campaign2-w18.js (chrome-sauvegarde.mjs).
import pathlib, shutil, sys
dist_a, dist_b, out, proofs = (pathlib.Path(p) for p in sys.argv[1:5])
anchor = '<meta charset="utf-8">'
shutil.copy(proofs / 'chrome-sonde-approche.js', out / 'sonde-approche.js')
shutil.copy(proofs / 'chrome-sonde-teleport.js', out / 'sonde-teleport.js')
saves = {'legacy': 'save-legacy-s2.js', 'w18': 'save-campaign2-w18.js', 'neuf': None}
for variant, dist in (('A', dist_a), ('B', dist_b)):
    src = dist.read_text(encoding='utf-8')
    assert src.count(anchor) == 1
    for world, save in saves.items():
        load = f'<script src="{save}"></script>' if save else ''
        # Approche à pied (mesure principale) et téléportation sur le relais (première sonde).
        (out / f'{variant}2-{world}.html').write_text(src.replace(anchor, anchor + load + '<script src="sonde-approche.js"></script>', 1), encoding='utf-8')
        (out / f'{variant}-{world}.html').write_text(src.replace(anchor, anchor + load + '<script src="sonde-teleport.js"></script>', 1), encoding='utf-8')
    if variant == 'B':
        # Repli sans requestIdleCallback (Safari) : setTimeout(0).
        (out / 'C-legacy.html').write_text(src.replace(anchor, anchor + '<script>window.requestIdleCallback=undefined;</script><script src="save-legacy-s2.js"></script><script src="sonde-teleport.js"></script>', 1), encoding='utf-8')
print('pages écrites dans', out)
