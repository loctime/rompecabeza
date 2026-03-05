#!/usr/bin/env python3
"""
Cuenta imágenes por categoría y compara con los niveles declarados en manifests.

Uso:
  py contar.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CATALOG = ROOT / "levels" / "catalog.json"
ASSETS = ROOT / "assets" / "levels"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def category_from_manifest(manifest_rel: str) -> str:
    name = Path(manifest_rel).name
    # pack-animales.json -> animales
    if name.startswith("pack-") and name.endswith(".json"):
        return name[len("pack-"):-len(".json")]
    return name.replace(".json", "")


def count_jpgs(folder: Path) -> int:
    if not folder.exists():
        return 0
    return sum(1 for p in folder.iterdir() if p.is_file() and p.suffix.lower() == ".jpg")


def main() -> int:
    if not CATALOG.exists():
        print("No existe levels/catalog.json")
        return 1

    catalog = load_json(CATALOG)
    packs = catalog.get("packs", [])

    rows = []
    total_imgs = 0
    total_levels = 0

    for p in packs:
        manifest_rel = p.get("manifest", "")
        manifest_path = ROOT / manifest_rel.lstrip("/")
        category = p.get("id") or category_from_manifest(manifest_rel)

        if not manifest_path.exists():
            rows.append((category, 0, 0, "manifest faltante"))
            continue

        manifest = load_json(manifest_path)
        levels = manifest.get("levels", [])
        declared = len(levels)
        images = count_jpgs(ASSETS / category)

        total_imgs += images
        total_levels += declared

        if images == declared:
            status = "OK"
        elif images > declared:
            status = f"sobran {images - declared}"
        else:
            status = f"faltan {declared - images}"

        rows.append((category, images, declared, status))

    cat_w = max(9, *(len(r[0]) for r in rows))
    print(f"{'Categoria':<{cat_w}}  Imagenes  Levels(manifest)  Estado")
    print(f"{'-' * cat_w}  --------  ----------------  ------")
    for cat, imgs, decl, status in rows:
        print(f"{cat:<{cat_w}}  {imgs:>8}  {decl:>16}  {status}")

    print("\nTotales")
    print(f"Imagenes: {total_imgs}")
    print(f"Levels declarados: {total_levels}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
