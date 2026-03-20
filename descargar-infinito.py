from subprocess import call
import sys

cmd = [sys.executable, 'tools/descargar_categoria.py', '--categoria', 'infinito'] + sys.argv[1:]
raise SystemExit(call(cmd))
