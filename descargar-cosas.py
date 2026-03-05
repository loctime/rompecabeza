from subprocess import call
import sys

cmd = [sys.executable, 'tools/descargar_categoria.py', '--categoria', 'cosas'] + sys.argv[1:]
raise SystemExit(call(cmd))
