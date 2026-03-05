#!/usr/bin/env python3
"""
Descarga imágenes por categoría (Unsplash), las suma en assets/levels/<categoria>
y actualiza levels/packs/pack-<categoria>.json.

Uso:
  python tools/descargar_categoria.py --categoria animales --cantidad 50
  python tools/descargar_categoria.py --categoria infinito --cantidad 50 --api-key TU_KEY

API key:
  - opción 1: variable de entorno UNSPLASH_ACCESS_KEY
  - opción 2: argumento --api-key
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
ASSETS_ROOT = ROOT / "assets" / "levels"
PACKS_ROOT = ROOT / "levels" / "packs"

GRID_CYCLE = [3, 4, 5, 6, 7]

CATEGORIAS: Dict[str, List[Tuple[str, str]]] = {
    "animales": [
        ("lion portrait", "Leon"),
        ("elephant wildlife", "Elefante"),
        ("wolf nature", "Lobo"),
        ("tiger jungle", "Tigre"),
        ("owl bird", "Buho"),
        ("deer forest", "Ciervo"),
    ],
    "paisajes": [
        ("mountain landscape", "Montana"),
        ("tropical beach", "Playa"),
        ("forest trees", "Bosque"),
        ("waterfall nature", "Cascada"),
        ("canyon rocks", "Canon"),
        ("sunset golden hour", "Atardecer"),
    ],
    "comidas": [
        ("food photography", "Comida"),
        ("dessert close up", "Postre"),
        ("italian pasta", "Pasta"),
        ("gourmet burger", "Hamburguesa"),
        ("fresh salad", "Ensalada"),
        ("street food", "Comida Callejera"),
    ],
    "cosas": [
        ("vintage objects", "Objetos"),
        ("workspace desk", "Escritorio"),
        ("mechanical parts", "Mecanica"),
        ("architecture details", "Arquitectura"),
        ("abstract texture", "Textura"),
        ("everyday objects", "Cotidiano"),
    ],
    "variado": [
        ("mountain landscape", "Montana"),
        ("lion portrait", "Leon"),
        ("food photography", "Comida"),
        ("vintage objects", "Objetos"),
        ("tropical beach", "Playa"),
        ("dessert close up", "Postre"),
    ],
    "infinito": [
        ("cinematic landscape", "Cinematico"),
        ("wildlife portrait", "Fauna"),
        ("colorful abstract", "Abstracto"),
        ("food close up", "Comida"),
        ("travel photography", "Viaje"),
        ("macro texture", "Macro"),
    ],
}


def require_pillow() -> None:
    try:
        import PIL  # noqa: F401
    except Exception:
        print("Instalando Pillow...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "--quiet"])


def list_existing_indices(folder: Path, prefix: str) -> List[int]:
    rx = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    found: List[int] = []
    for p in folder.glob(f"{prefix}-*.jpg"):
        m = rx.match(p.stem)
        if m:
            found.append(int(m.group(1)))
    return sorted(found)


def buscar_unsplash(api_key: str, query: str, page: int, per_page: int, orientation: str) -> List[Tuple[str, str]]:
    params = urllib.parse.urlencode({
        "query": query,
        "per_page": per_page,
        "page": page,
        "orientation": orientation,
        "order_by": "relevant",
    })
    url = f"https://api.unsplash.com/search/photos?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Client-ID {api_key}",
            "Accept-Version": "v1",
        },
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        data = json.loads(r.read())

    results = data.get("results", [])
    out: List[Tuple[str, str]] = []
    for photo in results:
        pid = photo.get("id", "")
        raw = (photo.get("urls") or {}).get("raw")
        if not raw:
            continue
        out.append((raw, pid))
    return out


def download_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "rompecoco-downloader/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def resize_and_validate_jpeg(data: bytes, width: int, height: int, min_entropy: float) -> bytes | None:
    from PIL import Image
    import io

    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        # Crop+resize exacto al tamaño pedido
        img_ratio = img.width / img.height
        target_ratio = width / height

        if img_ratio > target_ratio:
            new_w = int(img.height * target_ratio)
            x0 = (img.width - new_w) // 2
            img = img.crop((x0, 0, x0 + new_w, img.height))
        else:
            new_h = int(img.width / target_ratio)
            y0 = (img.height - new_h) // 2
            img = img.crop((0, y0, img.width, y0 + new_h))

        img = img.resize((width, height), Image.Resampling.LANCZOS)
        entropy = img.convert("L").entropy()
        if entropy < min_entropy:
            return None

        out = io.BytesIO()
        img.save(out, format="JPEG", quality=88, optimize=True)
        return out.getvalue()
    except Exception:
        return None


def load_manifest(pack_id: str) -> dict:
    path = PACKS_ROOT / f"pack-{pack_id}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "id": pack_id,
        "name": pack_id.capitalize(),
        "coverImage": f"/assets/levels/{pack_id}/{pack_id}-01.jpg",
        "levels": [],
    }


def save_manifest(pack_id: str, manifest: dict) -> None:
    path = PACKS_ROOT / f"pack-{pack_id}.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def append_levels_to_manifest(manifest: dict, pack_id: str, start_idx: int, added: int) -> None:
    levels = manifest.get("levels") or []
    for i in range(added):
        n = start_idx + i
        grid = GRID_CYCLE[(n - 1) % len(GRID_CYCLE)]
        difficulty = ((n - 1) % len(GRID_CYCLE)) + 1
        levels.append({
            "id": f"{pack_id}-{n:02d}",
            "image": f"/assets/levels/{pack_id}/{pack_id}-{n:02d}.jpg",
            "grid": grid,
            "theme": pack_id,
            "title": f"{pack_id.capitalize()} {n}",
            "difficulty": difficulty,
        })
    manifest["levels"] = levels
    if levels:
        manifest["coverImage"] = levels[0]["image"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--categoria", required=True, choices=sorted(CATEGORIAS.keys()))
    parser.add_argument("--cantidad", type=int, default=50)
    parser.add_argument("--api-key", default=os.getenv("UNSPLASH_ACCESS_KEY", ""))
    parser.add_argument("--resolucion", default="720x1280")
    parser.add_argument("--orientation", default="portrait", choices=["portrait", "landscape", "squarish"])
    parser.add_argument("--min-entropy", type=float, default=6.1)
    args = parser.parse_args()

    if not args.api_key:
        print("Falta API key. Usá --api-key o variable UNSPLASH_ACCESS_KEY")
        return 1

    if args.cantidad <= 0:
        print("La cantidad debe ser > 0")
        return 1

    require_pillow()

    try:
        w_str, h_str = args.resolucion.lower().split("x", 1)
        width, height = int(w_str), int(h_str)
    except Exception:
        print("Resolucion invalida. Ejemplo: 720x1280")
        return 1

    category = args.categoria
    out_dir = ASSETS_ROOT / category
    out_dir.mkdir(parents=True, exist_ok=True)

    existing = list_existing_indices(out_dir, category)
    start_idx = (existing[-1] + 1) if existing else 1

    topics = CATEGORIAS[category]
    page_by_query: Dict[str, int] = {q: 1 for q, _ in topics}

    downloaded = 0
    max_attempts = args.cantidad * 30
    attempts = 0

    print(f"Categoria: {category}")
    print(f"Destino:   {out_dir}")
    print(f"Existentes: {len(existing)}")
    print(f"A descargar: {args.cantidad}")

    while downloaded < args.cantidad and attempts < max_attempts:
        attempts += 1
        n = start_idx + downloaded
        q, title = topics[downloaded % len(topics)]
        page = page_by_query[q]

        try:
            candidates = buscar_unsplash(args.api_key, q, page=page, per_page=12, orientation=args.orientation)
            page_by_query[q] = page + 1
            if not candidates:
                continue

            picked = None
            for raw_url, pid in candidates:
                img_url = f"{raw_url}&w={width}&h={height}&fit=crop&auto=format&q=85"
                data = download_bytes(img_url)
                processed = resize_and_validate_jpeg(data, width, height, args.min_entropy)
                if processed is None:
                    continue
                picked = (processed, pid)
                break

            if not picked:
                continue

            filename = f"{category}-{n:02d}.jpg"
            path = out_dir / filename
            path.write_bytes(picked[0])
            downloaded += 1
            print(f"[{downloaded:02d}/{args.cantidad}] OK {filename}  tema='{title}'")
            time.sleep(0.25)
        except Exception as e:
            print(f"Intento {attempts}: {e}")
            time.sleep(0.8)

    if downloaded == 0:
        print("No se descargó ninguna imagen.")
        return 2

    manifest = load_manifest(category)
    append_levels_to_manifest(manifest, category, start_idx, downloaded)
    save_manifest(category, manifest)

    print("\nResumen")
    print(f"Descargadas: {downloaded}")
    print(f"Manifest actualizado: levels/packs/pack-{category}.json")
    if downloaded < args.cantidad:
        print(f"Aviso: se descargaron menos de {args.cantidad}. Podés volver a ejecutar y sigue sumando.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
