import { FormEvent, useState } from 'react';
import Head from 'next/head';

import styles from '../styles/Home.module.css';

type OrderFormState = {
  installDate: string;
  uninstallDate: string;
  deliveryOption: 'delivery' | 'pickup';
  address: string;
  products: string;
  comment: string;
};

type SubmittedOrder = OrderFormState & {
  status: 'Новый';
  userName: string | null;
};

const initialOrderForm: OrderFormState = {
  installDate: '',
  uninstallDate: '',
  deliveryOption: 'delivery',
  address: '',
  products: '',
  comment: '',
};

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderFormState>(initialOrderForm);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(
    null,
  );

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userName.trim()) {
      return;
    }
    setIsLoggedIn(true);
    setShowLoginForm(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserName('');
  };

  const handleOrderSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const orderToSubmit: SubmittedOrder = {
      ...orderForm,
      status: 'Новый',
      userName: isLoggedIn ? userName : null,
    };
    setSubmittedOrder(orderToSubmit);
    setOrderForm(initialOrderForm);
    setShowOrderForm(false);
  };

  return (
    <>
      <Head>
        <title>Kudos Клиентская часть</title>
        <meta name="description" content="Kudos клиентское приложение" />
      </Head>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Создание заказов</h1>
          <p className={styles.subtitle}>
            Создавайте заявки на аренду: заполните детали монтажа, доставки и
            нужных товаров.
          </p>

          <div className={styles.actions}>
            {isLoggedIn ? (
              <div className={styles.loggedIn}>
                <span>Вы вошли как {userName}</span>
                <button className={styles.button} onClick={handleLogout}>
                  Выйти
                </button>
              </div>
            ) : (
              <div className={styles.loginBlock}>
                {showLoginForm ? (
                  <form className={styles.inlineForm} onSubmit={handleLogin}>
                    <label className={styles.label}>
                      Имя или компания
                      <input
                        type="text"
                        value={userName}
                        onChange={(event) => setUserName(event.target.value)}
                        className={styles.input}
                        placeholder="Ваше имя"
                      />
                    </label>
                    <div className={styles.inlineActions}>
                      <button type="submit" className={styles.button}>
                        Подтвердить
                      </button>
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => {
                          setShowLoginForm(false);
                          setUserName('');
                        }}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className={styles.button}
                    onClick={() => setShowLoginForm(true)}
                  >
                    Войти
                  </button>
                )}
              </div>
            )}

            <button
              className={styles.button}
              onClick={() => setShowOrderForm(true)}
            >
              Создать заказ
            </button>
          </div>

          {showOrderForm && (
            <form className={styles.orderForm} onSubmit={handleOrderSubmit}>
              <label className={styles.label}>
                Дата монтажа
                <input
                  type="date"
                  value={orderForm.installDate}
                  onChange={(event) =>
                    setOrderForm((previous) => ({
                      ...previous,
                      installDate: event.target.value,
                    }))
                  }
                  className={styles.input}
                  required
                />
              </label>

              <label className={styles.label}>
                Дата демонтажа
                <input
                  type="date"
                  value={orderForm.uninstallDate}
                  onChange={(event) =>
                    setOrderForm((previous) => ({
                      ...previous,
                      uninstallDate: event.target.value,
                    }))
                  }
                  className={styles.input}
                  required
                />
              </label>

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Доставка</legend>
                <label className={styles.option}>
                  <input
                    type="radio"
                    name="deliveryOption"
                    value="delivery"
                    checked={orderForm.deliveryOption === 'delivery'}
                    onChange={() =>
                      setOrderForm((previous) => ({
                        ...previous,
                        deliveryOption: 'delivery',
                      }))
                    }
                  />
                  Доставка по адресу
                </label>
                <label className={styles.option}>
                  <input
                    type="radio"
                    name="deliveryOption"
                    value="pickup"
                    checked={orderForm.deliveryOption === 'pickup'}
                    onChange={() =>
                      setOrderForm((previous) => ({
                        ...previous,
                        deliveryOption: 'pickup',
                        address: '',
                      }))
                    }
                  />
                  Самовывоз
                </label>
              </fieldset>

              {orderForm.deliveryOption === 'delivery' && (
                <label className={styles.label}>
                  Адрес доставки
                  <input
                    type="text"
                    value={orderForm.address}
                    onChange={(event) =>
                      setOrderForm((previous) => ({
                        ...previous,
                        address: event.target.value,
                      }))
                    }
                    className={styles.input}
                    placeholder="Город, улица, дом"
                    required
                  />
                </label>
              )}

              <label className={styles.label}>
                Какие товары нужны
                <textarea
                  value={orderForm.products}
                  onChange={(event) =>
                    setOrderForm((previous) => ({
                      ...previous,
                      products: event.target.value,
                    }))
                  }
                  className={styles.textarea}
                  placeholder="Перечислите позиции"
                  required
                />
              </label>

              {!isLoggedIn && (
                <label className={styles.label}>
                  Напишите свои контактные данные, чтобы мы с вами связались
                  <textarea
                    value={orderForm.comment}
                    onChange={(event) =>
                      setOrderForm((previous) => ({
                        ...previous,
                        comment: event.target.value,
                      }))
                    }
                    className={styles.textarea}
                    placeholder="Телефон, имя или любая другая информация"
                    required
                  />
                </label>
              )}

              <button type="submit" className={styles.button}>
                Отправить заказ
              </button>
            </form>
          )}

          {submittedOrder && (
            <section className={styles.orderSummary}>
              <h2>Заказ создан</h2>
              <ul>
                <li>
                  Статус: <strong>{submittedOrder.status}</strong>
                </li>
                <li>Дата монтажа: {submittedOrder.installDate}</li>
                <li>Дата демонтажа: {submittedOrder.uninstallDate}</li>
                <li>
                  Доставка: {submittedOrder.deliveryOption === 'delivery'
                    ? `по адресу ${submittedOrder.address}`
                    : 'самовывоз'}
                </li>
                <li>Товары: {submittedOrder.products}</li>
                {submittedOrder.userName ? (
                  <li>Клиент: {submittedOrder.userName}</li>
                ) : (
                  <li>Комментарий: {submittedOrder.comment}</li>
                )}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
