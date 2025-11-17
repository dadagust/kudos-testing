from __future__ import annotations

import os
from decimal import ROUND_HALF_UP, Decimal
from math import atan2, cos, radians, sin, sqrt
from typing import Any

import requests

YANDEX_MAPS_KEY = os.environ.get('YANDEX_MAPS_SECRET', '')


class YandexMapsError(RuntimeError):
    """Raised when Yandex Maps API responds with an error."""


def _get_api_key() -> str:
    key = YANDEX_MAPS_KEY or os.environ.get('YANDEX_MAPS_SECRET', '')
    if not key:
        raise YandexMapsError('YANDEX_MAPS_KEY is not configured')
    return key


def geocode_address(
    query: str, *, lang: str = 'ru_RU', timeout: float = 7.0
) -> dict[str, Any] | None:
    """Resolve address details using Yandex Geocoder API.

    Returns a dictionary with normalized address data or ``None`` when the
    address could not be resolved.
    """

    query = (query or '').strip()
    if not query:
        return None

    params = {
        'apikey': _get_api_key(),
        'geocode': query,
        'lang': lang,
        'format': 'json',
    }
    headers = {'Referer': os.environ.get('YandexReferer', '')}  # апи яндекс карт - величие
    response = requests.get(
        'https://geocode-maps.yandex.ru/v1/', params=params, headers=headers, timeout=timeout
    )
    response.raise_for_status()

    payload = response.json()
    collection = payload.get('response', {}).get('GeoObjectCollection', {})
    members = collection.get('featureMember', [])
    if not members:
        return None

    geo_object = members[0]['GeoObject']
    meta = geo_object.get('metaDataProperty', {}).get('GeocoderMetaData', {})
    position = geo_object.get('Point', {}).get('pos', '')
    try:
        lon_str, lat_str = position.split()
        lon = float(lon_str)
        lat = float(lat_str)
    except (ValueError, AttributeError):
        lon = lat = None

    normalized = meta.get('Address', {}).get('formatted') or meta.get('text')
    return {
        'normalized': normalized or '',
        'lat': lat,
        'lon': lon,
        'kind': meta.get('kind', ''),
        'precision': meta.get('precision', ''),
        'uri': geo_object.get('uri', ''),
    }


def _request_router_distance(
    origin: tuple[float, float], destination: tuple[float, float], timeout: float
) -> Decimal:
    params = {
        'apikey': _get_api_key(),
        'mode': 'driving',
        'waypoints': f'{origin[1]},{origin[0]}|{destination[1]},{destination[0]}',
    }
    response = requests.get(
        'https://api.routing.yandex.net/v2/route', params=params, timeout=timeout
    )
    response.raise_for_status()
    payload = response.json()
    routes = payload.get('routes') or []
    if not routes:
        raise YandexMapsError('Маршрут не найден в ответе Яндекс.Карт.')
    try:
        distance_meters = routes[0]['legs'][0]['distance']['value']
    except (KeyError, IndexError, TypeError) as exc:
        raise YandexMapsError('Некорректный ответ от API маршрутизации Яндекс.') from exc
    return (Decimal(distance_meters) / Decimal('1000')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )


def _geodesic_distance(origin: tuple[float, float], destination: tuple[float, float]) -> Decimal:
    radius_km = 6371.0
    lat1, lon1 = origin
    lat2, lon2 = destination
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return Decimal(radius_km * c).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def calculate_route_distance_km(
    origin_address: str, destination_address: str, *, timeout: float = 7.0
) -> Decimal:
    """Calculate distance between two addresses using Yandex Maps data."""
    origin = geocode_address(origin_address)
    destination = geocode_address(destination_address)
    if not origin or not destination:
        raise YandexMapsError('Не удалось получить координаты для расчёта расстояния.')
    if None in (
        origin.get('lat'),
        origin.get('lon'),
        destination.get('lat'),
        destination.get('lon'),
    ):
        raise YandexMapsError('Яндекс.Карты не вернули координаты адреса.')
    origin_coords = (float(origin['lat']), float(origin['lon']))
    destination_coords = (float(destination['lat']), float(destination['lon']))
    try:
        return _request_router_distance(origin_coords, destination_coords, timeout)
    except (requests.RequestException, YandexMapsError):  # pragma: no cover - network fallback
        return _geodesic_distance(origin_coords, destination_coords)
