'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import clsx from 'clsx';
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AssignOrderDriverPayload,
  OrderDriverResponse,
  OrdersWithCoordsResponse,
  ordersApi,
} from '@/entities/order';
import { formatPhoneDisplay, formatPhoneInput, normalizePhoneNumber } from '@/shared/lib/phone';
import { Alert, Button, Icon, Input, Modal, Select, Spinner, Tag } from '@/shared/ui';

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

const UNASSIGNED_DRIVER_KEY = 'unassigned';
const CUSTOM_DRIVER_OPTION = 'custom';

const buildDriverKey = (fullName?: string | null, phone?: string | null): string => {
  const normalizedName = (fullName ?? '').trim().toLowerCase();
  const normalizedPhone = normalizePhoneNumber(phone ?? '') ?? '';
  return `${normalizedName}|${normalizedPhone}`;
};

const extractDriverErrorMessage = (error: unknown, fallback: string): string => {
  const message = fallback;
  if (isAxiosError(error)) {
    const responseData = error.response?.data;
    if (typeof responseData === 'string') {
      return responseData;
    }
    if (responseData && typeof responseData === 'object') {
      const dataRecord = responseData as Record<string, unknown>;
      const detail = dataRecord.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      const extractFieldMessage = (field: string): string | null => {
        const value = dataRecord[field];
        if (Array.isArray(value) && value.length && typeof value[0] === 'string') {
          return value[0];
        }
        return null;
      };
      return (
        extractFieldMessage('phone') ??
        extractFieldMessage('full_name') ??
        extractFieldMessage('non_field_errors') ??
        message
      );
    }
  } else if (error instanceof Error && error.message) {
    return error.message;
  }
  return message;
};

type OrderWithCoordsItem = OrdersWithCoordsResponse['items'][number];

interface DriverInfo {
  fullName: string;
  phone: string;
}

interface DriverGroup {
  key: string;
  driver: DriverInfo | null;
  orders: OrderWithCoordsItem[];
}

interface DriverOption extends DriverInfo {
  key: string;
  label: string;
}

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
  const [driverActionError, setDriverActionError] = useState<string | null>(null);
  const [selectedDriverOption, setSelectedDriverOption] = useState<string>(CUSTOM_DRIVER_OPTION);
  const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null);
  const [dragSourceKey, setDragSourceKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<OrdersWithCoordsResponse>({
      queryKey: ['orders-with-coords'],
      queryFn: () => ordersApi.listWithCoords(),
      staleTime: 60_000,
    });

  const orders = useMemo(() => data?.items ?? [], [data]);

  const {
    groups: driverGroups,
    orderToGroup,
    driverOptions,
  } = useMemo(() => {
    const groupsMap = new Map<string, DriverGroup>();
    groupsMap.set(UNASSIGNED_DRIVER_KEY, {
      key: UNASSIGNED_DRIVER_KEY,
      driver: null,
      orders: [],
    });
    const orderGroupMap = new Map<number, string>();

    orders.forEach((order) => {
      const driver = order.driver;
      const groupKey = driver
        ? buildDriverKey(driver.full_name, driver.phone)
        : UNASSIGNED_DRIVER_KEY;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          driver: driver
            ? {
                fullName: driver.full_name,
                phone: driver.phone,
              }
            : null,
          orders: [],
        });
      }
      const group = groupsMap.get(groupKey)!;
      if (driver && !group.driver) {
        group.driver = { fullName: driver.full_name, phone: driver.phone };
      }
      group.orders.push(order);
      orderGroupMap.set(order.id, groupKey);
    });

    const groups = Array.from(groupsMap.values());
    groups.sort((a, b) => {
      if (a.key === UNASSIGNED_DRIVER_KEY) {
        return b.key === UNASSIGNED_DRIVER_KEY ? 0 : -1;
      }
      if (b.key === UNASSIGNED_DRIVER_KEY) {
        return 1;
      }
      const nameA = a.driver?.fullName.toLowerCase() ?? '';
      const nameB = b.driver?.fullName.toLowerCase() ?? '';
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB, 'ru');
      }
      const phoneA = a.driver ? (normalizePhoneNumber(a.driver.phone) ?? a.driver.phone) : '';
      const phoneB = b.driver ? (normalizePhoneNumber(b.driver.phone) ?? b.driver.phone) : '';
      return phoneA.localeCompare(phoneB, 'ru');
    });

    const uniqueDrivers = new Map<string, DriverOption>();
    groups.forEach((group) => {
      if (group.driver && group.key !== UNASSIGNED_DRIVER_KEY) {
        const formattedPhone = formatPhoneDisplay(group.driver.phone);
        uniqueDrivers.set(group.key, {
          key: group.key,
          fullName: group.driver.fullName,
          phone: group.driver.phone,
          label: formattedPhone
            ? `${group.driver.fullName} (${formattedPhone})`
            : group.driver.fullName,
        });
      }
    });

    return {
      groups,
      orderToGroup: orderGroupMap,
      driverOptions: Array.from(uniqueDrivers.values()),
    };
  }, [orders]);
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
      setSelectedDriverOption(CUSTOM_DRIVER_OPTION);
      setDriverActionError(null);
      void refetch();
    },
    onError: (error: unknown) => {
      const message = extractDriverErrorMessage(error, 'Не удалось назначить водителя.');
      setDriverError(message);
    },
  });

  const changeDriverMutation = useMutation<
    OrderDriverResponse,
    unknown,
    { orderId: number; payload: AssignOrderDriverPayload }
  >({
    mutationFn: ({ orderId, payload }) => ordersApi.assignDriver(orderId, payload),
    onMutate: ({ orderId }) => {
      setPendingOrderId(orderId);
      setDriverActionError(null);
    },
    onSuccess: () => {
      void refetch();
    },
    onError: (error: unknown) => {
      const message = extractDriverErrorMessage(error, 'Не удалось изменить водителя.');
      setDriverActionError(message);
    },
    onSettled: () => {
      setPendingOrderId(null);
    },
  });

  const removeDriverMutation = useMutation<void, unknown, number>({
    mutationFn: (orderId: number) => ordersApi.removeDriver(orderId),
    onMutate: (orderId: number) => {
      setPendingOrderId(orderId);
      setDriverActionError(null);
    },
    onSuccess: () => {
      void refetch();
    },
    onError: (error: unknown) => {
      const message = extractDriverErrorMessage(error, 'Не удалось удалить водителя.');
      setDriverActionError(message);
    },
    onSettled: () => {
      setPendingOrderId(null);
    },
  });

  const handleOpenDriverModal = useCallback(
    (orderId: number) => {
      const order = orders.find((item) => item.id === orderId);
      setDriverModalOrderId(orderId);
      const driver = order?.driver ?? null;
      const driverKey = driver
        ? buildDriverKey(driver.full_name, driver.phone)
        : CUSTOM_DRIVER_OPTION;
      const hasPresetOption =
        driverKey !== CUSTOM_DRIVER_OPTION &&
        driverOptions.some((option) => option.key === driverKey);
      setSelectedDriverOption(hasPresetOption ? driverKey : CUSTOM_DRIVER_OPTION);
      setDriverNameInput(driver?.full_name ?? '');
      setDriverPhoneInput(driver?.phone ? formatPhoneInput(driver.phone) : '');
      setDriverError(null);
      setDriverActionError(null);
      assignDriverMutation.reset();
    },
    [orders, driverOptions, assignDriverMutation]
  );

  const handleCloseDriverModal = useCallback(() => {
    setDriverModalOrderId(null);
    setDriverNameInput('');
    setDriverPhoneInput('');
    setDriverError(null);
    setSelectedDriverOption(CUSTOM_DRIVER_OPTION);
    assignDriverMutation.reset();
  }, [assignDriverMutation]);

  const handleDriverNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDriverNameInput(event.target.value);
    setSelectedDriverOption(CUSTOM_DRIVER_OPTION);
  }, []);

  const handleDriverPhoneChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDriverPhoneInput(formatPhoneInput(event.target.value));
    setSelectedDriverOption(CUSTOM_DRIVER_OPTION);
  }, []);

  const handleDriverOptionChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      if (value === CUSTOM_DRIVER_OPTION) {
        setSelectedDriverOption(CUSTOM_DRIVER_OPTION);
        return;
      }
      const option = driverOptions.find((item) => item.key === value);
      if (!option) {
        setSelectedDriverOption(CUSTOM_DRIVER_OPTION);
        return;
      }
      setSelectedDriverOption(option.key);
      setDriverNameInput(option.fullName);
      setDriverPhoneInput(option.phone ? formatPhoneInput(option.phone) : '');
    },
    [driverOptions]
  );

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
      setDriverActionError(null);
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

  const resetDragState = useCallback(() => {
    setDraggedOrderId(null);
    setDragSourceKey(null);
    setDropTargetKey(null);
  }, []);

  const handleOrderDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, orderId: number) => {
      const sourceKey = orderToGroup.get(orderId) ?? UNASSIGNED_DRIVER_KEY;
      setDraggedOrderId(orderId);
      setDragSourceKey(sourceKey);
      setDropTargetKey(null);
      setDriverActionError(null);
      if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', String(orderId));
        event.dataTransfer.effectAllowed = 'move';
      }
    },
    [orderToGroup]
  );

  const handleOrderDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  const handleGroupDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, groupKey: string) => {
      if (draggedOrderId === null) {
        return;
      }
      event.preventDefault();
      if (dropTargetKey !== groupKey) {
        setDropTargetKey(groupKey);
      }
    },
    [draggedOrderId, dropTargetKey]
  );

  const handleGroupDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>, groupKey: string) => {
      if (draggedOrderId === null) {
        return;
      }
      if (event.currentTarget.contains(event.relatedTarget as Node)) {
        return;
      }
      if (dropTargetKey === groupKey) {
        setDropTargetKey(null);
      }
    },
    [draggedOrderId, dropTargetKey]
  );

  const handleGroupDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, targetKey: string) => {
      event.preventDefault();
      if (draggedOrderId === null) {
        resetDragState();
        return;
      }
      const orderId = draggedOrderId;
      if (dragSourceKey === targetKey) {
        resetDragState();
        return;
      }
      if (targetKey === UNASSIGNED_DRIVER_KEY) {
        resetDragState();
        removeDriverMutation.mutate(orderId, {
          onSettled: () => {
            resetDragState();
          },
        });
        return;
      }
      const targetGroup = driverGroups.find((group) => group.key === targetKey);
      if (!targetGroup?.driver) {
        resetDragState();
        return;
      }
      const normalizedPhone =
        normalizePhoneNumber(targetGroup.driver.phone) ?? targetGroup.driver.phone;
      resetDragState();
      changeDriverMutation.mutate(
        {
          orderId,
          payload: {
            full_name: targetGroup.driver.fullName,
            phone: normalizedPhone,
          },
        },
        {
          onSettled: () => {
            resetDragState();
          },
        }
      );
    },
    [
      changeDriverMutation,
      dragSourceKey,
      draggedOrderId,
      driverGroups,
      removeDriverMutation,
      resetDragState,
    ]
  );

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
    const isDriverMutationInFlight =
      changeDriverMutation.isPending || removeDriverMutation.isPending;

    return (
      <div className={styles.groups}>
        {driverActionError ? (
          <Alert tone="danger" title="Ошибка обновления водителя">
            {driverActionError}
          </Alert>
        ) : null}
        {driverGroups.map((group) => {
          const isDropTarget = dropTargetKey === group.key && draggedOrderId !== null;
          const groupTitle = group.driver ? group.driver.fullName : 'Не распределены';
          const groupSubtitle = group.driver?.phone ? formatPhoneDisplay(group.driver.phone) : null;
          return (
            <section
              key={group.key}
              className={clsx(
                styles.group,
                group.key === UNASSIGNED_DRIVER_KEY && styles.groupUnassigned,
                isDropTarget && styles.groupDropTarget
              )}
              onDragOver={(event) => handleGroupDragOver(event, group.key)}
              onDragLeave={(event) => handleGroupDragLeave(event, group.key)}
              onDrop={(event) => handleGroupDrop(event, group.key)}
            >
              <div className={styles.groupHeader}>
                <div className={styles.groupHeaderInfo}>
                  <span className={styles.groupTitle}>{groupTitle}</span>
                  {groupSubtitle ? (
                    <span className={styles.groupSubtitle}>{groupSubtitle}</span>
                  ) : null}
                </div>
                <span className={styles.groupCounter}>{group.orders.length}</span>
              </div>
              <div className={styles.groupBody}>
                {group.orders.length ? (
                  <ul className={styles.list}>
                    {group.orders.map((order) => {
                      const isActive = order.id === selectedOrderId;
                      const hasDriver = Boolean(order.driver);
                      const isPending =
                        pendingOrderId === order.id &&
                        (changeDriverMutation.isPending || removeDriverMutation.isPending);
                      return (
                        <li key={order.id}>
                          <div
                            className={clsx(
                              styles.listItem,
                              isActive && styles.listItemActive,
                              styles.listItemDraggable,
                              isPending && styles.listItemProcessing
                            )}
                            draggable={!isDriverMutationInFlight && !isPending}
                            onDragStart={(event) => handleOrderDragStart(event, order.id)}
                            onDragEnd={handleOrderDragEnd}
                          >
                            <button
                              type="button"
                              className={styles.listItemBody}
                              onClick={() => setSelectedOrderId(order.id)}
                              disabled={isPending}
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
                              {hasDriver ? (
                                <Button
                                  type="button"
                                  variant="danger"
                                  onClick={() => removeDriverMutation.mutate(order.id)}
                                  disabled={isDriverMutationInFlight || isPending}
                                >
                                  {isPending && removeDriverMutation.isPending
                                    ? 'Удаление...'
                                    : 'Удалить водителя'}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  onClick={() => handleOpenDriverModal(order.id)}
                                  disabled={assignDriverMutation.isPending}
                                >
                                  Назначить водителя
                                </Button>
                              )}
                              {hasDriver ? (
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={() => handleOpenDriverInfo(order.id)}
                                  aria-label={`Информация о водителе заказа №${order.id}`}
                                  disabled={isPending}
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
                ) : (
                  <div className={styles.groupEmpty}>Нет заказов</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className={styles.wrapper}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Маршруты доставок</h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDriverActionError(null);
                void refetch();
              }}
              disabled={isFetching}
            >
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
          {driverOptions.length ? (
            <Select
              label="Выберите водителя"
              value={selectedDriverOption}
              onChange={handleDriverOptionChange}
            >
              <option value={CUSTOM_DRIVER_OPTION}>Новый водитель</option>
              {driverOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : null}
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
            <Button type="submit" disabled={assignDriverMutation.isPending}>
              {assignDriverMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={isDriverInfoOpen}
        onClose={handleCloseDriverInfo}
        title={driverInfoOrder ? `Водитель заказа №${driverInfoOrder.id}` : 'Информация о водителе'}
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
