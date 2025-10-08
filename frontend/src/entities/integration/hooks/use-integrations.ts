import { useQuery } from '@tanstack/react-query';

import { integrationsApi } from '../api/integrations-api';

export const useIntegrationsQuery = () =>
  useQuery({
    queryKey: ['integrations'],
    queryFn: integrationsApi.list,
    staleTime: 5 * 60 * 1000,
  });
