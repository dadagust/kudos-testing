export default function HomePage() {
  return (
    <main style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "4rem" }}>
      <h1 style={{ fontSize: "3rem", fontWeight: 700 }}>Kudos Storefront</h1>
      <p style={{ fontSize: "1.125rem", maxWidth: "42rem", lineHeight: 1.6 }}>
        Добро пожаловать в витрину магазина Kudos. Здесь появятся коллекции, каталоги и акции.
        Интерфейс использует Next.js 14 и TypeScript, а управление зависимостями выполняется через
        pnpm.
      </p>
    </main>
  );
}
