#!/usr/bin/env python3
"""
Create a new category:
- assets/levels/<category>/
- levels/packs/pack-<category>.json (if missing)
- add entry in levels/catalog.json (if missing)
- create wrapper descargar-<category>.py

Usage:
  py tools/crear_categoria.py --categoria anime
  py tools/crear_categoria.py --categoria anime --nombre "Anime" --tema "anime wallpaper"
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS_ROOT = ROOT / "assets" / "levels"
PACKS_ROOT = ROOT / "levels" / "packs"
CATALOG_PATH = ROOT / "levels" / "catalog.json"


def normalize_slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9_-]+", "-", text.strip().lower())
    slug = re.sub(r"-+", "-", slug).strip("-")
    if not slug:
        raise ValueError("Invalid category")
    return slug


def title_from_slug(slug: str) -> str:
    return slug.replace("-", " ").title()


def ensure_catalog_entry(category: str) -> bool:
    catalog = {"packs": []}
    if CATALOG_PATH.exists():
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    packs = catalog.get("packs") or []
    manifest = f"/levels/packs/pack-{category}.json"

    exists = any((p.get("id") == category or p.get("manifest") == manifest) for p in packs)
    if exists:
        return False

    packs.append({"id": category, "manifest": manifest})
    catalog["packs"] = packs
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True


def ensure_manifest(category: str, display_name: str) -> bool:
    path = PACKS_ROOT / f"pack-{category}.json"
    if path.exists():
        return False

    data = {
        "id": category,
        "name": display_name,
        "coverImage": f"/assets/levels/{category}/{category}-01.jpg",
        "levels": [],
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True


def ensure_wrapper(category: str) -> bool:
    path = ROOT / f"descargar-{category}.py"
    if path.exists():
        return False

    code = (
        "from subprocess import call\n"
        "import sys\n\n"
        f"cmd = [sys.executable, 'tools/descargar_categoria.py', '--categoria', '{category}'] + sys.argv[1:]\n"
        "raise SystemExit(call(cmd))\n"
    )
    path.write_text(code, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--categoria", required=True)
    parser.add_argument("--nombre", default="")
    parser.add_argument("--tema", action="append", default=[], help="Suggested topic for next download")
    args = parser.parse_args()

    try:
        category = normalize_slug(args.categoria)
    except ValueError as e:
        print(str(e))
        return 1

    display_name = args.nombre.strip() or title_from_slug(category)

    folder = ASSETS_ROOT / category
    folder.mkdir(parents=True, exist_ok=True)
    gitkeep = folder / ".gitkeep"
    if not gitkeep.exists():
        gitkeep.write_text("", encoding="utf-8")

    created_manifest = ensure_manifest(category, display_name)
    added_catalog = ensure_catalog_entry(category)
    created_wrapper = ensure_wrapper(category)

    print(f"Category: {category}")
    print(f"Folder:   assets/levels/{category}")
    print(f"Manifest: levels/packs/pack-{category}.json ({'created' if created_manifest else 'already exists'})")
    print(f"Catalog:  {'added' if added_catalog else 'already exists'}")
    print(f"Wrapper:  descargar-{category}.py ({'created' if created_wrapper else 'already exists'})")

    topics = args.tema or [category]
    topics_flags = " ".join([f"--tema \"{t}\"" for t in topics])
    print("\nNext step to download images:")
    print(f"  py descargar-{category}.py --cantidad 50 {topics_flags}".rstrip())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
