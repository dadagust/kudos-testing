"use client";

import { useEffect, useState } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api",
  timeout: 15000
});

export default function Page() {
  const [ping, setPing] = useState("...");

  useEffect(() => {
    api.get("/ping/").then(r => setPing(r.data.status)).catch(() => setPing("error"));
  }, []);

  return (
    <main className="container py-5">
      <h1 className="mb-4">Frontend → Backend ping: {ping}</h1>
      <a className="btn btn-primary" href="http://localhost:8000/admin/" target="_blank">Admin</a>
    </main>
  );
}
