"""Integration helpers for Yandex Maps APIs."""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

import requests

YANDEX_MAPS_KEY = os.environ.get("YANDEX_MAPS_KEY", "")


class YandexMapsError(RuntimeError):
    """Raised when Yandex Maps API responds with an error."""


def _get_api_key() -> str:
    key = YANDEX_MAPS_KEY or os.environ.get("YANDEX_MAPS_API_KEY", "")
    if not key:
        raise YandexMapsError("YANDEX_MAPS_KEY is not configured")
    return key


def geocode_address(query: str, *, lang: str = "ru_RU", timeout: float = 7.0) -> Optional[Dict[str, Any]]:
    """Resolve address details using Yandex Geocoder API.

    Returns a dictionary with normalized address data or ``None`` when the
    address could not be resolved.
    """

    query = (query or "").strip()
    if not query:
        return None

    params = {
        "apikey": _get_api_key(),
        "geocode": query,
        "lang": lang,
        "format": "json",
    }
    response = requests.get("https://geocode-maps.yandex.ru/v1/", params=params, timeout=timeout)
    response.raise_for_status()

    payload = response.json()
    collection = payload.get("response", {}).get("GeoObjectCollection", {})
    members = collection.get("featureMember", [])
    if not members:
        return None

    geo_object = members[0]["GeoObject"]
    meta = geo_object.get("metaDataProperty", {}).get("GeocoderMetaData", {})
    position = geo_object.get("Point", {}).get("pos", "")
    try:
        lon_str, lat_str = position.split()
        lon = float(lon_str)
        lat = float(lat_str)
    except (ValueError, AttributeError):
        lon = lat = None

    normalized = meta.get("Address", {}).get("formatted") or meta.get("text")
    return {
        "normalized": normalized or "",
        "lat": lat,
        "lon": lon,
        "kind": meta.get("kind", ""),
        "precision": meta.get("precision", ""),
        "uri": geo_object.get("uri", ""),
    }
