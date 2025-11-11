"""URL declarations for logistics features."""

from django.urls import path

from .views.waybill import OrderWaybillPdfView

app_name = 'logistics'

urlpatterns = [
    path(
        'orders/<int:pk>/waybill.pdf',
        OrderWaybillPdfView.as_view(),
        name='order_waybill_pdf',
    ),
]
