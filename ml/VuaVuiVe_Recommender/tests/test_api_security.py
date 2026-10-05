"""Exercise the real HTTP safeguards while replacing model/snapshot loading only."""
import importlib.util
import os
from pathlib import Path
import secrets
import tempfile
import types
import unittest
from unittest.mock import patch


class ApiSecurityTest(unittest.TestCase):
    def load_api(self, production=False, token=None):
        model = types.ModuleType('recommender')
        model.HybridRecommender = lambda *args, **kwargs: object()
        adapter = types.ModuleType('vvv_adapter')
        adapter.VVVInstacartAdapter = lambda *args, **kwargs: object()
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        for name in ('products.json', 'orders.json', 'users.json'):
            Path(directory.name, name).write_text('[]', encoding='utf-8')
        source = Path(__file__).resolve().parents[1] / 'src' / 'api.py'
        spec = importlib.util.spec_from_file_location('qa_api', source)
        module = importlib.util.module_from_spec(spec)
        env = {'ML_ENV': 'production' if production else 'test', 'ML_API_TOKEN': token or '', 'VVV_DATA_DIR': directory.name}
        with patch.dict(os.environ, env), patch.dict('sys.modules', {'recommender': model, 'vvv_adapter': adapter}):
            spec.loader.exec_module(module)
        return module.app.test_client()

    def test_production_requires_strong_internal_token(self):
        with self.assertRaisesRegex(RuntimeError, 'ML_API_TOKEN'):
            self.load_api(production=True)

    def test_health_is_public_but_api_requires_internal_token(self):
        token = secrets.token_hex(32)
        client = self.load_api(production=True, token=token)
        self.assertEqual(client.get('/health').status_code, 200)
        with patch.dict(os.environ, {'RENDER_GIT_COMMIT': 'a' * 40}):
            self.assertEqual(client.get('/health').get_json()['revision'], 'a' * 40)
        with patch.dict(os.environ, {'RENDER_GIT_COMMIT': 'invalid'}):
            self.assertIsNone(client.get('/health').get_json()['revision'])
        self.assertEqual(client.post('/api/recommend', json={'user_id': None, 'n': 1}).status_code, 401)
        self.assertEqual(client.post('/api/recommend', headers={'X-ML-Token': token}, json={'n': 0}).status_code, 400)

    def test_json_shape_and_n_boundaries(self):
        client = self.load_api()
        for value in (0, 21, 1.5, True, '10'):
            self.assertEqual(client.post('/api/recommend', json={'n': value}).status_code, 400)
        self.assertEqual(client.post('/api/recommend', json=[]).status_code, 400)
        self.assertEqual(client.post('/api/batch-recommend', json={'user_ids': list(range(51)), 'n': 1}).status_code, 400)

    def test_request_size_is_bounded(self):
        client = self.load_api()
        self.assertEqual(client.post('/api/recommend', json={'n': 1, 'padding': 'x' * 70000}).status_code, 413)


if __name__ == '__main__':
    unittest.main()
