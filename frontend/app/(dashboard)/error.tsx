"use client";

import { useEffect } from "react";

import { Alert, Button } from "@/shared/ui";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard error boundary", error);
  }, [error]);

  return (
    <div style={{ padding: "48px" }}>
      <Alert title="Что-то пошло не так" tone="danger">
        Попробуйте обновить страницу или повторить действие позже.
      </Alert>
      <div style={{ marginTop: "24px" }}>
        <Button onClick={reset}>Обновить</Button>
      </div>
    </div>
  );
}
