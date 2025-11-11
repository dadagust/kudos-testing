"""PDF waybill generation for logistics workflows."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.formats import date_format
from django.utils.timezone import localdate
from django.views import View
from weasyprint import CSS, HTML

from applications.orders.models import DeliveryType, Order, PaymentStatus
from applications.products.models import OrderStockTransactionType


@dataclass(frozen=True)
class WaybillItem:
    """Serializable representation of an order item for the PDF template."""

    index: int
    title: str
    place: str
    quantity_planned: str
    quantity_returned: str


class OrderWaybillPdfView( View):
    """Render a PDF waybill for a specific order using WeasyPrint."""

    template_name = 'pdf/waybill.html'
    _allowed_contexts = {'prep', 'receiving'}

    def get(self, request: HttpRequest, pk: int, *args, **kwargs) -> HttpResponse:  # noqa: D401
        """Handle ``GET`` requests and return an inline PDF response."""

        context_kind = request.GET.get('context', 'prep')
        if context_kind not in self._allowed_contexts:
            context_kind = 'prep'

        order = self._load_order(pk)

        template_ctx = {
            'order': order,
            'items': self._build_items(order, context_kind),
            'context_kind': context_kind,
            'landlord': {
                'name': getattr(
                    settings,
                    'WAYBILL_LANDLORD_NAME',
                    'ИП Климовицкий Алексей Михайлович',
                ),
                'addr': getattr(
                    settings,
                    'WAYBILL_LANDLORD_ADDR',
                    '105187, г. Москва, г. Москва, Вернисажная ул., 6',
                ),
            },
            'logo_static': getattr(settings, 'WAYBILL_LOGO_PATH', 'img/kudos-logo.svg'),
            'delivery_address': self._resolve_delivery_address(order),
            'customer_label': self._resolve_customer(order),
            'shipment_window': self._format_date(order.shipment_date),
            'mount_window': self._format_window(order.installation_date, order.mount_datetime_from, order.mount_datetime_to),
            'dismount_window': self._format_window(order.dismantle_date, order.dismount_datetime_from, order.dismount_datetime_to),
            'payment_status_label': self._resolve_payment_status(order),
            'order_comment': order.comment or '—',
            'generated_at': date_format(localdate(timezone.now()), 'd.m.Y'),
        }

        html = render_to_string(self.template_name, template_ctx)
        pdf_bytes = HTML(string=html, base_url=request.build_absolute_uri('/')).write_pdf(
            stylesheets=[CSS(filename=self._resolve_stylesheet_path())]
        )

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="waybill-{order.pk}.pdf"'
        return response

    def _load_order(self, pk: int) -> Order:
        try:
            return (
                Order.objects.select_related('customer')
                .prefetch_related('items__product__category', 'stock_transactions__product')
                .get(pk=pk)
            )
        except Order.DoesNotExist as exc:  # pragma: no cover - defensive programming
            raise Http404('Order not found.') from exc

    def _build_items(self, order: Order, context_kind: str) -> Iterable[WaybillItem]:
        return_quantities = self._collect_return_quantities(order)

        items: list[WaybillItem] = []
        for index, item in enumerate(order.items.all(), start=1):
            product = item.product
            title = item.product_name or (product.name if product else '')
            place = ''
            if product and getattr(product, 'category', None):
                place = product.category.name or ''

            planned = str(item.quantity) if context_kind == 'prep' else ''
            returned = ''
            if context_kind == 'receiving' and item.product_id:
                returned_value = return_quantities.get(str(item.product_id))
                if returned_value is not None:
                    returned = str(returned_value)

            items.append(
                WaybillItem(
                    index=index,
                    title=title,
                    place=place,
                    quantity_planned=planned,
                    quantity_returned=returned,
                )
            )
        return items

    def _collect_return_quantities(self, order: Order) -> dict[str, int]:
        quantities: dict[str, int] = {}
        for transaction in order.stock_transactions.all():
            if transaction.order_transaction_type != OrderStockTransactionType.RETURN:
                continue
            if not transaction.product_id:
                continue
            quantities[str(transaction.product_id)] = abs(transaction.quantity_delta)
        return quantities

    def _resolve_delivery_address(self, order: Order) -> str:
        if order.delivery_type == DeliveryType.PICKUP:
            return 'Самовывоз'
        address = order.delivery_address or ''
        return address or '—'

    def _resolve_customer(self, order: Order) -> str:
        customer = getattr(order, 'customer', None)
        if not customer:
            return '—'
        label = getattr(customer, 'display_name', None) or customer.__str__()
        return label or '—'

    def _resolve_payment_status(self, order: Order) -> str:
        mapping = {
            PaymentStatus.PAID: 'оплачен',
            PaymentStatus.UNPAID: 'не оплачен',
            PaymentStatus.PARTIALLY_PAID: 'частично оплачен',
        }
        return mapping.get(order.payment_status, order.get_payment_status_display() or '—')

    def _format_window(self, date_value, time_from, time_to) -> str:
        if not date_value:
            return '—'
        date_str = self._format_date(date_value)
        time_from_str = time_from.strftime('%H:%M') if time_from else ''
        time_to_str = time_to.strftime('%H:%M') if time_to else ''
        if time_from_str and time_to_str:
            return f'{date_str}, {time_from_str} — {time_to_str}'
        if time_from_str:
            return f'{date_str}, {time_from_str}'
        if time_to_str:
            return f'{date_str}, {time_to_str}'
        return date_str

    def _format_date(self, value) -> str:
        if not value:
            return '—'
        return date_format(value, 'd.m.Y')

    def _resolve_stylesheet_path(self) -> str:
        base_dir: Path = getattr(settings, 'BASE_DIR')
        stylesheet = base_dir / 'static' / 'pdf' / 'waybill.css'
        return str(stylesheet)
