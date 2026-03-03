"""
Script para descargar 50 imágenes para los niveles del puzzle.
Guarda en assets/levels/ como nivel-01.jpg ... nivel-50.jpg.
Usa Picsum Photos (picsum.photos), estable y sin API key.
"""

import urllib.request
import os
import time

# Carpeta que usa el juego para las imágenes de niveles
CARPETA = "assets/levels"
os.makedirs(CARPETA, exist_ok=True)

# Títulos para cada nivel (solo para el mensaje al descargar; las imágenes vienen de Picsum)
TITULOS = [
    "Montaña", "Playa", "Bosque", "Desierto", "Cascada", "Lago", "Atardecer", "Cañón", "Nieve", "Valle",
    "Río", "Acantilado", "Aurora", "Pradera", "Volcán", "Selva", "Tundra", "Sabana", "Isla", "Niebla",
    "León", "Elefante", "Águila", "Lobo", "Delfín", "Tigre", "Oso", "Zorro", "Pingüino", "Ciervo",
    "Ballena", "Mariposa", "Jirafa", "Loro", "Caballo", "Guepardo", "Flamenco", "Tortuga", "Koala", "Búho",
    "Cactus", "Rosa", "Bambú", "Girasol", "Helecho", "Cerezo", "Orquídea", "Hongo", "Lavanda", "Loto",
]

# Picsum: misma URL = misma imagen (seed 1..50)
def url_imagen(numero):
    return f"https://picsum.photos/seed/rompecoco{numero}/1280/720"

# Descarga
print(f"Descargando 50 imágenes (Picsum Photos) en '{CARPETA}'...\n")
exitosas = 0
errores = 0

for i in range(1, 51):
    nombre_archivo = f"nivel-{i:02d}.jpg"
    ruta = os.path.join(CARPETA, nombre_archivo)
    titulo = TITULOS[i - 1] if i <= len(TITULOS) else f"Nivel {i}"
    url = url_imagen(i)
    try:
        print(f"[{i:02d}/50] {titulo} → {nombre_archivo}...", end=" ", flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0"})
        with urllib.request.urlopen(req, timeout=20) as response:
            with open(ruta, "wb") as f:
                f.write(response.read())
        print("✓")
        exitosas += 1
        time.sleep(0.4)  # Pausa para no saturar Picsum
    except Exception as e:
        print(f"✗ {e}")
        errores += 1

print(f"\n{'='*40}")
print(f"✅ Descargadas exitosamente: {exitosas}/50")
if errores:
    print(f"❌ Errores: {errores}")
print(f"📁 Carpeta: {os.path.abspath(CARPETA)}")
print(f"{'='*40}")

# Crear ZIP (opcional)
import zipfile
zip_nombre = "assets_levels_50.zip"
print(f"\nCreando {zip_nombre}...")
with zipfile.ZipFile(zip_nombre, "w", zipfile.ZIP_DEFLATED) as zf:
    for i in range(1, 51):
        archivo = f"nivel-{i:02d}.jpg"
        path = os.path.join(CARPETA, archivo)
        if os.path.isfile(path):
            zf.write(path, archivo)
print(f"✅ ZIP creado: {zip_nombre}")
print(f"📦 Listo! Archivo: {os.path.abspath(zip_nombre)}")