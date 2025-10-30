"""Enum definitions for product attributes."""

from django.db import models


class DimensionShape(models.TextChoices):
    CIRCLE_DIAMETER = 'circle__diameter', 'Круг — диаметр'
    LINE_LENGTH = 'line__length', 'Линия — длина'
    RECTANGLE_LENGTH_WIDTH = 'rectangle__length_width', 'Прямоугольник — длина и ширина'
    CYLINDER_DIAMETER_HEIGHT = 'cylinder__diameter_height', 'Цилиндр — диаметр и высота'
    BOX_HEIGHT_WIDTH_DEPTH = 'box__height_width_depth', 'Параллелепипед — высота, ширина и глубина'


class ReservationMode(models.TextChoices):
    OPERATOR_ONLY = 'operator_only', 'Только через оператора'
    ONLINE_ALLOWED = 'online_allowed', 'Разрешено онлайн'
    DISABLED = 'disabled', 'Запрещено'


class RentalMode(models.TextChoices):
    STANDARD = 'standard', 'Стандартный'
    SPECIAL = 'special', 'Особый'
