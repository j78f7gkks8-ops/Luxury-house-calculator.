"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Неверный email или пароль");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="login-shell">
      <div className="card form-narrow" style={{ width: "100%" }}>
        <h1>Luxury House</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>Вход в калькулятор модульных домов</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>
          {error && <p style={{ color: "var(--danger-text)" }}>{error}</p>}
          <button type="submit" className="primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}>
            Демо-доступы (для оценки продукта)
          </summary>
          <ul style={{ fontSize: 13, color: "var(--text-muted)" }}>
            <li>owner@luxuryhouse.demo / owner-demo-2026</li>
            <li>manager@luxuryhouse.demo / manager-demo-2026</li>
            <li>shop@luxuryhouse.demo / shop-demo-2026</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
