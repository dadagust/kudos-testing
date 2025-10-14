'use client';

import { useState } from 'react';

import { RoleGuard } from '@/features/auth';
import { Button, Input, Select } from '@/shared/ui';

export default function SettingsPage() {
  const [timezone, setTimezone] = useState('Europe/Moscow');

  return (
    <RoleGuard section="settings" permission="change">
      <h1>Настройки платформы</h1>
      <section style={{ display: 'grid', gap: '24px', maxWidth: '520px', marginTop: '24px' }}>
        <Input label="Название компании" placeholder="Kudos" defaultValue="Kudos" />
        <Select
          label="Часовой пояс"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        >
          <option value="Europe/Moscow">Europe/Moscow</option>
          <option value="Asia/Yekaterinburg">Asia/Yekaterinburg</option>
        </Select>
        <Input
          label="Контактный email"
          placeholder="support@kudos.ru"
          defaultValue="support@kudos.ru"
        />
        <Button>Сохранить</Button>
      </section>
    </RoleGuard>
  );
}
