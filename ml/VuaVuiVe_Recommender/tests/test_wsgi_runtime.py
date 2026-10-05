"""Real Gunicorn + real API/model loader, with tiny synthetic artifacts only."""
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@unittest.skipIf(os.name == 'nt', 'Gunicorn requires Unix; run this test in Linux CI/Docker')
class WsgiRuntimeTest(unittest.TestCase):
    def test_real_wsgi_health_and_internal_authentication(self):
        project = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(project / 'src', root / 'src', ignore=shutil.ignore_patterns('__pycache__'))
            shutil.copyfile(project / 'gunicorn.conf.py', root / 'gunicorn.conf.py')
            features = root / 'data' / '03_features'
            features.mkdir(parents=True)
            (features / 'cooccurrence_neighbors.json').write_text('{}', encoding='utf-8')
            (features / 'popularity.json').write_text(json.dumps({'global': [], 'by_department': {}}), encoding='utf-8')
            snapshot = root / 'snapshot'
            snapshot.mkdir()
            for name in ('products', 'orders', 'users'):
                (snapshot / f'{name}.json').write_text('[]', encoding='utf-8')
            mappings = root / 'mappings'
            mappings.mkdir()
            (mappings / 'vvv_instacart_mapping.json').write_text('{"category_to_instacart":{}}', encoding='utf-8')
            with socket.socket() as reservation:
                reservation.bind(('127.0.0.1', 0))
                port = reservation.getsockname()[1]
            token = secrets.token_hex(32)
            env = {'PATH': os.environ.get('PATH', ''), 'PORT': str(port), 'ML_ENV': 'production',
                   'APP_ENV': 'staging', 'ML_API_TOKEN': token, 'VVV_DATA_DIR': str(snapshot),
                   'ENABLE_CF': 'false', 'RELEASE_SHA': 'a' * 40}
            process = subprocess.Popen([sys.executable, '-m', 'gunicorn', '--config', 'gunicorn.conf.py', 'src.wsgi:app'],
                                       cwd=root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                deadline = time.monotonic() + 45
                health = None
                while time.monotonic() < deadline:
                    self.assertIsNone(process.poll(), 'Gunicorn exited before readiness')
                    try:
                        with urlopen(f'http://127.0.0.1:{port}/health', timeout=2) as response:
                            health = json.load(response)
                        break
                    except (URLError, TimeoutError):
                        time.sleep(0.1)
                self.assertIsNotNone(health, 'Gunicorn readiness timed out')
                self.assertTrue(health['adapter_ready'])
                self.assertEqual(health['revision'], 'a' * 40)
                self.assertEqual(health['environment'], 'staging')
                for headers, status in [({}, 401), ({'X-ML-Token': token}, 400)]:
                    request = Request(f'http://127.0.0.1:{port}/api/recommend', data=b'{"n":0}',
                                      headers={'Content-Type': 'application/json', **headers})
                    with self.assertRaises(HTTPError) as failure:
                        urlopen(request, timeout=3)
                    self.assertEqual(failure.exception.code, status)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
