import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/AuthContext";

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  isDemo: boolean;
  createdAt: string;
}

function randomPassword(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

/** Раздел 3: "Владелец управляет... правами" — реальные персональные аккаунты вместо общих демо-логинов. */
export function UsersManagement() {
  const { user: me } = useAuth();
  if (me && me.role !== "OWNER") return <Navigate to="/" replace />;
  return <UsersManagementInner />;
}

function UsersManagementInner() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MANAGER");
  const [password, setPassword] = useState(randomPassword());
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function load() {
    setLoading(true);
    try {
      setUsers(await api.get<UserRecord[]>("/users"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось загрузить список");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser() {
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError("Заполните имя, email и пароль (не короче 8 символов)");
      return;
    }
    setCreating(true);
    try {
      await api.post("/users", { name, email, role, password });
      setLastCreated({ email, password });
      setName("");
      setEmail("");
      setPassword(randomPassword());
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось создать пользователя");
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    setError(null);
    try {
      await api.patch(`/users/${id}`, body);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить изменения");
    }
  }

  async function deactivate(u: UserRecord) {
    if (!confirm(`Деактивировать доступ для ${u.name} (${u.email})? История его действий сохранится.`)) return;
    setError(null);
    try {
      await api.del(`/users/${u.id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось деактивировать");
    }
  }

  async function submitReset(id: string) {
    if (resetPassword.length < 8) {
      setError("Новый пароль должен быть не короче 8 символов");
      return;
    }
    await patchUser(id, { password: resetPassword });
    setResetTarget(null);
    setResetPassword("");
  }

  return (
    <div>
      <div className="card">
        <h2>Новый сотрудник</h2>
        <div className="grid-3">
          <div className="field">
            <label>Имя</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Иванов" />
          </div>
          <div className="field">
            <label>Email (логин)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@luxuryhouse.local" />
          </div>
          <div className="field">
            <label>Роль</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="OWNER">Владелец</option>
              <option value="MANAGER">Менеджер</option>
              <option value="WORKSHOP">Цех</option>
            </select>
          </div>
        </div>
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Пароль (можно оставить сгенерированный)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="secondary" onClick={() => setPassword(randomPassword())}>
              Сгенерировать
            </button>
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {lastCreated && (
          <div className="gap-banner" style={{ background: "#eef2ee", color: "#2f5a41" }}>
            Создан: <strong>{lastCreated.email}</strong> / пароль <strong>{lastCreated.password}</strong> — сообщите сотруднику лично,
            здесь он больше не будет показан.
          </div>
        )}
        <button onClick={createUser} disabled={creating}>
          {creating ? "Создание..." : "Создать сотрудника"}
        </button>
      </div>

      <div className="card">
        <h2>Сотрудники</h2>
        {loading && <p className="muted">Загрузка...</p>}
        {!loading && (
          <table>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Создан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name} {u.id === me?.id && <span className="status-tag">это вы</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}>
                      <option value="OWNER">Владелец</option>
                      <option value="MANAGER">Менеджер</option>
                      <option value="WORKSHOP">Цех</option>
                    </select>
                  </td>
                  <td>
                    {u.isActive ? <span className="status-tag">активен</span> : <span className="status-tag warn">деактивирован</span>}
                    {u.isDemo && (
                      <span className="status-tag" style={{ marginLeft: 4 }}>
                        демо
                      </span>
                    )}
                  </td>
                  <td className="muted">{new Date(u.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {resetTarget === u.id ? (
                        <>
                          <input
                            style={{ width: 140 }}
                            placeholder="новый пароль"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                          />
                          <button className="secondary" onClick={() => submitReset(u.id)}>
                            Сохранить
                          </button>
                          <button className="secondary" onClick={() => setResetTarget(null)}>
                            Отмена
                          </button>
                        </>
                      ) : (
                        <button
                          className="secondary"
                          onClick={() => {
                            setResetTarget(u.id);
                            setResetPassword(randomPassword());
                          }}
                        >
                          Сбросить пароль
                        </button>
                      )}
                      {u.isActive ? (
                        <button className="secondary" onClick={() => deactivate(u)}>
                          Деактивировать
                        </button>
                      ) : (
                        <button className="secondary" onClick={() => patchUser(u.id, { isActive: true })}>
                          Восстановить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
