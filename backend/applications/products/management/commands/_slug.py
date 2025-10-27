"""Utilities for generating stable slugs for seeded categories."""

from __future__ import annotations

from django.utils.text import slugify

_RU_TO_LATIN = {
    'а': 'a',
    'б': 'b',
    'в': 'v',
    'г': 'g',
    'д': 'd',
    'е': 'e',
    'ё': 'yo',
    'ж': 'zh',
    'з': 'z',
    'и': 'i',
    'й': 'y',
    'к': 'k',
    'л': 'l',
    'м': 'm',
    'н': 'n',
    'о': 'o',
    'п': 'p',
    'р': 'r',
    'с': 's',
    'т': 't',
    'у': 'u',
    'ф': 'f',
    'х': 'h',
    'ц': 'ts',
    'ч': 'ch',
    'ш': 'sh',
    'щ': 'shch',
    'ъ': '',
    'ы': 'y',
    'ь': '',
    'э': 'e',
    'ю': 'yu',
    'я': 'ya',
}


def _transliterate(value: str) -> str:
    return ''.join(_RU_TO_LATIN.get(char, char) for char in value.lower())


def make_slug(name: str) -> str:
    transliterated = _transliterate(name)
    slug = slugify(transliterated, allow_unicode=False)
    if not slug:
        raise ValueError(f"Не удалось построить slug для категории '{name}'")
    return slug


__all__ = ['make_slug']
