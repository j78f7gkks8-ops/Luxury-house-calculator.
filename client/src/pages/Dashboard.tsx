import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api";
import type { CatalogProject, ProjectSummary } from "../types";

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [catalog, setCatalog] = useState<CatalogProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [catalogTemplateId, setCatalogTemplateId] = useState("");

  useEffect(() => {
    api.get<ProjectSummary[]>("/projects").then(setProjects).catch((e) => setError(String(e)));
    api
      .get<{ projects: CatalogProject[] }>("/catalog/projects")
      .then((d) => {
        setCatalog(d.projects);
        if (d.projects[0]) setCatalogTemplateId(d.projects[0].id);
      })
      .catch(() => {});
  }, []);

  async function createProject() {
    setError(null);
    const template = catalog.find((c) => c.id === catalogTemplateId);
    if (!name.trim() || !template) {
      setError("Укажите название проекта и выберите планировку");
      return;
    }
    setCreating(true);
    try {
      const project = await api.post<ProjectSummary>("/projects", {
        name,
        customerName: customerName || undefined,
        catalogTemplateId: template.id,
        familyType: template.family,
      });
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось создать проект");
    } finally {
      setCreating(false);
    }
  }

  const canCreate = user?.role === "MANAGER" || user?.role === "OWNER";

  return (
    <div>
      {canCreate && (
        <div className="card">
          <h2>Новый проект</h2>
          <div className="grid-2">
            <div className="field">
              <label>Название проекта / объекта</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Дом для Ивановых" />
            </div>
            <div className="field">
              <label>Клиент (необязательно)</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ФИО клиента" />
            </div>
          </div>
          <div className="field">
            <label>Базовая планировка (из 13 стартовых, или загрузите новый PDF на странице проекта)</label>
            <select value={catalogTemplateId} onChange={(e) => setCatalogTemplateId(e.target.value)}>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.insideByExplicationM2} м² внутри, {c.family}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="error-banner">{error}</div>}
          <button onClick={createProject} disabled={creating}>
            {creating ? "Создание..." : "Создать проект"}
          </button>
        </div>
      )}

      <div className="card">
        <h2>Проекты</h2>
        {projects.length === 0 && <p className="muted">Проектов пока нет.</p>}
        {projects.map((p) => (
          <div className="project-list-item" key={p.id}>
            <div>
              <Link to={`/projects/${p.id}`}>
                <strong>{p.name}</strong>
              </Link>
              <div className="muted">
                {p.familyType} · {p.customer?.name ?? "без клиента"} · {new Date(p.createdAt).toLocaleDateString("ru-RU")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
