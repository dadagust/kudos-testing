import { mockClient } from '@/shared/api/httpClient';

import { IntegrationsResponse } from '../model/types';

export const integrationsApi = {
  list: async (): Promise<IntegrationsResponse> => {
    const { data } = await mockClient.get<IntegrationsResponse>('/integrations');
    return data;
  },
};
