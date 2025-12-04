from applications.products.models import Category, Color, Product
from rest_framework.request import Request


def build_category_tree(categories: list[Category], parent: Category | None = None) -> list[dict]:
    result: list[dict] = []
    for category in categories:
        if category.parent_id == (parent.id if parent else None):
            result.append(
                {
                    'id': str(category.id),
                    'name': category.name,
                    'slug': category.slug,
                    'children': build_category_tree(categories, category),
                }
            )
    return result


def parse_include_param(request: Request) -> tuple[str, ...]:
    include = request.query_params.get('include')
    if not include:
        return ()
    return tuple(sorted(filter(None, (item.strip() for item in include.split(',')))))


def _has_error_code(codes, target: str) -> bool:
    if isinstance(codes, str):
        return codes == target
    if isinstance(codes, (list | tuple | set)):
        return any(_has_error_code(item, target) for item in codes)
    if isinstance(codes, dict):
        return any(_has_error_code(value, target) for value in codes.values())
    return False


def _collect_colors(groups, standalone_products):
    colors: dict[str, Color] = {}

    def register_product_color(product: Product):
        color = getattr(product, 'color', None)
        if color and color.value not in colors:
            colors[color.value] = color

    for group in groups:
        for product in group.products.all():
            register_product_color(product)

    for product in standalone_products:
        register_product_color(product)
    return [
        {'value': color.value, 'label': color.label}
        for color in colors.values()
    ]
