#!/usr/bin/env python3
"""Reconstitue les copies modifiées de METAL utilisées par les bancs de l'audit.

Le dépôt ne garde que des patchs par rapport à METAL 0.8.0 (commit 673d6b2).
Ce script recrée, à côté de chaque patch, le fichier modifié, et les copies de
travail complètes marquées par un fichier .copie-du-depot. Les fichiers créés
sont ajoutés à .git/info/exclude : ils ne doivent pas être commités.

Usage, depuis la racine du dépôt : python3 docs/chantier-moteur/bancs/reconstituer.py
"""
import os, subprocess, sys, tarfile, io
REF = '673d6b2'
ROOT = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, check=True).stdout.strip()
B = os.path.join(ROOT, 'docs', 'chantier-moteur', 'bancs')
made = []

def show(path):
    r = subprocess.run(['git', '-C', ROOT, 'show', f'{REF}:{path}'], capture_output=True)
    return r.stdout if r.returncode == 0 else None

copies = sorted(os.path.dirname(os.path.join(r, f)) for r, _, fs in os.walk(B) for f in fs if f == '.copie-du-depot')
for c in copies:
    data = subprocess.run(['git', '-C', ROOT, 'archive', REF], capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(data)) as tar:
        for m in tar.getmembers():
            if m.name.startswith(('docs/', 'dist/')) or not m.isfile(): continue
            dest = os.path.join(c, m.name)
            if os.path.exists(dest): continue
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as out: out.write(tar.extractfile(m).read())
            made.append(dest)
for r, _, fs in os.walk(B):
    for f in fs:
        if not f.endswith('.patch'): continue
        patch = os.path.join(r, f); target = patch[:-6]
        head = open(patch, encoding='utf-8', errors='replace').readline().strip()
        src = head[len('--- a/'):] if head.startswith('--- a/') else None
        inside = next((c for c in copies if target.startswith(c + os.sep)), None)
        base = show(src) if src else None
        if base is None: print('patch ignoré (origine introuvable) :', os.path.relpath(patch, ROOT)); continue
        tmp = target + '.orig-673d6b2'
        open(tmp, 'wb').write(base)
        ok = subprocess.run(['patch', '-s', '-o', target, tmp, patch], capture_output=True)
        os.remove(tmp)
        if ok.returncode != 0: print('échec :', os.path.relpath(patch, ROOT), ok.stderr.decode()[:200]); continue
        made.append(target)
excl = os.path.join(ROOT, '.git', 'info', 'exclude')
if os.path.isdir(os.path.dirname(excl)):
    have = set(open(excl).read().split('\n')) if os.path.exists(excl) else set()
    with open(excl, 'a') as f:
        for m in made:
            rel = '/' + os.path.relpath(m, ROOT)
            if rel not in have: f.write(rel + '\n')
print(f'{len(copies)} copies de travail, {len(made)} fichiers reconstitués (exclus de git)')
