import { ReactNode } from 'react';

import styles from './routes.module.sass';

export default function LogisticsRoutesLayout({ children }: { children: ReactNode }) {
  return <div className={styles.routesViewport}>{children}</div>;
}
