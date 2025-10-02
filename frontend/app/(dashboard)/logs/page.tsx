"use client";

import { RoleGuard } from "@/features/auth";
import { Role } from "@/shared/config/roles";
import { Badge, Table } from "@/shared/ui";

const logs = [
  {
    id: 1,
    actor: "admin@kudos.ru",
    action: "Обновил тарифы доставки",
    createdAt: "12.10.2025 09:40",
    status: "success",
  },
  {
    id: 2,
    actor: "warehouse@kudos.ru",
    action: "Закрыл заказ ORD-1022",
    createdAt: "12.10.2025 08:15",
    status: "success",
  },
  {
    id: 3,
    actor: "manager@kudos.ru",
    action: "Ошибка синхронизации AmoCRM",
    createdAt: "11.10.2025 22:51",
    status: "danger",
  },
];

export default function LogsPage() {
  return (
    <RoleGuard allow={[Role.Manager, Role.Warehouse, Role.Accountant, Role.Administrator]}>
      <h1>Аудит и логи</h1>
      <Table
        columns={[
          { key: "createdAt", header: "Время" },
          { key: "actor", header: "Пользователь" },
          { key: "action", header: "Действие" },
          {
            key: "status",
            header: "Статус",
            render: (row: (typeof logs)[number]) => (
              <Badge tone={row.status === "success" ? "success" : "danger"}>{row.status}</Badge>
            ),
          },
        ]}
        data={logs}
      />
    </RoleGuard>
  );
}
