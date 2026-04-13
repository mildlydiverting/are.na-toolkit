#!/usr/bin/env python3
"""Build arena-palette.html from src/ files.

Usage:
    python3 arena-palette/build.py
    (run from repo root, or from inside arena-palette/)
"""

from pathlib import Path

SRC  = Path(__file__).parent / "src"
DIST = Path(__file__).parent / "dist" / "arena-palette.html"

def build():
    template = (SRC / "template.html").read_text()
    css      = (SRC / "style.css").read_text()
    js       = (SRC / "main.js").read_text()

    output = template.replace(
        "<!-- INJECT:CSS -->",
        f"<style>\n{css}\n</style>"
    ).replace(
        "<!-- INJECT:JS -->",
        f"<script>\n{js}\n</script>"
    )

    DIST.write_text(output)
    print(f"Built {DIST.relative_to(Path(__file__).parent.parent)} ({len(output.splitlines())} lines)")

if __name__ == "__main__":
    build()
