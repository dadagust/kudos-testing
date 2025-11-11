'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { OrdersWithCoordsResponse, ordersApi } from '@/entities/order';
import { Alert, Button, Spinner, Tag } from '@/shared/ui';

import styles from './routes.module.sass';

const YANDEX_MAPS_KEY =
  process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY ?? process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? '';

declare global {
  interface Window {
    ymaps3?: any;
  }
}

let ymapsPromise: Promise<any> | null = null;

const loadYandexMaps = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Окружение без доступа к window.'));
  }
  if (window.ymaps3) {
    return window.ymaps3.ready.then(() => window.ymaps3);
  }
  if (!YANDEX_MAPS_KEY) {
    return Promise.reject(new Error('Переменная NEXT_PUBLIC_YANDEX_MAPS_KEY не задана.'));
  }
  if (!ymapsPromise) {
    ymapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/v3/?apikey=${YANDEX_MAPS_KEY}&lang=ru_RU`;
      script.async = true;
      script.onload = () => {
        if (!window.ymaps3) {
          reject(new Error('API Яндекс Карт недоступно.'));
          return;
        }
        window.ymaps3.ready.then(() => resolve(window.ymaps3)).catch(reject);
      };
      script.onerror = () => reject(new Error('Не удалось загрузить скрипт Яндекс Карт.'));
      document.head.appendChild(script);
    });
  }
  return ymapsPromise;
};

interface MarkerRecord {
  marker: any;
  element: HTMLElement;
  handleClick: () => void;
}

export default function LogisticsRoutesPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<{ map: any; YMapMarker: any } | null>(null);
  const markersRef = useRef<Map<number, MarkerRecord>>(new Map());
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<OrdersWithCoordsResponse>({
      queryKey: ['orders-with-coords'],
      queryFn: () => ordersApi.listWithCoords(),
      staleTime: 60_000,
    });

  const orders = data?.items ?? [];
  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
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

    loadYandexMaps()
      .then((ymaps3) => {
        if (cancelled || !mapRef.current) {
          return;
        }
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;
        const map = new YMap(mapRef.current, {
          location: {
            center: [37.6176, 55.7558],
            zoom: 9,
          },
        });
        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer());
        mapInstanceRef.current = { map, YMapMarker };
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
      markersRef.current.forEach(({ marker, element, handleClick }) => {
        try {
          marker && mapInstanceRef.current?.map?.removeChild?.(marker);
        } catch (error_) {
          console.error('Не удалось удалить маркер', error_);
        }
        element.removeEventListener('click', handleClick);
      });
      markersRef.current.clear();
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
      const marker = new YMapMarker({ coordinates: [order.lon, order.lat] }, element);
      map.addChild(marker);
      markersRef.current.set(order.id, { marker, element, handleClick });
    });

    if (orders.length === 1) {
      const [order] = orders;
      const location = { center: [order.lon, order.lat], zoom: 12 };
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
        map.setBounds(
          [
            [minLon, minLat],
            [maxLon, maxLat],
          ],
          { duration: 400, padding: 48 }
        );
      } else {
        const location = {
          center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
          zoom: 10,
        };
        if (typeof map.setLocation === 'function') {
          map.setLocation(location);
        } else {
          map.update?.({ location });
        }
      }
    }
  }, [orders]);

  useEffect(() => {
    const instance = mapInstanceRef.current;
    if (!instance || !selectedOrder) {
      return;
    }
    const { map } = instance;
    const location = {
      center: [selectedOrder.lon, selectedOrder.lat],
      zoom: 12,
    };
    if (typeof map.setLocation === 'function') {
      map.setLocation(location);
    } else {
      map.update?.({ location });
    }
  }, [selectedOrder]);

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
          return (
            <li key={order.id}>
              <button
                type="button"
                className={clsx(styles.listItem, isActive && styles.listItemActive)}
                onClick={() => setSelectedOrderId(order.id)}
              >
                <div className={styles.listItemContent}>
                  <span className={styles.listItemTitle}>Заказ №{order.id}</span>
                  <span className={styles.listItemAddress}>{order.address}</span>
                </div>
                <Tag tone={order.exact ? 'success' : 'warning'}>
                  {order.exact ? 'Точный адрес' : 'Требует уточнения'}
                </Tag>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
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
  );
}
