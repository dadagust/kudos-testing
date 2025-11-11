import { useMutation } from '@tanstack/react-query';

import { ordersApi } from '../api/orders-api';
import { OrderWaybillContext } from '../model/types';

interface DownloadWaybillVariables {
  orderId: number;
  context: OrderWaybillContext;
  targetWindow?: Window | null;
}

const WAYBILL_URL_TTL_MS = 60_000;

export const useOrderWaybill = () =>
  useMutation<Blob, unknown, DownloadWaybillVariables>({
    mutationFn: ({ orderId, context }) => ordersApi.downloadWaybill(orderId, context),
    onSuccess: (blob, variables) => {
      const objectUrl = URL.createObjectURL(blob);

      const targetWindow = variables.targetWindow;
      if (targetWindow && !targetWindow.closed) {
        targetWindow.location.href = objectUrl;
      } else {
        window.open(objectUrl, '_blank', 'noopener');
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, WAYBILL_URL_TTL_MS);
    },
    onError: (_error, variables) => {
      const targetWindow = variables.targetWindow;
      if (targetWindow && !targetWindow.closed) {
        targetWindow.close();
      }
    },
  });
