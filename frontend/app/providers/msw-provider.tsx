'use client';

import { PropsWithChildren, ReactElement, useEffect, useState } from 'react';

export function MSWProvider({ children }: PropsWithChildren): ReactElement | null {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (process.env.NODE_ENV === 'development') {
      import('../../mocks/browser')
        .then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass' }))
        .finally(() => {
          if (!cancelled) {
            setIsReady(true);
          }
        });
    } else {
      setIsReady(true);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}
