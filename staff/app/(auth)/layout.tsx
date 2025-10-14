import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Вход в систему — Kudos Admin',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at top, rgba(75,94,255,0.2), transparent 60%)',
        padding: '48px 16px',
      }}
    >
      {children}
    </div>
  );
}
