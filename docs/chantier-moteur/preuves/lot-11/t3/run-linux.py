#!/usr/bin/env python3
# Banc MIX, équivalent Linux de docs/chantier-moteur/bancs/mix/run.py (qui pointe sur le
# binaire macOS de Chrome). MASTER-PROMPT §5 : « si un script échoue pour une raison de
# chemin ou d'outil absent, corrige-le ou écris l'équivalent, et dis-le ».
# Chrome sans interface sur une page file://, sans port réseau ni serveur. Le profil
# Chrome est écrit dans un dossier temporaire hors dépôt.
import sys, os, subprocess, base64, threading, tempfile, signal, shutil
D = os.path.dirname(os.path.abspath(__file__))
page = sys.argv[1]; timeout = float(sys.argv[2]) if len(sys.argv) > 2 else 280
profile = tempfile.mkdtemp(prefix="mix-chrome-", dir=os.environ.get("MIX_TMP", D))
cmd = ["google-chrome", "--headless=new",
       "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run",
       "--no-default-browser-check", "--disable-extensions", "--metrics-recording-only", "--disable-domain-reliability",
       "--disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions",
       "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
       "--user-data-dir=" + profile, "--allow-file-access-from-files", "--mute-audio",
       "--enable-logging=stderr", "--log-level=0", "--window-size=800,600", "file://" + os.path.join(D, page)]
p = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, errors="replace")
killer = threading.Timer(timeout, lambda: p.kill()); killer.start()
chunks = []; done = False; errors = []
for line in p.stderr:
    i = line.find("MIXCHUNK ")
    if i >= 0:
        chunks.append(line[i + 9:].split('"')[0].strip())
    elif "MIXDONE" in line:
        done = True; break
    elif "CONSOLE" in line and ("Uncaught" in line or "MIXERR" in line or "rror" in line):
        errors.append(line.strip())
killer.cancel()
try:
    p.send_signal(signal.SIGTERM); p.wait(timeout=10)
except Exception:
    p.kill()
shutil.rmtree(profile, ignore_errors=True)
if errors: sys.stderr.write("\n".join(errors[:20]) + "\n")
if not done: sys.stderr.write("page non terminée (délai ou erreur)\n")
sys.stdout.write(base64.b64decode("".join(chunks)).decode("utf-8") if chunks else "")
sys.exit(0 if done else 1)
