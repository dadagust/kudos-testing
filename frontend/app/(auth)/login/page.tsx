"use client";

import { useRouter } from "next/navigation";

import { LoginForm } from "@/features/auth";

export default function LoginPage() {
  const router = useRouter();

  return (
    <LoginForm
      onSuccess={() => {
        router.replace("/dashboard");
      }}
    />
  );
}
