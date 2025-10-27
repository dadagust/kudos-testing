"""Enum definitions for product attributes."""

from django.db import models


class Color(models.TextChoices):
    WHITE = 'white', 'Белый'
    GRAY = 'gray', 'Серый'
    BLACK = 'black', 'Чёрный'
    RED = 'red', 'Красный'
    ORANGE = 'orange', 'Оранжевый'
    BROWN = 'brown', 'Коричневый'
    YELLOW = 'yellow', 'Жёлтый'
    GREEN = 'green', 'Зелёный'
    TURQUOISE = 'turquoise', 'Бирюзовый'
    BLUE = 'blue', 'Синий'
    VIOLET = 'violet', 'Фиолетовый'


class DimensionShape(models.TextChoices):
    CIRCLE_DIAMETER = 'circle__diameter', 'Круг — диаметр'
    LINE_LENGTH = 'line__length', 'Линия — длина'
    RECTANGLE_LENGTH_WIDTH = 'rectangle__length_width', 'Прямоугольник — длина и ширина'
    CYLINDER_DIAMETER_HEIGHT = 'cylinder__diameter_height', 'Цилиндр — диаметр и высота'
    BOX_HEIGHT_WIDTH_DEPTH = 'box__height_width_depth', 'Параллелепипед — высота, ширина и глубина'


class TransportRestriction(models.TextChoices):
    ANY = 'any', 'Любой'
    TRUCK_ONLY = 'truck_only', 'Только грузовой'
    HEAVY_ONLY = 'heavy_only', 'Только большегрузный'
    HEAVY16_ONLY = 'heavy16_only', 'Только «Большегрузный 16+»'
    SPECIAL2_ONLY = 'special2_only', 'Только «Особый 2»'


class InstallerQualification(models.TextChoices):
    ANY = 'any', 'Любой'
    WORKER_WITH_STEAM_GENERATOR = (
        'worker_with_steam_generator',
        'Только «Работник с парогенератором»',
    )


class ReservationMode(models.TextChoices):
    OPERATOR_ONLY = 'operator_only', 'Только через оператора'
    ONLINE_ALLOWED = 'online_allowed', 'Разрешено онлайн'
    DISABLED = 'disabled', 'Запрещено'


class RentalMode(models.TextChoices):
    STANDARD = 'standard', 'Стандартный'
    SPECIAL = 'special', 'Особый'
