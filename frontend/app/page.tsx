import Link from 'next/link';
import { products } from '../lib/fixtures';
import { formatCurrency } from '../lib/format';
import { ProductCard } from '../components/product-card';

const featuredProducts = products.slice(0, 3);

export default function HomePage() {
  return (
    <div className="stack">
      <section className="hero">
        <div className="hero__content">
          <h1 className="hero__title">Создайте событие, которое запомнят</h1>
          <p className="hero__description">
            Подберите мебель, текстиль и декор в несколько кликов. Мы покажем стоимость аренды, залога и подскажем
            доступность на нужные даты.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" href="/catalog">
              Открыть каталог
            </Link>
            <Link className="button button--ghost" href="/cart">
              Посмотреть корзину
            </Link>
          </div>
        </div>
        <dl className="hero__metrics">
          <div>
            <dt>Премиальных позиций</dt>
            <dd>1200+</dd>
          </div>
          <div>
            <dt>Средний срок аренды</dt>
            <dd>3 дня</dd>
          </div>
          <div>
            <dt>Доставляем в</dt>
            <dd>Москве и области</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <div className="section__header">
          <h2 className="section__title">Популярные позиции</h2>
          <p className="section__subtitle">Эти предметы чаще всего бронируют для камерных вечеринок и свадеб.</p>
        </div>
        <div className="grid grid--responsive">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <h2 className="section__title">Как работает бронирование</h2>
        </div>
        <div className="grid grid--cols-3">
          <article className="card card--subtle">
            <h3 className="card__title">1. Подбор и даты</h3>
            <p className="card__description">
              Добавьте товары в корзину и укажите даты мероприятия. Мы покажем актуальную доступность каждого предмета.
            </p>
          </article>
          <article className="card card--subtle">
            <h3 className="card__title">2. Смета и оплата</h3>
            <p className="card__description">
              Получите расчёт аренды, доставки, монтажа и залога. Оплачивайте онлайн или по счёту для юридических лиц.
            </p>
          </article>
          <article className="card card--subtle">
            <h3 className="card__title">3. Доставка и возврат</h3>
            <p className="card__description">
              Наши специалисты вовремя привезут, соберут и заберут аренду. Возврат залога происходит после проверки.
            </p>
          </article>
        </div>
      </section>

      <section className="section section--accent">
        <div className="section__header">
          <h2 className="section__title">Стоимость по категориям</h2>
          <p className="section__subtitle">
            Быстрый ориентир по базовой цене аренды. Для больших заказов доступны индивидуальные условия.
          </p>
        </div>
        <div className="grid grid--cols-3">
          {featuredProducts.map((product) => (
            <article key={product.id} className="card card--compact">
              <h3 className="card__title">{product.category.name}</h3>
              <p className="card__description">{product.name}</p>
              <p className="card__metric">от {formatCurrency(product.base_price)} / сутки</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
