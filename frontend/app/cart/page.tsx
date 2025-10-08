import type { Metadata } from 'next';
import { orders, products } from '../../lib/fixtures';
import { formatCurrency, formatDateRange } from '../../lib/format';

const sampleOrder = orders[0];
const cartItems = sampleOrder.items.map((item) => ({
  ...item,
  product: products.find((product) => product.id === item.product_id),
}));

export const metadata: Metadata = {
  title: 'Корзина — Kudos Storefront',
  description: 'Проверьте состав заказа, сроки аренды и итоговую стоимость.',
};

export default function CartPage() {
  return (
    <div className="stack">
      <header className="section__header">
        <h1 className="section__title">Корзина</h1>
        <p className="section__subtitle">
          Предварительная смета на даты {formatDateRange(sampleOrder.rental_start_date, sampleOrder.rental_end_date)}. Все
          расчёты основаны на моковых данных и демонстрируют финальный вид интерфейса.
        </p>
      </header>

      <section className="section section--bordered">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Кол-во</th>
                <th>Дней</th>
                <th>Стоимость аренды</th>
                <th>Залог</th>
                <th>Итого</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="table__item">
                      <span className="table__title">{item.name}</span>
                      {item.product?.category && <span className="table__caption">{item.product.category.name}</span>}
                    </div>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{item.rental_days}</td>
                  <td>{formatCurrency(item.unit_price * item.quantity * item.rental_days)}</td>
                  <td>{formatCurrency(item.deposit_amount * item.quantity)}</td>
                  <td>
                    {formatCurrency(
                      item.unit_price * item.quantity * item.rental_days + item.deposit_amount * item.quantity - item.discount_amount,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section section--accent cart-summary">
        <div className="cart-summary__info">
          <h2 className="section__title">К оплате</h2>
          <ul className="cart-summary__list">
            <li>
              <span>Аренда</span>
              <span>{formatCurrency(sampleOrder.totals.rental_total)}</span>
            </li>
            <li>
              <span>Доставка</span>
              <span>{formatCurrency(sampleOrder.totals.delivery_total)}</span>
            </li>
            <li>
              <span>Залог</span>
              <span>{formatCurrency(sampleOrder.totals.deposit_total)}</span>
            </li>
            <li>
              <span>Скидка</span>
              <span>-{formatCurrency(sampleOrder.totals.discount_total)}</span>
            </li>
          </ul>
          <div className="cart-summary__total">
            <span>Итого</span>
            <span>{formatCurrency(sampleOrder.totals.grand_total)}</span>
          </div>
        </div>
        <div className="cart-summary__actions">
          <button type="button" className="button button--primary">
            Перейти к оформлению
          </button>
          <button type="button" className="button button--ghost">
            Отправить счёт менеджеру
          </button>
          <p className="cart-summary__hint">
            Финальная сумма может измениться после уточнения доступности и стоимости доставки. На экране оформления заказа
            появятся поля для контактных данных, адреса и оплаты.
          </p>
        </div>
      </section>
    </div>
  );
}
