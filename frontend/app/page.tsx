export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "1.5rem",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", margin: 0 }}>Kudos Storefront</h1>
      <p style={{ maxWidth: 520, textAlign: "center", lineHeight: 1.6 }}>
        Добро пожаловать в витрину Kudos. Здесь появится пользовательский интерфейс для покупки и
        обмена поощрений. Используйте этот проект как основу для разработки клиентской части.
      </p>
    </main>
  );
}
