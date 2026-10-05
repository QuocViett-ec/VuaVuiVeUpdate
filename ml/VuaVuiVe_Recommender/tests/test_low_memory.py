import importlib.util
import json
import math
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


class LowMemoryTest(unittest.TestCase):
    def test_streaming_preserves_served_neighbors_without_scientific_imports(self):
        source = Path(__file__).resolve().parents[1] / 'src' / 'recommender.py'
        spec = importlib.util.spec_from_file_location('qa_recommender', source)
        module = importlib.util.module_from_spec(spec)
        with patch.dict('sys.modules', {'numpy': None, 'scipy': None}):
            spec.loader.exec_module(module)
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                neighbors = [[index, index * 2] for index in range(1, 101)]
                path = root / 'cooccurrence_neighbors.json'
                for indent in (None, 2):
                    path.write_text(json.dumps({'1000': neighbors}, indent=indent), encoding='utf-8')
                    (root / 'popularity.json').write_text('{"global":[],"by_department":{}}', encoding='utf-8')
                    model = module.HybridRecommender(root, root, enable_cf=False)
                    self.assertEqual(model.recommend_similar_items(1000, 20), [(i, float(i * 2)) for i in range(1, 21)])
                    expected = [(i, 0.3 * math.log1p(i * 2) / 10) for i in range(50, 40, -1)]
                    actual = model.recommend(0, [1000], 10)
                    self.assertEqual([pid for pid, _ in actual], [pid for pid, _ in expected])
                    for (_, score), (_, expected_score) in zip(actual, expected):
                        self.assertAlmostEqual(score, expected_score, places=12)
                for invalid in ('{"1000":', '{} trailing', '[]'):
                    path.write_text(invalid, encoding='utf-8')
                    with self.assertRaises(ValueError):
                        module.load_basket_neighbors(path)


if __name__ == '__main__':
    unittest.main()
