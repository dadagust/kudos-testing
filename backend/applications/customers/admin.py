from django.contrib import admin

from .models import Company, Contact, Customer


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'inn',
        'kpp',
        'email',
        'phone',
        'is_active',
        'created',
    )
    list_filter = (
        'is_active',
    )
    search_fields = (
        'name',
        'inn',
        'legal_name',
    )


class ContactInline(admin.TabularInline):
    model = Contact
    raw_id_fields = (
        'customer',
        'company',
    )
    extra = 0


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        'display_name',
        'customer_type',
        'email',
        'phone',
        'owner',
        'company',
        'is_active',
        'created',
    )
    list_filter = (
        'customer_type',
        'is_active',
    )
    search_fields = (
        'display_name',
        'email',
        'phone',
        'company__name',
    )
    raw_id_fields = (
        'owner',
        'company',
    )
    inlines = (
        ContactInline,
    )


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = (
        'first_name',
        'last_name',
        'email',
        'phone',
        'customer',
        'company',
        'is_primary',
    )
    list_filter = (
        'is_primary',
    )
    search_fields = (
        'first_name',
        'last_name',
        'email',
        'customer__display_name',
        'company__name',
    )
    raw_id_fields = (
        'customer',
        'company',
    )
