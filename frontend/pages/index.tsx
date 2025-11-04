import Head from 'next/head';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  authApi,
  CreateOrderPayload,
  OrderDetail,
  ordersApi,
  ProductSummary,
  productsApi,
  UserProfile,
} from '../lib/api';
import styles from '../styles/Home.module.css';

type DeliveryOption = 'delivery' | 'pickup';

type LoginFormState = {
  email: string;
  password: string;
};

type OrderFormState = {
  installationDate: string;
  dismantleDate: string;
  deliveryType: DeliveryOption;
  deliveryAddress: string;
  comment: string;
  productQuantities: Record<string, number>;
};

type Tokens = {
  access: string;
  refresh: string;
};

const createInitialLoginForm = (): LoginFormState => ({
  email: '',
  password: '',
});

const createInitialOrderForm = (): OrderFormState => ({
  installationDate: '',
  dismantleDate: '',
  deliveryType: 'delivery',
  deliveryAddress: '',
  comment: '',
  productQuantities: {},
});

const sanitizeQuantity = (product: ProductSummary, rawValue: number) => {
  if (!Number.isFinite(rawValue)) {
    return 0;
  }
  const available = Math.max(0, product.available_stock_qty ?? 0);
  if (available <= 0) {
    return 0;
  }
  const integer = Math.trunc(rawValue);
  if (integer <= 0) {
    return 0;
  }
  return Math.min(integer, available);
};

const ensureQuantities = (products: ProductSummary[], previous?: Record<string, number>) => {
  const quantities: Record<string, number> = {};
  products.forEach((product) => {
    const previousValue = Number(previous?.[product.id] ?? 0);
    if (!Number.isFinite(previousValue) || previousValue <= 0) {
      quantities[product.id] = 0;
      return;
    }
    quantities[product.id] = sanitizeQuantity(product, previousValue);
  });
  return quantities;
};

export default function Home() {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [loginForm, setLoginForm] = useState<LoginFormState>(createInitialLoginForm);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [orderForm, setOrderForm] = useState<OrderFormState>(createInitialOrderForm);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<OrderDetail | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('kudos-client-auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { tokens: Tokens; user: UserProfile };
        if (parsed.tokens?.access && parsed.tokens?.refresh) {
          setTokens(parsed.tokens);
          setUser(parsed.user ?? null);
        }
      } catch (error) {
        console.error('Failed to parse stored auth data', error);
        localStorage.removeItem('kudos-client-auth');
      }
    }
    setIsRestoringSession(false);
  }, []);

  useEffect(() => {
    if (!tokens?.access) {
      return;
    }

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setProductsError(null);
      try {
        const items = await productsApi.list(tokens.access);
        setProducts(items);
        setOrderForm((previous) => ({
          ...previous,
          productQuantities: ensureQuantities(items, previous.productQuantities),
        }));
      } catch (error) {
        console.error(error);
        const message =
          error instanceof ApiError
            ? error.message
            : 'Не удалось загрузить список товаров. Попробуйте еще раз позднее.';
        setProductsError(message);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    void loadProducts();
  }, [tokens]);

  useEffect(() => {
    if (isRestoringSession) {
      return;
    }

    if (!tokens) {
      localStorage.removeItem('kudos-client-auth');
      return;
    }

    localStorage.setItem('kudos-client-auth', JSON.stringify({ tokens, user }));
  }, [isRestoringSession, tokens, user]);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await authApi.login(loginForm.email.trim(), loginForm.password);
      setTokens({ access: response.access, refresh: response.refresh });
      setUser(response.user);
      setLoginForm(createInitialLoginForm());
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError && error.status !== 0
          ? error.message
          : 'Не удалось выполнить вход. Проверьте данные и повторите попытку.';
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setTokens(null);
    setUser(null);
    setProducts([]);
    setOrderForm(createInitialOrderForm());
    setOrderSuccess(null);
    setProductsError(null);
  };

  const atLeastOneProductSelected = useMemo(
    () =>
      products.some((product) => {
        const value = Number(orderForm.productQuantities[product.id] ?? 0);
        return sanitizeQuantity(product, value) > 0;
      }),
    [orderForm.productQuantities, products]
  );

  const handleOrderSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOrderError(null);
    setOrderSuccess(null);

    if (!tokens?.access) {
      setOrderError('Для создания заказа требуется выполнить вход.');
      return;
    }

    if (!atLeastOneProductSelected) {
      setOrderError('Добавьте хотя бы один товар.');
      return;
    }

    if (orderForm.deliveryType === 'delivery' && !orderForm.deliveryAddress.trim()) {
      setOrderError('Укажите адрес доставки или выберите самовывоз.');
      return;
    }

    if (!user && !orderForm.comment.trim()) {
      setOrderError('Укажите контактные данные, чтобы мы могли связаться с вами.');
      return;
    }

    for (const product of products) {
      const rawValue = Number(orderForm.productQuantities[product.id] ?? 0);
      if (!Number.isFinite(rawValue) || rawValue < 0) {
        setOrderError('Количество должно быть неотрицательным числом.');
        return;
      }
      const available = Math.max(0, product.available_stock_qty ?? 0);
      if (rawValue > available) {
        setOrderError(
          `Для товара «${product.name}» доступно только ${available} шт.`
        );
        return;
      }
    }

    const items = products
      .map((product) => {
        const rawValue = Number(orderForm.productQuantities[product.id] ?? 0);
        const quantity = sanitizeQuantity(product, rawValue);
        return quantity > 0 ? { product_id: product.id, quantity } : null;
      })
      .filter(
        (
          item
        ): item is {
          product_id: string;
          quantity: number;
        } => item !== null
      );

    const payload: CreateOrderPayload = {
      status: 'new',
      installation_date: orderForm.installationDate,
      dismantle_date: orderForm.dismantleDate,
      delivery_type: orderForm.deliveryType,
      delivery_address:
        orderForm.deliveryType === 'pickup' ? null : orderForm.deliveryAddress.trim() || null,
      comment: orderForm.comment.trim() || null,
      items,
    };

    setIsSubmittingOrder(true);
    try {
      const response = await ordersApi.create(payload, tokens.access);
      setOrderSuccess(response.data);
      setOrderForm((previous) => ({
        ...createInitialOrderForm(),
        productQuantities: ensureQuantities(products),
      }));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? error.message
          : 'Не удалось создать заказ. Попробуйте еще раз немного позже.';
      setOrderError(message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <>
      <Head>
        <title>Kudos Клиентская часть</title>
        <meta name="description" content="Клиентский интерфейс создания заказов" />
      </Head>
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>Создание заказов</h1>
            <p className={styles.subtitle}>
              Авторизуйтесь, выберите подходящие товары и отправьте заявку на аренду.
            </p>
            <div className={styles.authBlock}>
              {user ? (
                <div className={styles.loggedIn}>
                  <span className={styles.userBadge}>
                    Вы вошли как {user.full_name || user.email}
                  </span>
                  <button className={styles.button} onClick={handleLogout}>
                    Выйти
                  </button>
                </div>
              ) : (
                <form className={styles.loginForm} onSubmit={handleLoginSubmit}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="login-email">
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      className={styles.input}
                      value={loginForm.email}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder="client@example.com"
                      required
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="login-password">
                      Пароль
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      className={styles.input}
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      placeholder="Введите пароль"
                      required
                    />
                  </div>
                  {loginError && <p className={styles.errorText}>{loginError}</p>}
                  <button className={styles.button} type="submit" disabled={isLoggingIn}>
                    {isLoggingIn ? 'Входим…' : 'Войти'}
                  </button>
                </form>
              )}
            </div>
          </header>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Шаг 1. Заполните данные заказа</h2>
            {productsError && <p className={styles.errorText}>{productsError}</p>}
            <form className={styles.orderForm} onSubmit={handleOrderSubmit}>
              <div className={styles.formRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="installation-date">
                    Дата монтажа
                  </label>
                  <input
                    id="installation-date"
                    type="date"
                    className={styles.input}
                    value={orderForm.installationDate}
                    onChange={(event) =>
                      setOrderForm((prev) => ({ ...prev, installationDate: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="dismantle-date">
                    Дата демонтажа
                  </label>
                  <input
                    id="dismantle-date"
                    type="date"
                    className={styles.input}
                    value={orderForm.dismantleDate}
                    onChange={(event) =>
                      setOrderForm((prev) => ({ ...prev, dismantleDate: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Способ получения</legend>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="delivery-type"
                    value="delivery"
                    checked={orderForm.deliveryType === 'delivery'}
                    onChange={() => setOrderForm((prev) => ({ ...prev, deliveryType: 'delivery' }))}
                  />
                  Доставка по адресу
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="delivery-type"
                    value="pickup"
                    checked={orderForm.deliveryType === 'pickup'}
                    onChange={() =>
                      setOrderForm((prev) => ({
                        ...prev,
                        deliveryType: 'pickup',
                        deliveryAddress: '',
                      }))
                    }
                  />
                  Самовывоз со склада
                </label>
              </fieldset>

              {orderForm.deliveryType === 'delivery' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="delivery-address">
                    Адрес доставки
                  </label>
                  <input
                    id="delivery-address"
                    type="text"
                    className={styles.input}
                    value={orderForm.deliveryAddress}
                    onChange={(event) =>
                      setOrderForm((prev) => ({ ...prev, deliveryAddress: event.target.value }))
                    }
                    placeholder="Город, улица, дом"
                  />
                </div>
              )}

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="order-comment">
                  {user
                    ? 'Комментарий к заказу (по желанию)'
                    : 'Напишите свои контактные данные, чтобы мы с вами связались'}
                </label>
                <textarea
                  id="order-comment"
                  className={styles.textarea}
                  value={orderForm.comment}
                  onChange={(event) =>
                    setOrderForm((prev) => ({ ...prev, comment: event.target.value }))
                  }
                  placeholder={user ? 'Дополнительная информация для менеджера' : 'Телефон и имя'}
                  required={!user}
                />
              </div>

              <div className={styles.fieldGroup}>
                <p className={styles.label}>Прайс-лист</p>
                {isLoadingProducts ? (
                  <p className={styles.helperText}>Загружаем товары…</p>
                ) : (
                  <ul className={styles.productList}>
                    {products.map((product) => (
                      <li key={product.id} className={styles.productItem}>
                      <div className={styles.productInfo}>
                        <span className={styles.productName}>{product.name}</span>
                        {Number.isFinite(product.base_price) && (
                          <span className={styles.productPrice}>
                            {new Intl.NumberFormat('ru-RU', {
                              style: 'currency',
                              currency: 'RUB',
                              maximumFractionDigits: 0,
                            }).format(product.base_price)}
                          </span>
                        )}
                        <div className={styles.productStock}>
                          <span>Доступно: {product.available_stock_qty}</span>
                          <span>На складе: {product.stock_qty}</span>
                        </div>
                        {product.available_stock_qty <= 0 ? (
                          <span className={styles.helperText}>Нет доступного остатка</span>
                        ) : null}
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        max={Math.max(0, product.available_stock_qty ?? 0)}
                        className={styles.quantityInput}
                        value={orderForm.productQuantities[product.id] ?? 0}
                        disabled={product.available_stock_qty <= 0}
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          setOrderForm((prev) => ({
                            ...prev,
                            productQuantities: {
                              ...prev.productQuantities,
                              [product.id]:
                                rawValue === ''
                                  ? 0
                                  : sanitizeQuantity(product, Number(rawValue)),
                            },
                          }));
                        }}
                      />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {orderError && <p className={styles.errorText}>{orderError}</p>}

              <button className={styles.button} type="submit" disabled={isSubmittingOrder}>
                {isSubmittingOrder ? 'Отправляем…' : 'Создать заказ'}
              </button>
            </form>
          </section>

          {orderSuccess && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Заказ создан</h2>
              <div className={styles.orderSummary}>
                <p>
                  Номер заказа: <strong>#{orderSuccess.id}</strong>
                </p>
                <p>
                  Статус: <strong>{orderSuccess.status_label}</strong>
                </p>
                <p>Дата монтажа: {orderSuccess.installation_date}</p>
                <p>Дата демонтажа: {orderSuccess.dismantle_date}</p>
                <p>
                  Доставка:{' '}
                  {orderSuccess.delivery_type === 'delivery'
                    ? orderSuccess.delivery_address || 'адрес не указан'
                    : 'самовывоз'}
                </p>
                <p>Комментарий: {orderSuccess.comment ? orderSuccess.comment : '—'}</p>
                <div className={styles.summaryItems}>
                  <h3>Прайс-лист:</h3>
                  <ul>
                    {orderSuccess.items.map((item) => (
                      <li key={item.id}>
                        {item.product_label} — {item.quantity} шт.
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
