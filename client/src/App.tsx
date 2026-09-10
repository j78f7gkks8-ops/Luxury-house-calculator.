import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { ProjectDetail } from "./pages/ProjectDetail";
import { UsersManagement } from "./pages/UsersManagement";

function TopBar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const roleLabel = { OWNER: "Владелец", MANAGER: "Менеджер", WORKSHOP: "Цех" }[user.role];
  return (
    <div className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Link to="/" className="brand" style={{ color: "inherit", textDecoration: "none" }}>
          Luxury House — калькулятор
        </Link>
        {user.role === "OWNER" && (
          <Link to="/users" className="muted" style={{ fontSize: 14 }}>
            Сотрудники
          </Link>
        )}
      </div>
      <div className="user-info">
        <span className="role-badge">{roleLabel}</span>
        <span>{user.name}</span>
        <button className="secondary" onClick={logout}>
          Выйти
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return (
    <div className="app-shell">
      <TopBar />
      <main className="content">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/users" element={<UsersManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </AuthProvider>
  );
}
