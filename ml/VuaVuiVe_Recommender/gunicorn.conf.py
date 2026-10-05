"""Render start command: gunicorn --config gunicorn.conf.py src.wsgi:app."""
import os

# WSGI deployments must not silently inherit the development security defaults.
os.environ.setdefault('ML_ENV', 'production')
port = int(os.environ.get('PORT', '10000'))
if not 1 <= port <= 65535:
    raise ValueError('PORT must be between 1 and 65535')
bind = f'0.0.0.0:{port}'
workers = 1
worker_class = 'sync'
threads = 1
timeout = 120
graceful_timeout = 30
preload_app = False
accesslog = None  # Do not put query strings/identity hints into hosting access logs.
errorlog = '-'
loglevel = 'info'
