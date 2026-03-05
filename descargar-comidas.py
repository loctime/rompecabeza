from subprocess import call
import sys

cmd = [sys.executable, 'tools/descargar_categoria.py', '--categoria', 'comidas'] + sys.argv[1:]
raise SystemExit(call(cmd))
