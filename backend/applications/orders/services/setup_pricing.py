from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Mapping, MutableMapping

from applications.products.models import InstallerQualification, Product

CURRENCY_QUANT = Decimal('0.01')


@dataclass
class SetupPricingResult:
    installation_total: Decimal
    dismantle_total: Decimal
    installation_hours: Decimal
    dismantle_hours: Decimal
    services_total: Decimal


def build_setup_requirements(
    totals: Mapping[str, int], products: Mapping[str, Product]
) -> list[tuple[Product, int]]:
    """Pair products with the ordered quantities for setup calculations."""

    requirements: list[tuple[Product, int]] = []
    for product_id, quantity in totals.items():
        if quantity <= 0:
            continue
        product = products.get(product_id)
        if not product:
            continue
        requirements.append((product, quantity))
    return requirements


def calculate_setup_pricing(
    requirements: Iterable[tuple[Product, int]],
) -> SetupPricingResult:
    """Calculate installation/dismantle costs according to the new rules."""

    total_install_minutes = Decimal('0')
    total_uninstall_minutes = Decimal('0')
    max_installers = 0
    qualification_counts: MutableMapping[str, int] = {}
    qualification_instances: MutableMapping[str, InstallerQualification] = {}
    any_qualification: InstallerQualification | None = None
    needs_any_qualification = False

    for product, quantity in requirements:
        if quantity <= 0:
            continue
        install_minutes = Decimal(product.setup_install_minutes or 0)
        uninstall_minutes = Decimal(product.setup_uninstall_minutes or 0)
        qty = Decimal(quantity)
        total_install_minutes += install_minutes * qty
        total_uninstall_minutes += uninstall_minutes * qty

        installers_required = product.setup_min_installers or 0
        max_installers = max(max_installers, installers_required)

        qualification = product.setup_installer_qualification
        if qualification is None:
            needs_any_qualification = needs_any_qualification or installers_required > 0
            continue
        if qualification.is_any:
            any_qualification = any_qualification or qualification
            needs_any_qualification = needs_any_qualification or installers_required > 0
            continue

        key = str(qualification.pk)
        qualification_instances[key] = qualification
        qualification_counts[key] = qualification_counts.get(key, 0) + installers_required

    total_specific_installers = sum(qualification_counts.values())
    max_installers = max(max_installers, total_specific_installers)

    if max_installers == 0 and (total_install_minutes > 0 or total_uninstall_minutes > 0):
        max_installers = 1
        needs_any_qualification = True

    any_installers = max(max_installers - total_specific_installers, 0)
    if any_installers > 0:
        needs_any_qualification = True

    if needs_any_qualification and any_qualification is None:
        any_qualification = InstallerQualification.get_any()

    total_install_hours = _minutes_to_hours(total_install_minutes)
    total_uninstall_hours = _minutes_to_hours(total_uninstall_minutes)

    specific_requirements = [
        (qualification_instances[key], count)
        for key, count in qualification_counts.items()
        if key in qualification_instances
    ]

    installation_total = _calculate_total_for_hours(
        total_install_hours, specific_requirements, any_installers, any_qualification
    )
    dismantle_total = _calculate_total_for_hours(
        total_uninstall_hours, specific_requirements, any_installers, any_qualification
    )
    services_total = installation_total + dismantle_total

    return SetupPricingResult(
        installation_total=installation_total,
        dismantle_total=dismantle_total,
        installation_hours=total_install_hours,
        dismantle_hours=total_uninstall_hours,
        services_total=services_total,
    )


def _minutes_to_hours(minutes: Decimal) -> Decimal:
    if not minutes:
        return Decimal('0.00')
    return (minutes / Decimal('60')).quantize(Decimal('0.0001'))


def _calculate_total_for_hours(
    total_hours: Decimal,
    specific_requirements: Iterable[tuple[InstallerQualification, int]],
    any_installers: int,
    any_qualification: InstallerQualification | None,
) -> Decimal:
    total = Decimal('0.00')
    for qualification, count in specific_requirements:
        total += _installer_cost(total_hours, qualification) * count
    if any_installers > 0:
        total += _installer_cost(total_hours, any_qualification) * any_installers
    return total.quantize(CURRENCY_QUANT, rounding=ROUND_HALF_UP)


def _installer_cost(hours: Decimal, qualification: InstallerQualification | None) -> Decimal:
    if qualification is None:
        minimal_price = Decimal('0.00')
        hour_price = Decimal('0.00')
    else:
        minimal_price = Decimal(qualification.minimal_price_rub or 0)
        hour_price = Decimal(qualification.hour_price_rub or 0)

    calculated = (hour_price * hours).quantize(CURRENCY_QUANT, rounding=ROUND_HALF_UP)
    return max(minimal_price, calculated)
