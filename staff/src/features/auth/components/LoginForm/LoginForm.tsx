"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "@/features/auth";
import { Alert, Button, Input } from "@/shared/ui";

import styles from "./LoginForm.module.sass";

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const { login, status } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setError(null);
      await login(form);
      onSuccess?.();
    } catch (err) {
      setError("Не удалось выполнить вход. Проверьте логин и пароль.");
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h1 className={styles.title}>Вход в админ-панель</h1>
        <p className={styles.subtitle}>
          Используйте корпоративную учетную запись или тестовые данные.
        </p>
      </div>
      <div className={styles.fields}>
        <Input
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="manager@kudos.ru"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          required
        />
        <Input
          label="Пароль"
          type="password"
          name="password"
          placeholder="Введите пароль"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          required
        />
      </div>
      <div className={styles.actions}>
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Входим…" : "Войти"}
        </Button>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </form>
  );
};
