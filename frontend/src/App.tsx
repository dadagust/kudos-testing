import type { FC, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  authApi,
  ordersApi,
  productsApi,
  type ProductSummary,
  type YandexSuggestItem,
  yandexApi,
} from '../lib/api';

import './App.css';

const today = new Date();
const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const App: FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [installationDate, setInstallationDate] = useState<string>(formatDate(today));
  const [dismantleDate, setDismantleDate] = useState<string>(formatDate(today));
  const [mountFrom, setMountFrom] = useState('');
  const [mountTo, setMountTo] = useState('');
  const [dismountFrom, setDismountFrom] = useState('');
  const [dismountTo, setDismountTo] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [comment, setComment] = useState('');

  const [addressSuggestions, setAddressSuggestions] = useState<YandexSuggestItem[]>([]);
  const [isLoadingSuggest, setIsLoadingSuggest] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);

  const trimmedDelivery = deliveryAddress.trim();

  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);

  const loadProducts = async (token: string | null) => {
    setIsLoadingProducts(true);
    setProductsError(null);
    try {
      const catalog = await productsApi.list(token);
      setProducts(catalog);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Не удалось загрузить список товаров';
      setProductsError(message);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    void loadProducts(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (deliveryType !== 'delivery') {
      setAddressSuggestions([]);
      setIsLoadingSuggest(false);
      setIsSuggestOpen(false);
      return;
    }

    const trimmed = deliveryAddress.trim();
    if (!accessToken || trimmed.length < 3) {
      setAddressSuggestions([]);
      setIsLoadingSuggest(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setIsLoadingSuggest(true);

    yandexApi
      .fetchAddressSuggestions(trimmed, { token: accessToken, signal: controller.signal })
      .then((results) => {
        if (!cancelled) {
          setAddressSuggestions(results);
        }
      })
      .catch((error: unknown) => {
        const name = (error as Error | null)?.name;
        if (name !== 'AbortError' && !cancelled) {
          setAddressSuggestions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSuggest(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accessToken, deliveryAddress, deliveryType]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setOrderMessage(null);
    setOrderError(null);

    try {
      const { access, user } = await authApi.login(email.trim(), password);
      setAccessToken(access);
      setUserName(user.full_name || user.email || '');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Не удалось выполнить вход';
      setAuthError(message);
      setAccessToken(null);
      setUserName('');
    }
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const quantity = Math.max(0, Number(value) || 0);
    setProductQuantities((prev) => ({ ...prev, [productId]: quantity }));
  };

  const selectedItems = useMemo(
    () =>
      Object.entries(productQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ product_id: productId, quantity })),
    [productQuantities],
  );

  const handleCreateOrder = async () => {
    setOrderError(null);
    setOrderMessage(null);
    setCreatedOrderId(null);

    if (!accessToken) {
      setOrderError('Сначала авторизуйтесь, чтобы оформить заказ.');
      return;
    }

    if (selectedItems.length === 0) {
      setOrderError('Выберите хотя бы один товар.');
      return;
    }

    if (deliveryType === 'delivery' && !deliveryAddress.trim()) {
      setOrderError('Укажите адрес доставки или выберите самовывоз.');
      return;
    }

    try {
      const payload = {
        installation_date: installationDate,
        dismantle_date: dismantleDate,
        mount_datetime_from: mountFrom || null,
        mount_datetime_to: mountTo || null,
        dismount_datetime_from: dismountFrom || null,
        dismount_datetime_to: dismountTo || null,
        delivery_type: deliveryType,
        delivery_address: deliveryType === 'delivery' ? deliveryAddress : '',
        comment: comment || null,
        items: selectedItems,
      } as const;

      const response = await ordersApi.create(payload, accessToken);
      setOrderMessage('Заказ успешно создан. Его увидят менеджеры в Staff.');
      setCreatedOrderId(response.data.id);
      setProductQuantities({});
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Не удалось создать заказ, попробуйте снова';
      setOrderError(message);
    }
  };

  const handleAddressChange = (value: string) => {
    setDeliveryAddress(value);
    setIsSuggestOpen(true);
  };

  const handleSuggestionSelect = (suggestion: YandexSuggestItem) => {
    setDeliveryAddress(suggestion.value);
    setIsSuggestOpen(false);
    setAddressSuggestions([]);
  };

  return (
    <main className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Kudos</p>
          <h1 className="title">Клиентский кабинет</h1>
          <p className="subtitle">
            Соберите заказ из каталога и отправьте его менеджерам. Статус всегда «Новый», а оплата
            выставляется после подтверждения.
          </p>
        </div>
        <form className="auth" onSubmit={handleLogin}>
          <h2 className="section-title">Вход</h2>
          <label className="field">
            <span>Почта</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="client@example.com"
              required
            />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="button">
            Войти
          </button>
          {authError ? <p className="status status--error">{authError}</p> : null}
          {userName ? <p className="status status--success">Вы вошли как {userName}</p> : null}
        </form>
      </header>

      <section className="card">
        <div className="card__header">
          <h2 className="section-title">Каталог</h2>
          {isLoadingProducts ? <span className="pill">Загрузка...</span> : null}
        </div>
        {productsError ? <p className="status status--error">{productsError}</p> : null}
        <div className="product-grid product-grid--scroll">
          {products.map((product) => (
            <article key={product.id} className="product">
              <div className="product__heading">
                <h3>{product.name}</h3>
                <p className="product__price">{product.base_price} ₽/день</p>
              </div>
              <p className="product__meta">
                В наличии: {product.available_stock_qty ?? product.stock_qty ?? 0}
              </p>
              <label className="field field--inline">
                <span>Количество</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={productQuantities[product.id] ?? ''}
                  onChange={(event) => handleQuantityChange(product.id, event.target.value)}
                />
              </label>
            </article>
          ))}
        </div>
        {products.length === 0 && !productsError ? (
          <p className="muted">Список товаров пуст. Попробуйте обновить страницу позже.</p>
        ) : null}
      </section>

      <section className="card">
        <h2 className="section-title">Параметры заказа</h2>
        <div className="grid grid--two-columns">
          <label className="field">
            <span>Дата монтажа</span>
            <input
              type="date"
              value={installationDate}
              onChange={(event) => setInstallationDate(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Дата демонтажа</span>
            <input
              type="date"
              value={dismantleDate}
              onChange={(event) => setDismantleDate(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Монтаж (с)</span>
            <input type="time" value={mountFrom} onChange={(event) => setMountFrom(event.target.value)} />
          </label>
          <label className="field">
            <span>Монтаж (до)</span>
            <input type="time" value={mountTo} onChange={(event) => setMountTo(event.target.value)} />
          </label>
          <label className="field">
            <span>Демонтаж (с)</span>
            <input
              type="time"
              value={dismountFrom}
              onChange={(event) => setDismountFrom(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Демонтаж (до)</span>
            <input
              type="time"
              value={dismountTo}
              onChange={(event) => setDismountTo(event.target.value)}
            />
          </label>
        </div>

        <div className="grid grid--two-columns">
          <label className="field">
            <span>Тип доставки</span>
            <select
              value={deliveryType}
              onChange={(event) => setDeliveryType(event.target.value as 'delivery' | 'pickup')}
            >
              <option value="delivery">Доставка</option>
              <option value="pickup">Самовывоз</option>
            </select>
          </label>
          <label className="field">
            <span>Адрес доставки</span>
            <div className="suggest">
              <input
                type="text"
                value={deliveryAddress}
                onFocus={() => setIsSuggestOpen(true)}
                onChange={(event) => handleAddressChange(event.target.value)}
                onBlur={() => setTimeout(() => setIsSuggestOpen(false), 120)}
                placeholder="г. Москва, улица..."
                disabled={deliveryType === 'pickup'}
                required={deliveryType === 'delivery'}
                autoComplete="off"
              />
              {deliveryType === 'delivery' && isSuggestOpen ? (
                <ul className="suggest__dropdown">
                  {isLoadingSuggest ? (
                    <li className="suggest__placeholder">Загрузка подсказок...</li>
                  ) : null}
                  {!isLoadingSuggest && addressSuggestions.length > 0
                    ? addressSuggestions.map((suggestion) => (
                        <li key={`${suggestion.value}-${suggestion.uri ?? 'local'}`}>
                          <button
                            type="button"
                            className="suggest__item"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSuggestionSelect(suggestion)}
                          >
                            <span className="suggest__title">{suggestion.title}</span>
                            {suggestion.subtitle ? (
                              <span className="suggest__subtitle">{suggestion.subtitle}</span>
                            ) : null}
                          </button>
                        </li>
                      ))
                    : null}
                  {!isLoadingSuggest && addressSuggestions.length === 0 && trimmedDelivery.length >= 3 ? (
                    <li className="suggest__placeholder">Ничего не найдено</li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          </label>
        </div>

        <label className="field">
          <span>Комментарий</span>
          <textarea
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Например, пожелания по доставке"
          />
        </label>

        <div className="actions">
          <button className="button button--primary" type="button" onClick={handleCreateOrder}>
            Создать заказ
          </button>
          <p className="muted">
            Мы отправим заказ менеджерам. Он появится в Staff со статусом «Новый» и оплатой «Не
            оплачен».
          </p>
        </div>
        {orderMessage ? <p className="status status--success">{orderMessage}</p> : null}
        {orderError ? <p className="status status--error">{orderError}</p> : null}
        {createdOrderId ? (
          <p className="status status--info">Номер заказа: {createdOrderId}</p>
        ) : null}
      </section>
    </main>
  );
};

export default App;
