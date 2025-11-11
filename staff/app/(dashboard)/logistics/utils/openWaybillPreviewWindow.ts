export const openWaybillPreviewWindow = (orderId: number): Window | null => {
  const targetWindow = window.open('', '_blank');

  if (targetWindow) {
    targetWindow.document.open();
    targetWindow.document.write(`<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charSet="utf-8" />
    <title>Накладная заказа #${orderId}</title>
    <style>
      body {
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
        padding: 32px;
        background: #f3f4f6;
        color: #111827;
      }

      main {
        max-width: 640px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 16px;
        padding: 32px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
        line-height: 1.5;
      }

      h1 {
        font-size: 20px;
        margin: 0 0 12px;
      }

      p {
        margin: 0 0 8px;
        color: #4b5563;
      }

      p:last-of-type {
        margin-bottom: 0;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Генерация накладной…</h1>
      <p>Окно автоматически обновится после подготовки документа.</p>
      <p>Вы можете закрыть вкладку, если передумали печатать накладную.</p>
    </main>
  </body>
</html>`);
    targetWindow.document.close();
  }

  return targetWindow;
};
