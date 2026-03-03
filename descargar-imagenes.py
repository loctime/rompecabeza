"""
Script para descargar 50 imágenes de alta calidad para rompecabezas.
Fuente: Unsplash API (requiere API key gratuita)
Filtros: brillo, contraste, entropía — ideal para puzzles

Cómo obtener tu API key GRATIS:
  1. Ir a https://unsplash.com/developers
  2. Click en "Register as a developer"
  3. Crear una app (nombre: cualquiera, ej. "mi-puzzle")
  4. Copiar el "Access Key" y pegarlo abajo en API_KEY

Uso:
  python descargar_imagenes_puzzle.py
"""

import sys
import subprocess
import os
import time
import urllib.request
import urllib.parse
import json
import io

# ─────────────────────────────────────────────
#  CONFIGURACIÓN — EDITÁ SOLO ESTA SECCIÓN
# ─────────────────────────────────────────────
API_KEY = "H7LHwbEeajAJkof-sk9viPMTER-n9WV5jERs2JL2Yy0"   # ← Reemplazá con tu Access Key de Unsplash

CARPETA = "assets/levels"      # Carpeta de salida
CANTIDAD = 50                  # Imágenes a descargar
RESOLUCION = "1280x720"        # Resolución final (ancho x alto)

# Umbrales de calidad (podés ajustar)
BRILLO_MIN = 65       # 0–255 — descarta imágenes muy oscuras
BRILLO_MAX = 190      # 0–255 — descarta imágenes muy claras
STDDEV_MIN = 35       # desviación estándar mínima (contraste)
ENTROPIA_MIN = 6.5    # entropía mínima (variedad visual, 0–8)
MAX_REINTENTOS = 5    # cuántas veces reintentar si no pasa el filtro

# Temas de búsqueda (se reparten entre las 50 imágenes)
TEMAS = [
    ("mountain landscape",   "Montaña"),
    ("tropical beach",       "Playa"),
    ("forest trees",         "Bosque"),
    ("desert dunes",         "Desierto"),
    ("waterfall nature",     "Cascada"),
    ("alpine lake",          "Lago"),
    ("sunset golden hour",   "Atardecer"),
    ("canyon rocks",         "Cañón"),
    ("snowy peaks",          "Nieve"),
    ("green valley",         "Valle"),
    ("river landscape",      "Río"),
    ("sea cliffs",           "Acantilado"),
    ("aurora borealis",      "Aurora"),
    ("wildflower meadow",    "Pradera"),
    ("volcano lava",         "Volcán"),
    ("rainforest jungle",    "Selva"),
    ("arctic tundra",        "Tundra"),
    ("african savanna",      "Sabana"),
    ("tropical island",      "Isla"),
    ("misty forest fog",     "Niebla"),
    ("lion portrait",        "León"),
    ("elephant wildlife",    "Elefante"),
    ("bald eagle",           "Águila"),
    ("wolf nature",          "Lobo"),
    ("dolphin ocean",        "Delfín"),
    ("tiger jungle",         "Tigre"),
    ("brown bear",           "Oso"),
    ("red fox",              "Zorro"),
    ("penguin antarctica",   "Pingüino"),
    ("deer forest",          "Ciervo"),
    ("whale ocean",          "Ballena"),
    ("butterfly macro",      "Mariposa"),
    ("giraffe savanna",      "Jirafa"),
    ("colorful parrot",      "Loro"),
    ("wild horse",           "Caballo"),
    ("cheetah running",      "Guepardo"),
    ("flamingo pink",        "Flamenco"),
    ("sea turtle",           "Tortuga"),
    ("koala tree",           "Koala"),
    ("owl bird",             "Búho"),
    ("cactus desert",        "Cactus"),
    ("red rose flower",      "Rosa"),
    ("bamboo forest",        "Bambú"),
    ("sunflower field",      "Girasol"),
    ("fern plant",           "Helecho"),
    ("cherry blossom",       "Cerezo"),
    ("orchid flower",        "Orquídea"),
    ("mushroom forest",      "Hongo"),
    ("lavender field",       "Lavanda"),
    ("lotus flower water",   "Loto"),
]
# ─────────────────────────────────────────────

def instalar_pillow():
    """Instala Pillow si no está disponible."""
    try:
        from PIL import Image, ImageStat
        return True
    except ImportError:
        print("📦 Pillow no encontrado. Instalando...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "--quiet"])
        print("✅ Pillow instalado correctamente.\n")
        return True

def analizar_calidad(datos_imagen):
    """
    Analiza brillo, contraste y entropía de una imagen.
    Retorna (brillo, stddev, entropia) o None si hay error.
    """
    from PIL import Image, ImageStat
    try:
        img = Image.open(io.BytesIO(datos_imagen)).convert("RGB")
        gris = img.convert("L")
        stat = ImageStat.Stat(gris)
        brillo = stat.mean[0]
        stddev = stat.stddev[0]
        entropia = gris.entropy()
        return brillo, stddev, entropia
    except Exception:
        return None

def pasa_filtros(brillo, stddev, entropia):
    """Retorna True si la imagen cumple todos los criterios de calidad."""
    if brillo < BRILLO_MIN:
        return False, f"muy oscura (brillo={brillo:.0f} < {BRILLO_MIN})"
    if brillo > BRILLO_MAX:
        return False, f"muy clara (brillo={brillo:.0f} > {BRILLO_MAX})"
    if stddev < STDDEV_MIN:
        return False, f"poco contraste (stddev={stddev:.1f} < {STDDEV_MIN})"
    if entropia < ENTROPIA_MIN:
        return False, f"poca variedad visual (entropía={entropia:.2f} < {ENTROPIA_MIN})"
    return True, "OK"

def buscar_unsplash(query, page=1):
    """Busca imágenes en Unsplash y retorna lista de URLs."""
    params = urllib.parse.urlencode({
        "query": query,
        "per_page": 10,
        "page": page,
        "orientation": "landscape",
        "order_by": "relevant",
    })
    url = f"https://api.unsplash.com/search/photos?{params}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Client-ID {API_KEY}",
        "Accept-Version": "v1",
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
    resultados = data.get("results", [])
    ancho, alto = RESOLUCION.split("x")
    urls = []
    for foto in resultados:
        url_img = foto["urls"]["raw"] + f"&w={ancho}&h={alto}&fit=crop&auto=format&q=85"
        urls.append((url_img, foto.get("id", "?")))
    return urls

def descargar_url(url):
    """Descarga una URL y retorna los bytes."""
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (puzzle-downloader/1.0)"
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()

def main():
    if API_KEY == "TU_API_KEY_AQUI":
        print("❌ ERROR: Necesitás configurar tu API key de Unsplash.")
        print()
        print("   Cómo obtenerla (gratis, 2 minutos):")
        print("   1. Ir a https://unsplash.com/developers")
        print("   2. Click en 'Register as a developer'")
        print("   3. Crear una app (nombre: cualquiera)")
        print("   4. Copiar el 'Access Key'")
        print("   5. Pegarlo en la variable API_KEY de este script")
        sys.exit(1)

    instalar_pillow()
    os.makedirs(CARPETA, exist_ok=True)

    print(f"🧩 Descargando {CANTIDAD} imágenes de calidad para puzzle...")
    print(f"   Fuente: Unsplash API | Resolución: {RESOLUCION}")
    print(f"   Filtros: brillo [{BRILLO_MIN}–{BRILLO_MAX}] | contraste ≥{STDDEV_MIN} | entropía ≥{ENTROPIA_MIN}")
    print(f"   Carpeta: {os.path.abspath(CARPETA)}\n")

    exitosas = 0
    rechazadas_total = 0

    for i, (query, titulo) in enumerate(TEMAS[:CANTIDAD], 1):
        nombre_archivo = f"nivel-{i:02d}.jpg"
        ruta = os.path.join(CARPETA, nombre_archivo)

        print(f"[{i:02d}/{CANTIDAD}] {titulo} ({query})")

        descargada = False
        pagina = 1

        for intento in range(1, MAX_REINTENTOS + 1):
            try:
                # Buscar candidatos
                candidatos = buscar_unsplash(query, page=pagina)
                if not candidatos:
                    print(f"         ⚠ Sin resultados para '{query}' (página {pagina})")
                    break

                # Probar cada candidato hasta encontrar uno que pase los filtros
                for url_img, foto_id in candidatos:
                    datos = descargar_url(url_img)
                    metricas = analizar_calidad(datos)

                    if metricas is None:
                        continue

                    brillo, stddev, entropia = metricas
                    ok, razon = pasa_filtros(brillo, stddev, entropia)

                    if ok:
                        with open(ruta, "wb") as f:
                            f.write(datos)
                        print(f"         ✅ OK  brillo={brillo:.0f}  contraste={stddev:.1f}  entropía={entropia:.2f}")
                        exitosas += 1
                        descargada = True
                        break
                    else:
                        print(f"         ↩ Rechazada ({razon})")
                        rechazadas_total += 1

                if descargada:
                    break

                # Si ningún candidato pasó, buscar en la siguiente página
                pagina += 1
                time.sleep(0.3)

            except Exception as e:
                print(f"         ✗ Error (intento {intento}/{MAX_REINTENTOS}): {e}")
                time.sleep(1)

        if not descargada:
            print(f"         ❌ No se encontró imagen aceptable para '{titulo}' tras {MAX_REINTENTOS} intentos")

        time.sleep(0.5)  # Respetar rate limit de Unsplash

    # Resumen
    print(f"\n{'='*50}")
    print(f"✅ Imágenes descargadas: {exitosas}/{CANTIDAD}")
    print(f"↩ Imágenes rechazadas (por filtros): {rechazadas_total}")
    print(f"📁 Carpeta: {os.path.abspath(CARPETA)}")
    print(f"{'='*50}")

    # Crear ZIP
    import zipfile
    zip_nombre = "assets_levels_50.zip"
    print(f"\n📦 Creando {zip_nombre}...")
    archivos_zip = 0
    with zipfile.ZipFile(zip_nombre, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in range(1, CANTIDAD + 1):
            archivo = f"nivel-{i:02d}.jpg"
            path = os.path.join(CARPETA, archivo)
            if os.path.isfile(path):
                zf.write(path, archivo)
                archivos_zip += 1
    print(f"✅ ZIP creado con {archivos_zip} imágenes: {os.path.abspath(zip_nombre)}")

if __name__ == "__main__":
    main()
