#!/usr/bin/env python3
"""
Download images by category from Unsplash, append to assets/levels/<category>,
and update levels/packs/pack-<category>.json.

Supports predefined or custom categories (example: anime).
If custom category is used, category name is used as default topic unless --tema is provided.

Usage:
  py tools/descargar_categoria.py --categoria animales --cantidad 50
  py tools/descargar_categoria.py --categoria anime --cantidad 50 --tema "anime wallpaper"
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
        ("lion portrait", "Lion"),
        ("elephant wildlife", "Elephant"),
        ("wolf nature", "Wolf"),
        ("tiger jungle", "Tiger"),
        ("owl bird", "Owl"),
        ("deer forest", "Deer"),
    ],
    "paisajes": [
        ("mountain landscape", "Mountain"),
        ("tropical beach", "Beach"),
        ("forest trees", "Forest"),
        ("waterfall nature", "Waterfall"),
        ("canyon rocks", "Canyon"),
        ("sunset golden hour", "Sunset"),
    ],
    "comidas": [
        ("food photography", "Food"),
        ("dessert close up", "Dessert"),
        ("italian pasta", "Pasta"),
        ("gourmet burger", "Burger"),
        ("fresh salad", "Salad"),
        ("street food", "Street Food"),
    ],
    "cosas": [
        ("vintage objects", "Objects"),
        ("workspace desk", "Desk"),
        ("mechanical parts", "Mechanics"),
        ("architecture details", "Architecture"),
        ("abstract texture", "Texture"),
        ("everyday objects", "Everyday"),
    ],
    "variado": [
        ("mountain landscape", "Mountain"),
        ("lion portrait", "Lion"),
        ("food photography", "Food"),
        ("vintage objects", "Objects"),
        ("tropical beach", "Beach"),
        ("dessert close up", "Dessert"),
    ],
    "infinito": [
        ("cinematic landscape", "Cinematic"),
        ("wildlife portrait", "Wildlife"),
        ("colorful abstract", "Abstract"),
        ("food close up", "Food"),
        ("travel photography", "Travel"),
        ("macro texture", "Macro"),
    ],
}

def load_dotenv() -> None:
    dotenv_path = ROOT / ".env"
    if not dotenv_path.exists():
        return
    for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

def normalize_slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9_-]+", "-", text.strip().lower())
    slug = re.sub(r"-+", "-", slug).strip("-")
    if not slug:
        raise ValueError("Invalid category")
    return slug


def require_pillow() -> None:
    try:
        import PIL  # noqa: F401
    except Exception:
        print("Installing Pillow...")
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
    params = urllib.parse.urlencode(
        {
            "query": query,
            "per_page": per_page,
            "page": page,
            "orientation": orientation,
            "order_by": "relevant",
        }
    )
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
        raw = (photo.get("urls") or {}).get("raw")
        pid = photo.get("id", "")
        if raw:
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
        "name": pack_id.replace("-", " ").title(),
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
        levels.append(
            {
                "id": f"{pack_id}-{n:02d}",
                "image": f"/assets/levels/{pack_id}/{pack_id}-{n:02d}.jpg",
                "grid": grid,
                "theme": pack_id,
                "title": f"{pack_id.replace('-', ' ').title()} {n}",
                "difficulty": difficulty,
            }
        )
    manifest["levels"] = levels
    if levels:
        manifest["coverImage"] = levels[0]["image"]


def build_topics(category: str, user_topics: List[str]) -> List[Tuple[str, str]]:
    if user_topics:
        return [(t, t) for t in user_topics]
    if category in CATEGORIAS:
        return CATEGORIAS[category]

    readable = category.replace("-", " ")
    return [
        (readable, readable.title()),
        (f"{readable} wallpaper", "Wallpaper"),
        (f"{readable} art", "Art"),
        (f"{readable} background", "Background"),
        (f"{readable} portrait", "Portrait"),
        (f"{readable} landscape", "Landscape"),
    ]


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--categoria", required=True)
    parser.add_argument("--cantidad", type=int, default=50)
    parser.add_argument("--api-key", default=os.getenv("UNSPLASH_ACCESS_KEY", ""))
    parser.add_argument("--resolucion", default="720x1280")
    parser.add_argument("--orientation", default="portrait", choices=["portrait", "landscape", "squarish"])
    parser.add_argument("--min-entropy", type=float, default=6.1)
    parser.add_argument("--tema", action="append", default=[], help="Search topic (repeatable)")
    args = parser.parse_args()

    try:
        category = normalize_slug(args.categoria)
    except ValueError as e:
        print(str(e))
        return 1

    if not args.api_key:
        print("Missing API key. Use --api-key or UNSPLASH_ACCESS_KEY")
        return 1
    if args.cantidad <= 0:
        print("Quantity must be > 0")
        return 1

    require_pillow()

    try:
        w_str, h_str = args.resolucion.lower().split("x", 1)
        width, height = int(w_str), int(h_str)
    except Exception:
        print("Invalid resolution. Example: 720x1280")
        return 1

    out_dir = ASSETS_ROOT / category
    out_dir.mkdir(parents=True, exist_ok=True)

    existing = list_existing_indices(out_dir, category)
    start_idx = (existing[-1] + 1) if existing else 1

    topics = build_topics(category, args.tema)
    page_by_query: Dict[str, int] = {q: 1 for q, _ in topics}

    downloaded = 0
    attempts = 0
    max_attempts = args.cantidad * 30

    print(f"Category: {category}")
    print(f"Output:   {out_dir}")
    print(f"Existing: {len(existing)}")
    print(f"Target:   {args.cantidad}")

    while downloaded < args.cantidad and attempts < max_attempts:
        attempts += 1
        n = start_idx + downloaded
        query, title = topics[downloaded % len(topics)]
        page = page_by_query[query]

        try:
            candidates = buscar_unsplash(args.api_key, query, page=page, per_page=12, orientation=args.orientation)
            page_by_query[query] = page + 1
            if not candidates:
                continue

            picked = None
            for raw_url, _pid in candidates:
                img_url = f"{raw_url}&w={width}&h={height}&fit=crop&auto=format&q=85"
                data = download_bytes(img_url)
                processed = resize_and_validate_jpeg(data, width, height, args.min_entropy)
                if processed is None:
                    continue
                picked = processed
                break

            if picked is None:
                continue

            filename = f"{category}-{n:02d}.jpg"
            (out_dir / filename).write_bytes(picked)
            downloaded += 1
            print(f"[{downloaded:02d}/{args.cantidad}] OK {filename} topic='{title}'")
            time.sleep(0.25)
        except Exception as e:
            print(f"Attempt {attempts}: {e}")
            time.sleep(0.8)

    if downloaded == 0:
        print("No images downloaded.")
        return 2

    manifest = load_manifest(category)
    append_levels_to_manifest(manifest, category, start_idx, downloaded)
    save_manifest(category, manifest)

    print("\nSummary")
    print(f"Downloaded: {downloaded}")
    print(f"Manifest updated: levels/packs/pack-{category}.json")
    if downloaded < args.cantidad:
        print(f"Warning: downloaded less than {args.cantidad}. Run again to keep appending.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


