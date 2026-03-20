from subprocess import call
import sys

cmd = [sys.executable, 'tools/descargar_categoria.py', '--categoria', 'variado'] + sys.argv[1:]
raise SystemExit(call(cmd))
