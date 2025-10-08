import type { Metadata } from 'next';
import type { Product } from '../../lib/fixtures';
import { products } from '../../lib/fixtures';
import { ProductCard } from '../../components/product-card';

export const metadata: Metadata = {
  title: 'Каталог — Kudos Storefront',
  description: 'Выберите мебель, декор и оборудование для вашего события.',
};

const groupedByCategory = products.reduce<Record<string, Product[]>>((acc, product) => {
  if (!acc[product.category.slug]) {
    acc[product.category.slug] = [];
  }

  acc[product.category.slug].push(product);
  return acc;
}, {});

const categoryOrder = products
  .map((product) => product.category)
  .filter((category, index, array) => array.findIndex((item) => item.id === category.id) === index);

export default function CatalogPage() {
  return (
    <div className="stack">
      <header className="section__header">
        <h1 className="section__title">Каталог аренды</h1>
        <p className="section__subtitle">
          Готовые позиции для банкетов, камерных вечеринок и масштабных событий. Доступность обновляется ежедневно.
        </p>
      </header>

      <div className="stack stack--large">
        {categoryOrder.map((category) => (
          <section key={category.id} className="section section--bordered">
            <header className="section__header section__header--compact">
              <h2 className="section__title">{category.name}</h2>
              <p className="section__subtitle">Подборка лучших предложений в категории.</p>
            </header>
            <div className="grid grid--responsive">
              {groupedByCategory[category.slug]?.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
