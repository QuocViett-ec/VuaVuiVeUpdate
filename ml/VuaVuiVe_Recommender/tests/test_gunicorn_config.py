import os
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch


class GunicornConfigTest(unittest.TestCase):
    def test_render_port_single_worker_and_secure_defaults(self):
        config = Path(__file__).resolve().parents[1] / 'gunicorn.conf.py'
        with patch.dict(os.environ, {'PORT': '10000'}, clear=True):
            settings = runpy.run_path(str(config))
            self.assertEqual(settings['bind'], '0.0.0.0:10000')
            self.assertEqual(settings['workers'], 1)
            self.assertEqual(settings['worker_class'], 'sync')
            self.assertIsNone(settings['accesslog'])
            self.assertEqual(os.environ['ML_ENV'], 'production')

    def test_invalid_port_fails_before_server_start(self):
        config = Path(__file__).resolve().parents[1] / 'gunicorn.conf.py'
        with patch.dict(os.environ, {'PORT': '70000'}, clear=True):
            with self.assertRaises(ValueError):
                runpy.run_path(str(config))
