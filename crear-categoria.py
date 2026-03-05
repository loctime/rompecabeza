from subprocess import call
import sys

cmd = [sys.executable, 'tools/crear_categoria.py'] + sys.argv[1:]
raise SystemExit(call(cmd))
