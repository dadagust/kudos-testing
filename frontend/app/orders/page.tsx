import type { Metadata } from 'next';
import { orders } from '../../lib/fixtures';
import { formatCurrency, formatDate, formatDateRange } from '../../lib/format';
import { orderStatusMap, paymentStatusMap, resolveStatus } from '../../lib/status';
import { StatusBadge } from '../../components/status-badge';

export const metadata: Metadata = {
  title: 'Мои заказы — Kudos Storefront',
  description: 'Следите за статусом бронирования, оплатами и залогом.',
};

export default function OrdersPage() {
  return (
    <div className="stack">
      <header className="section__header">
        <h1 className="section__title">История заказов</h1>
        <p className="section__subtitle">
          Здесь отображаются демо-заказы с ключевой информацией по статусу, оплате, доставке и залогу.
        </p>
      </header>

      <div className="stack">
        {orders.map((order) => {
          const orderStatus = resolveStatus(order.status, orderStatusMap, 'Статус не указан');
          const paymentStatus = resolveStatus(order.payment_status, paymentStatusMap, 'Нет данных по оплате');

          return (
            <article key={order.id} className="card order-card">
              <header className="order-card__header">
                <div>
                  <h2 className="order-card__title">{order.code}</h2>
                  <p className="order-card__subtitle">
                    Аренда {formatDateRange(order.rental_start_date, order.rental_end_date)} · создан {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="order-card__badges">
                  <StatusBadge label={orderStatus.label} tone={orderStatus.tone} />
                  <StatusBadge label={paymentStatus.label} tone={paymentStatus.tone} />
                </div>
              </header>

              <div className="order-card__grid">
                <section>
                  <h3 className="order-card__section-title">Состав заказа</h3>
                  <ul className="order-card__items">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        <span>{item.name}</span>
                        <span className="order-card__muted">
                          {item.quantity} шт · {item.rental_days} дн · {formatCurrency(item.unit_price)}/сутки
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="order-card__section-title">Итоги</h3>
                  <ul className="order-card__summary">
                    <li>
                      <span>Аренда</span>
                      <span>{formatCurrency(order.totals.rental_total)}</span>
                    </li>
                    <li>
                      <span>Доставка</span>
                      <span>{formatCurrency(order.totals.delivery_total)}</span>
                    </li>
                    <li>
                      <span>Залог</span>
                      <span>{formatCurrency(order.totals.deposit_total)}</span>
                    </li>
                    <li>
                      <span>Скидки</span>
                      <span>-{formatCurrency(order.totals.discount_total)}</span>
                    </li>
                    <li className="order-card__summary-total">
                      <span>К оплате</span>
                      <span>{formatCurrency(order.totals.grand_total)}</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="order-card__section-title">Клиент</h3>
                  <p className="order-card__muted">{order.customer.display_name}</p>
                  {order.company && <p className="order-card__muted">{order.company.trade_name}</p>}
                  <p className="order-card__muted">{order.customer.email}</p>
                </section>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
