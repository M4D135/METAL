"""Recover the exact WIP snapshot. This is a transport, not a release validator."""
from pathlib import Path
import base64, hashlib, json, lzma

EXPECTED = 'c5c4406c66005f34449c52e6bad6b1cc7dda63220b2a3f6fa839afc866f2597f'
ALLOWED = set('checks/controls.test.mjs checks/wreckage.test.mjs package.json src/controls.js src/demo-metal.js src/game.js src/index.html src/metal-physics.js src/profiles.js src/simulation.js src/style.css src/world.js tools/build.py tools/simulation-modules.json src/support.js checks/support-drone.test.mjs checks/support-physics.test.mjs checks/support-budgets.test.mjs'.split())
transport = Path('tools/reprise-support-20261117')
encoded = ''.join((transport / f'checkpoint.{i}.b64').read_text().strip() for i in range(1, 5))
data = lzma.decompress(base64.b64decode(encoded, validate=True))
assert hashlib.sha256(data).hexdigest() == EXPECTED, 'Corrupt transport'
manifest = json.loads(data)
assert manifest['base'] == '351f2ccda91f0ba3c0f962316e714e9d7c20e8ac'
assert len(manifest['files']) == len(ALLOWED)
assert {f['path'] for f in manifest['files']} == ALLOWED
ready = []
for entry in manifest['files']:
    path = Path(entry['path'])
    if entry['base'] is None:
        assert not path.exists(), f'Unexpected existing file: {path}'
        result = entry['text']
    else:
        original = path.read_bytes()
        assert hashlib.sha256(original).hexdigest() == entry['base'], f'Base mismatch: {path}'
        result = original.decode('utf-8')
        previous = 0
        for start, end, text in entry['edits']:
            assert isinstance(start, int) and isinstance(end, int) and isinstance(text, str)
            assert previous <= start <= end <= len(result), f'Invalid edit: {path}'
            previous = end
        for start, end, text in reversed(entry['edits']):
            result = result[:start] + text + result[end:]
    content = result.encode('utf-8')
    assert hashlib.sha256(content).hexdigest() == entry['sha256'], f'Result mismatch: {path}'
    ready.append((path, content))
# Check every base/result before touching any game file.
for path, content in ready:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
evidence = Path('/tmp/metal-checkpoint-evidence')
evidence.mkdir(exist_ok=True)
(evidence / 'source-manifest.json').write_text(json.dumps({
    'base': manifest['base'], 'files': {f['path']: f['sha256'] for f in manifest['files']}
}, indent=2) + '\n')
print(f'Recovered {len(ready)} exact source/test files; this snapshot remains WIP.')
