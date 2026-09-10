import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api";

export function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("owner@demo.luxuryhouse.local");
  const [password, setPassword] = useState("owner-demo-pass");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    }
  }

  return (
    <div className="login-shell">
      <form className="card login-card" onSubmit={onSubmit}>
        <h2>Luxury House</h2>
        <p className="muted">Калькулятор модульных домов</p>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        {error && <div className="error-banner">{error}</div>}
        <button type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Вход..." : "Войти"}
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          Демо-аккаунты (сменить пароли перед реальным использованием):
          <br />
          owner@demo.luxuryhouse.local / owner-demo-pass
          <br />
          manager@demo.luxuryhouse.local / manager-demo-pass
          <br />
          workshop@demo.luxuryhouse.local / workshop-demo-pass
        </p>
      </form>
    </div>
  );
}
