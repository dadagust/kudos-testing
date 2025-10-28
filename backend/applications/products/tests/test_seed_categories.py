"""Unit tests for the seed_categories management command helpers."""

from __future__ import annotations

import sys
from pathlib import Path

from applications.products.management.commands._slug import make_slug

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))


def test_make_slug_transliterates_russian_letters():
    assert make_slug('Мебель') == 'mebel'
    assert make_slug('Скатерти круглые') == 'skaterti-kruglye'


def test_make_slug_handles_compound_words():
    assert make_slug('Освещение') == 'osveshchenie'
    assert make_slug('Сервисные тарелки') == 'servisnye-tarelki'
