#!/usr/bin/env python3
"""Real browser validation of the built METAL page (lot 02 / lot 04).

Drives headless Chrome through CDP: real WebGL rendering, real key events,
real DOM. Saves screenshots and a JSON report. Nothing here is a mockup.
"""
import asyncio, base64, json, os, subprocess, sys, time, urllib.request
import websockets

PORT = int(os.environ.get('METAL_CDP_PORT', '9333'))
ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'docs/reprise-support-20261117/browser'))
URL = 'file://' + os.path.join(ROOT, 'dist/index.html') + '?dev=1'
CHROME = os.environ.get('METAL_CHROME', '/usr/bin/google-chrome')
VIEWPORTS = {'desktop': (1280, 720), 'narrow': (900, 600), 'mobile': (390, 844)}


def log(*a):
    print(*a, flush=True)


def wait_port(timeout=45):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1:%d/json/version' % PORT, timeout=2) as r:
                return json.load(r)
        except Exception:
            time.sleep(0.4)
    raise SystemExit('chrome devtools port %d never answered' % PORT)


class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.next_id = 0
        self.events = []

    async def send(self, method, **params):
        self.next_id += 1
        mid = self.next_id
        await self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError('%s -> %s' % (method, msg['error']))
                return msg.get('result', {})
            if 'method' in msg:
                self.events.append(msg)

    async def drain(self, seconds=0.35):
        end = time.time() + seconds
        while time.time() < end:
            try:
                msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout=max(0.01, end - time.time())))
                if 'method' in msg:
                    self.events.append(msg)
            except asyncio.TimeoutError:
                break

    def console(self):
        out = []
        for e in self.events:
            if e['method'] == 'Runtime.consoleAPICalled':
                p = e['params']
                text = ' '.join(str(a.get('value', a.get('description', ''))) for a in p.get('args', []))
                out.append({'type': p['type'], 'text': text})
            elif e['method'] == 'Runtime.exceptionThrown':
                d = e['params']['exceptionDetails']
                out.append({'type': 'exception', 'text': d.get('exception', {}).get('description') or d.get('text')})
            elif e['method'] == 'Log.entryAdded':
                p = e['params']['entry']
                out.append({'type': p['level'], 'text': p.get('text', '')})
        return out


async def evaluate(cdp, expression, await_promise=False):
    r = await cdp.send('Runtime.evaluate', expression=expression, returnByValue=True, awaitPromise=await_promise)
    res = r.get('result', {})
    if r.get('exceptionDetails'):
        raise RuntimeError('page threw: %s' % json.dumps(r['exceptionDetails'])[:600])
    return res.get('value')


async def shot(cdp, name):
    r = await cdp.send('Page.captureScreenshot', format='png')
    path = os.path.join(OUT, name + '.png')
    with open(path, 'wb') as fh:
        fh.write(base64.b64decode(r['data']))
    log('  capture %s (%d octets)' % (os.path.basename(path), os.path.getsize(path)))
    return os.path.basename(path)


async def press(cdp, code, key, hold=0.0):
    base = {'code': code, 'key': key, 'windowsVirtualKeyCode': 0, 'nativeVirtualKeyCode': 0}
    await cdp.send('Input.dispatchKeyEvent', type='keyDown', **base)
    await cdp.send('Input.dispatchKeyEvent', type='char', text=key, **base)
    await cdp.send('Input.dispatchKeyEvent', type='keyUp', **base)
    if hold:
        await asyncio.sleep(hold)


async def hold_key(cdp, code, key, seconds):
    base = {'code': code, 'key': key}
    await cdp.send('Input.dispatchKeyEvent', type='rawKeyDown', **base)
    await asyncio.sleep(seconds)
    await cdp.send('Input.dispatchKeyEvent', type='keyUp', **base)


async def set_viewport(cdp, w, h, mobile=False):
    await cdp.send('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=1 if not mobile else 2, mobile=mobile)
    await cdp.send('Emulation.setTouchEmulationEnabled', enabled=mobile)


async def hud(cdp):
    return await evaluate(cdp, """(() => {
      const g=id=>document.getElementById(id);
      const vis=e=>!!e&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
      const body=document.body, html=document.documentElement;
      return {state:body.dataset.state||null, support:body.dataset.support||null,
        gpuTier:body.dataset.gpuTier||null, perf:body.dataset.perf||null,
        scrollable:body.scrollHeight>body.clientHeight+1||html.scrollHeight>html.clientHeight+1,
        canvas:{w:g('scene')?.width||g('canvas')?.width||null,h:g('scene')?.height||g('canvas')?.height||null},
        hud:{health:vis(g('hp'))&&g('hp').textContent, armor:vis(g('armor-points'))&&g('armor-points').textContent,
             resource:vis(g('resource-panel'))&&g('resource-label').textContent+'='+g('resource-value').textContent,
             heat:vis(g('heat-bar'))&&g('heat-bar').style.transform, weapon:vis(g('weapon-readout'))&&g('weapon-label').textContent,
             hint:vis(g('controls-hint'))&&g('controls-hint').textContent.slice(0,120),
             access:vis(g('access-hint'))&&g('access-label').textContent},
        cockpit:(()=>{try{return JSON.parse(body.dataset.cockpit||'null');}catch{return null;}})(),
        meshes:body.dataset.meshes||null};
    })()""")


async def run():
    os.makedirs(OUT, exist_ok=True)
    profile = '/tmp/opencode/metal/chrome-profile'
    os.makedirs(profile, exist_ok=True)
    cmd = [CHROME, '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
           '--remote-debugging-port=%d' % PORT, '--user-data-dir=' + profile,
           '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--disable-gpu-sandbox', '--hide-scrollbars', '--allow-file-access-from-files',
           '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720',
           'about:blank']
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    report = {'url': URL, 'chrome': subprocess.run([CHROME, '--version'], capture_output=True, text=True).stdout.strip(),
              'screenshots': [], 'console': [], 'steps': [], 'viewport': {}}
    try:
        wait_port()
        with urllib.request.urlopen('http://127.0.0.1:%d/json/version' % PORT) as r:
            browser_ws = json.load(r)['webSocketDebuggerUrl']
        bws = await websockets.connect(browser_ws, max_size=64 * 1024 * 1024)
        bcdp = CDP(bws)
        target = await bcdp.send('Target.createTarget', url='about:blank')
        ws = await websockets.connect('ws://127.0.0.1:%d/devtools/page/%s' % (PORT, target['targetId']), max_size=64 * 1024 * 1024)
        await bws.close()
        cdp = CDP(ws)
        await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Page.enable')
        await cdp.send('Network.enable')
        for name, (w, h) in VIEWPORTS.items():
            log('viewport %s %dx%d' % (name, w, h))
            await set_viewport(cdp, w, h, mobile=name == 'mobile')
            await cdp.send('Page.navigate', url=URL)
            await cdp.drain(4.0)
            for _ in range(40):
                st = await evaluate(cdp, 'document.body&&document.body.dataset.state||"loading"')
                if st and st != 'loading':
                    break
                await cdp.drain(0.5)
            report['steps'].append({'viewport': name, 'step': 'chargement', 'state': st})
            report['screenshots'].append(await shot(cdp, '%s-01-titre' % name))
            if name != 'desktop':
                await evaluate(cdp, "document.getElementById('start')&&document.getElementById('start').click()")
                for _ in range(40):
                    st = await evaluate(cdp, 'document.body.dataset.state||""')
                    if st == 'playing':
                        break
                    await cdp.drain(0.5)
                await cdp.drain(1.2)
                playing = await hud(cdp)
                report['viewport'][name] = playing
                report['steps'].append({'viewport': name, 'step': 'jeu en cours', 'state': playing['state'],
                                        'defilement': playing['scrollable'], 'canvas': playing['canvas'],
                                        'hud': playing['hud']})
                report['screenshots'].append(await shot(cdp, '%s-02-jeu' % name))
                continue
            # Real gesture on the title, then a new expedition.
            await cdp.send('Input.dispatchMouseEvent', type='mousePressed', x=640, y=360, button='left', clickCount=1)
            await cdp.send('Input.dispatchMouseEvent', type='mouseReleased', x=640, y=360, button='left', clickCount=1)
            await cdp.drain(1.0)
            await evaluate(cdp, "document.getElementById('start')&&document.getElementById('start').click()")
            for _ in range(40):
                st = await evaluate(cdp, 'document.body.dataset.state||""')
                if st == 'playing':
                    break
                await cdp.drain(0.5)
            report['steps'].append({'viewport': name, 'step': 'nouvelle expedition', 'state': st})
            await cdp.drain(1.5)
            report['screenshots'].append(await shot(cdp, 'desktop-02-lourd-premiere-personne'))
            report['viewport'][name] = await hud(cdp)
            # Third person with the heavy (R).
            await press(cdp, 'KeyR', 'R'); await cdp.drain(0.8)
            report['screenshots'].append(await shot(cdp, 'desktop-03-lourd-troisieme-personne'))
            report['steps'].append({'viewport': name, 'step': 'vue troisieme personne', 'view': await evaluate(cdp, 'document.getElementById("view")?document.body.dataset.view||null:null')})
            await press(cdp, 'KeyR', 'R'); await cdp.drain(0.5)
            # Switch to the drone (T): procedural cockpit, no human hands.
            await press(cdp, 'KeyT', 'T'); await cdp.drain(1.2)
            drone = await hud(cdp)
            report['steps'].append({'viewport': name, 'step': 'drone', 'support': drone['support'], 'cockpit': drone['cockpit'], 'hud': drone['hud']})
            report['screenshots'].append(await shot(cdp, 'desktop-04-drone-cockpit'))
            # Fly: ascend with Space, descend with C, boost with Shift.
            await hold_key(cdp, 'Space', ' ', 0.9); await cdp.drain(0.4)
            await hold_key(cdp, 'KeyC', 'C', 0.5); await cdp.drain(0.4)
            await hold_key(cdp, 'ShiftLeft', 'Shift', 0.6); await cdp.drain(0.4)
            report['screenshots'].append(await shot(cdp, 'desktop-05-drone-en-vol'))
            # Fire the twin lasers with the left trigger of the keyboard (G) and the mouse.
            await cdp.send('Input.dispatchMouseEvent', type='mousePressed', x=640, y=360, button='left', clickCount=1)
            await cdp.send('Input.dispatchMouseEvent', type='mouseReleased', x=640, y=360, button='left', clickCount=1)
            await press(cdp, 'KeyG', 'G'); await cdp.drain(0.5)
            report['screenshots'].append(await shot(cdp, 'desktop-06-drone-tir'))
            # Hold Interact (F) to hack, then release: the progress bar must reset.
            await hold_key(cdp, 'KeyF', 'F', 2.0); await cdp.drain(0.3)
            held = await evaluate(cdp, 'JSON.stringify({label:document.getElementById("access-label")?.textContent,visible:!document.getElementById("access-hint")?.hidden,bar:!document.getElementById("access-progress")?.hidden})')
            report['steps'].append({'viewport': name, 'step': 'piratage maintenu', 'observed': held})
            report['screenshots'].append(await shot(cdp, 'desktop-07-maintenir-interagir'))
            # Pause with P: the held action must not survive the resume.
            await press(cdp, 'KeyP', 'P'); await cdp.drain(0.6)
            paused = await evaluate(cdp, 'document.body.dataset.state')
            report['steps'].append({'viewport': name, 'step': 'pause', 'state': paused})
            report['screenshots'].append(await shot(cdp, 'desktop-08-pause'))
            await press(cdp, 'KeyP', 'P'); await cdp.drain(0.6)
            report['steps'].append({'viewport': name, 'step': 'reprise', 'state': await evaluate(cdp, 'document.body.dataset.state')})
            # Options: hide the help, check persistence, reopen.
            await evaluate(cdp, "document.getElementById('controls-hint-toggle')&&document.getElementById('controls-hint-toggle').click()")
            await cdp.drain(0.4)
            hidden = await evaluate(cdp, "document.getElementById('controls-hint').hidden")
            stored = await evaluate(cdp, "JSON.parse(localStorage.getItem('ferro-settings')||'{}').controlsHint")
            report['steps'].append({'viewport': name, 'step': 'aide masquee', 'hidden': hidden, 'persistee': stored})
            await evaluate(cdp, "document.getElementById('controls-hint-toggle')&&document.getElementById('controls-hint-toggle').click()")
            await cdp.drain(0.4)
            report['steps'].append({'viewport': name, 'step': 'aide reaffichee',
                                    'hidden': await evaluate(cdp, "document.getElementById('controls-hint').hidden"),
                                    'persistee': await evaluate(cdp, "JSON.parse(localStorage.getItem('ferro-settings')||'{}').controlsHint")})
            # Reload: the preference must survive.
            await cdp.send('Page.navigate', url=URL); await cdp.drain(3.5)
            report['steps'].append({'viewport': name, 'step': 'préférence après rechargement',
                                    'persistee': await evaluate(cdp, "JSON.parse(localStorage.getItem('ferro-settings')||'{}').controlsHint")})
        report['console'] = cdp.console()
        report['errors'] = [c for c in report['console'] if c['type'] in ('error', 'exception')]
        await ws.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
    with open(os.path.join(OUT, 'browser-report.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    log('console: %d messages, %d erreurs' % (len(report['console']), len(report.get('errors', []))))
    for e in report.get('errors', [])[:12]:
        log('  ERREUR: ' + e['text'][:300])
    return 0 if not report.get('errors') else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(run()))
