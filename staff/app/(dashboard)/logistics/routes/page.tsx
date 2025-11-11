'use client';

import { isAxiosError } from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AssignOrderDriverPayload,
  OrderDriverResponse,
  OrdersWithCoordsResponse,
  ordersApi,
} from '@/entities/order';
import { formatPhoneDisplay, formatPhoneInput, normalizePhoneNumber } from '@/shared/lib/phone';
import { Alert, Button, Icon, Input, Modal, Spinner, Tag } from '@/shared/ui';

import styles from './routes.module.sass';

const YANDEX_MAPS_KEY =
  process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY ?? process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? '';

type Coordinates = [number, number];

const toCoordinates = (lon: number, lat: number): Coordinates => [lon, lat];

interface YMapLocation {
  center: Coordinates;
  zoom: number;
}

interface YMapChild {
  destroy?: () => void;
}

interface YMapInstance {
  addChild(child: YMapChild): void;
  removeChild(child: YMapChild): void;
  destroy(): void;
  setLocation?(location: YMapLocation): void;
  setBounds?(
    bounds: [Coordinates, Coordinates],
    options?: { duration?: number; padding?: number | number[] }
  ): void;
  update?(payload: { location?: YMapLocation }): void;
}

interface YMapMarkerInstance extends YMapChild {}

interface YMapMarkerConstructor {
  new (options: { coordinates: Coordinates }, element: HTMLElement): YMapMarkerInstance;
}

interface YMaps3Global {
  ready: PromiseLike<unknown>;
  YMap: new (container: HTMLElement, options: { location: YMapLocation }) => YMapInstance;
  YMapDefaultSchemeLayer: new () => YMapChild;
  YMapDefaultFeaturesLayer: new () => YMapChild;
  YMapMarker: YMapMarkerConstructor;
}

declare global {
  interface Window {
    ymaps3?: YMaps3Global;
  }
}

let ymapsPromise: Promise<YMaps3Global> | null = null;

const loadYandexMaps = (): Promise<YMaps3Global> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Окружение без доступа к window.'));
  }
  if (window.ymaps3) {
    const ymaps = window.ymaps3;
    return Promise.resolve(ymaps.ready).then(
      () => ymaps,
      (error) => {
        window.ymaps3 = undefined;
        ymapsPromise = null;
        return Promise.reject(error);
      }
    );
  }
  if (!YANDEX_MAPS_KEY) {
    return Promise.reject(new Error('Переменная NEXT_PUBLIC_YANDEX_MAPS_KEY не задана.'));
  }
  if (!ymapsPromise) {
    ymapsPromise = new Promise<YMaps3Global>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/v3/?apikey=${YANDEX_MAPS_KEY}&lang=ru_RU`;
      script.async = true;
      script.onload = () => {
        const ymaps = window.ymaps3;
        if (!ymaps) {
          ymapsPromise = null;
          reject(new Error('API Яндекс Карт недоступно.'));
          return;
        }
        Promise.resolve(ymaps.ready).then(
          () => resolve(ymaps),
          (error) => {
            window.ymaps3 = undefined;
            ymapsPromise = null;
            reject(error);
          }
        );
      };
      script.onerror = () => {
        ymapsPromise = null;
        reject(new Error('Не удалось загрузить скрипт Яндекс Карт.'));
      };
      document.head.appendChild(script);
    });
  }
  return ymapsPromise;
};

interface MarkerRecord {
  marker: YMapMarkerInstance;
  element: HTMLElement;
  handleClick: () => void;
}

export default function LogisticsRoutesPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<{
    map: YMapInstance;
    YMapMarker: YMapMarkerConstructor;
  } | null>(null);
  const markersRef = useRef<Map<number, MarkerRecord>>(new Map());
  const [mapReadyToken, setMapReadyToken] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [driverModalOrderId, setDriverModalOrderId] = useState<number | null>(null);
  const [driverNameInput, setDriverNameInput] = useState('');
  const [driverPhoneInput, setDriverPhoneInput] = useState('');
  const [driverError, setDriverError] = useState<string | null>(null);
  const [driverInfoOrderId, setDriverInfoOrderId] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<OrdersWithCoordsResponse>({
      queryKey: ['orders-with-coords'],
      queryFn: () => ordersApi.listWithCoords(),
      staleTime: 60_000,
    });

  const orders = useMemo(() => data?.items ?? [], [data]);
  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );
  const driverModalOrder = useMemo(
    () => orders.find((item) => item.id === driverModalOrderId) ?? null,
    [orders, driverModalOrderId]
  );
  const driverInfoOrder = useMemo(
    () => orders.find((item) => item.id === driverInfoOrderId) ?? null,
    [orders, driverInfoOrderId]
  );

  useEffect(() => {
    if (orders.length === 0) {
      setSelectedOrderId(null);
      return;
    }
    if (!selectedOrderId || !orders.some((item) => item.id === selectedOrderId)) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  useEffect(() => {
    let cancelled = false;
    const markersMap = markersRef.current;

    loadYandexMaps()
      .then((ymaps3) => {
        if (cancelled || !mapRef.current) {
          return;
        }
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;
        const map = new YMap(mapRef.current, {
          location: {
            center: toCoordinates(37.6176, 55.7558),
            zoom: 9,
          },
        });
        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer());
        mapInstanceRef.current = { map, YMapMarker };
        setMapReadyToken((token) => token + 1);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          loadError instanceof Error ? loadError.message : 'Не удалось инициализировать карту.';
        setMapError(message);
      });

    return () => {
      cancelled = true;
      markersMap.forEach(({ marker, element, handleClick }) => {
        try {
          marker && mapInstanceRef.current?.map?.removeChild?.(marker);
        } catch (error_) {
          console.error('Не удалось удалить маркер', error_);
        }
        element.removeEventListener('click', handleClick);
      });
      markersMap.clear();
      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.destroy();
      }
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = mapInstanceRef.current;
    if (!instance) {
      return;
    }
    const { map, YMapMarker } = instance;

    markersRef.current.forEach(({ marker, element, handleClick }) => {
      try {
        map.removeChild(marker);
      } catch (error_) {
        console.error('Не удалось удалить маркер', error_);
      }
      element.removeEventListener('click', handleClick);
    });
    markersRef.current.clear();

    if (!orders.length) {
      return;
    }

    orders.forEach((order) => {
      const element = document.createElement('div');
      element.className = clsx(styles.marker, !order.exact && styles.markerApprox);
      element.innerHTML = `<span>${order.id}</span>`;
      const handleClick = () => setSelectedOrderId(order.id);
      element.addEventListener('click', handleClick);
      const marker = new YMapMarker({ coordinates: toCoordinates(order.lon, order.lat) }, element);
      map.addChild(marker);
      markersRef.current.set(order.id, { marker, element, handleClick });
    });

    if (orders.length === 1) {
      const [order] = orders;
      const location: YMapLocation = { center: toCoordinates(order.lon, order.lat), zoom: 12 };
      if (typeof map.setLocation === 'function') {
        map.setLocation(location);
      } else {
        map.update?.({ location });
      }
    } else {
      const lons = orders.map((item) => item.lon);
      const lats = orders.map((item) => item.lat);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      if (typeof map.setBounds === 'function') {
        map.setBounds([toCoordinates(minLon, minLat), toCoordinates(maxLon, maxLat)], {
          duration: 400,
          padding: 48,
        });
      } else {
        const location = {
          center: toCoordinates((minLon + maxLon) / 2, (minLat + maxLat) / 2),
          zoom: 10,
        };
        if (typeof map.setLocation === 'function') {
          map.setLocation(location);
        } else {
          map.update?.({ location });
        }
      }
    }
  }, [orders, mapReadyToken]);

  useEffect(() => {
    const instance = mapInstanceRef.current;
    if (!instance || !selectedOrder) {
      return;
    }
    const { map } = instance;
    const location: YMapLocation = {
      center: toCoordinates(selectedOrder.lon, selectedOrder.lat),
      zoom: 12,
    };
    if (typeof map.setLocation === 'function') {
      map.setLocation(location);
    } else {
      map.update?.({ location });
    }
  }, [selectedOrder]);

  const assignDriverMutation = useMutation<
    OrderDriverResponse,
    unknown,
    { orderId: number; payload: AssignOrderDriverPayload }
  >({
    mutationFn: ({ orderId, payload }) => ordersApi.assignDriver(orderId, payload),
    onSuccess: () => {
      setDriverModalOrderId(null);
      setDriverNameInput('');
      setDriverPhoneInput('');
      setDriverError(null);
      void refetch();
    },
    onError: (error: unknown) => {
      let message = 'Не удалось назначить водителя.';
      if (isAxiosError(error)) {
        const responseData = error.response?.data;
        if (typeof responseData === 'string') {
          message = responseData;
        } else if (responseData && typeof responseData === 'object') {
          const dataRecord = responseData as Record<string, unknown>;
          const detail = dataRecord.detail;
          if (typeof detail === 'string') {
            message = detail;
          } else {
            const extractFieldMessage = (field: string): string | null => {
              const value = dataRecord[field];
              if (Array.isArray(value) && value.length && typeof value[0] === 'string') {
                return value[0];
              }
              return null;
            };
            message =
              extractFieldMessage('phone') ??
              extractFieldMessage('full_name') ??
              extractFieldMessage('non_field_errors') ??
              message;
          }
        }
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      setDriverError(message);
    },
  });

  const handleOpenDriverModal = useCallback(
    (orderId: number) => {
      const order = orders.find((item) => item.id === orderId);
      setDriverModalOrderId(orderId);
      setDriverNameInput(order?.driver?.full_name ?? '');
      setDriverPhoneInput(formatPhoneInput(order?.driver?.phone ?? ''));
      setDriverError(null);
      assignDriverMutation.reset();
    },
    [orders, assignDriverMutation]
  );

  const handleCloseDriverModal = useCallback(() => {
    setDriverModalOrderId(null);
    setDriverNameInput('');
    setDriverPhoneInput('');
    setDriverError(null);
    assignDriverMutation.reset();
  }, [assignDriverMutation]);

  const handleDriverNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDriverNameInput(event.target.value);
  }, []);

  const handleDriverPhoneChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDriverPhoneInput(formatPhoneInput(event.target.value));
  }, []);

  const handleDriverSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!driverModalOrderId) {
        return;
      }
      const trimmedName = driverNameInput.trim();
      if (!trimmedName) {
        setDriverError('Укажите имя водителя.');
        return;
      }
      const normalizedPhone = normalizePhoneNumber(driverPhoneInput);
      if (!normalizedPhone) {
        setDriverError('Укажите корректный номер телефона.');
        return;
      }
      setDriverError(null);
      assignDriverMutation.mutate({
        orderId: driverModalOrderId,
        payload: {
          full_name: trimmedName,
          phone: normalizedPhone,
        },
      });
    },
    [assignDriverMutation, driverModalOrderId, driverNameInput, driverPhoneInput]
  );

  const handleOpenDriverInfo = useCallback((orderId: number) => {
    setDriverInfoOrderId(orderId);
  }, []);

  const handleCloseDriverInfo = useCallback(() => {
    setDriverInfoOrderId(null);
  }, []);

  const isDriverModalOpen = driverModalOrderId !== null;
  const isDriverInfoOpen = Boolean(driverInfoOrder?.driver);

  const renderOrdersList = () => {
    if (isLoading) {
      return (
        <div className={styles.loader}>
          <Spinner />
        </div>
      );
    }
    if (isError) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить заказы.';
      return (
        <Alert tone="danger" title="Ошибка загрузки">
          {message}
        </Alert>
      );
    }
    if (!orders.length) {
      return (
        <Alert tone="info" title="Нет заказов">
          Заказы с координатами не найдены.
        </Alert>
      );
    }
    return (
      <ul className={styles.list}>
        {orders.map((order) => {
          const isActive = order.id === selectedOrderId;
          const hasDriver = Boolean(order.driver);
          const buttonLabel = hasDriver ? 'Смена водителя' : 'Назначить водителя';
          return (
            <li key={order.id}>
              <div className={clsx(styles.listItem, isActive && styles.listItemActive)}>
                <button
                  type="button"
                  className={styles.listItemBody}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div className={styles.listItemContent}>
                    <span className={styles.listItemTitle}>Заказ №{order.id}</span>
                    <span className={styles.listItemAddress}>{order.address}</span>
                  </div>
                  <Tag
                    tone={order.exact ? 'success' : 'warning'}
                    className={styles.listItemTag}
                  >
                    {order.exact ? 'Точный адрес' : 'Требует уточнения'}
                  </Tag>
                </button>
                <div className={styles.listItemActions}>
                  <Button type="button" onClick={() => handleOpenDriverModal(order.id)}>
                    {buttonLabel}
                  </Button>
                  {hasDriver ? (
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => handleOpenDriverInfo(order.id)}
                      aria-label={`Информация о водителе заказа №${order.id}`}
                    >
                      <Icon name="info" size={18} />
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      <div className={styles.wrapper}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Маршруты доставок</h2>
            <Button type="button" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              Обновить
            </Button>
          </div>
          {mapError ? (
            <Alert tone="danger" title="Ошибка карты">
              {mapError}
            </Alert>
          ) : null}
          {renderOrdersList()}
        </aside>
        <div className={styles.mapContainer}>
          {mapError ? (
            <div className={styles.mapFallback}>
              <Alert tone="danger" title="Карта недоступна">
                {mapError}
              </Alert>
            </div>
          ) : (
            <div ref={mapRef} className={styles.map} />
          )}
        </div>
      </div>
      <Modal
        open={isDriverModalOpen}
        onClose={handleCloseDriverModal}
        title={
          driverModalOrder
            ? driverModalOrder.driver
              ? `Смена водителя заказа №${driverModalOrder.id}`
              : `Назначить водителя для заказа №${driverModalOrder.id}`
            : 'Назначить водителя'
        }
      >
        <form className={styles.driverForm} onSubmit={handleDriverSubmit}>
          <Input
            label="Имя водителя"
            value={driverNameInput}
            onChange={handleDriverNameChange}
            placeholder="Иван Иванов"
            required
          />
          <Input
            label="Телефон"
            value={driverPhoneInput}
            onChange={handleDriverPhoneChange}
            placeholder="+7 (___) ___-__-__"
            required
          />
          {driverError ? (
            <Alert tone="danger" title="Ошибка назначения">
              {driverError}
            </Alert>
          ) : null}
          <div className={styles.driverFormActions}>
            <Button type="button" variant="ghost" onClick={handleCloseDriverModal}>
              Отмена
            </Button>
            <Button type="submit" disabled={assignDriverMutation.isLoading}>
              {driverModalOrder?.driver ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={isDriverInfoOpen}
        onClose={handleCloseDriverInfo}
        title={
          driverInfoOrder
            ? `Водитель заказа №${driverInfoOrder.id}`
            : 'Информация о водителе'
        }
      >
        {driverInfoOrder?.driver ? (
          <div className={styles.driverInfo}>
            <div className={styles.driverInfoRow}>
              <span className={styles.driverInfoLabel}>Имя</span>
              <span className={styles.driverInfoValue}>{driverInfoOrder.driver.full_name}</span>
            </div>
            <div className={styles.driverInfoRow}>
              <span className={styles.driverInfoLabel}>Телефон</span>
              <span className={styles.driverInfoValue}>
                {formatPhoneDisplay(driverInfoOrder.driver.phone)}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
