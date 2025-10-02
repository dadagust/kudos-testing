"use client";

import { RoleGuard } from "@/features/auth";
import { Role } from "@/shared/config/roles";
import { Button, Tag } from "@/shared/ui";

const integrations = [
  {
    id: "amocrm",
    name: "AmoCRM",
    status: "Подключено",
    description: "Синхронизация сделок и статусов.",
  },
  {
    id: "yookassa",
    name: "ЮKassa",
    status: "Подключено",
    description: "Онлайн-оплаты и возвраты залогов.",
  },
  {
    id: "yandex",
    name: "Яндекс Геокодер",
    status: "Черновик",
    description: "Построение маршрутов доставки.",
  },
];

export default function IntegrationsPage() {
  return (
    <RoleGuard allow={[Role.Administrator]}>
      <h1>Интеграции</h1>
      <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
        {integrations.map((item) => (
          <article
            key={item.id}
            style={{
              background: "var(--color-surface)",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <strong>{item.name}</strong>
              <span style={{ color: "var(--color-text-muted)" }}>{item.description}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Tag>{item.status}</Tag>
              <Button variant="ghost">Настроить</Button>
            </div>
          </article>
        ))}
      </div>
    </RoleGuard>
  );
}
