import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { ProjectDetail } from "./pages/ProjectDetail";

function TopBar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const roleLabel = { OWNER: "Владелец", MANAGER: "Менеджер", WORKSHOP: "Цех" }[user.role];
  return (
    <div className="topbar">
      <div className="brand">Luxury House — калькулятор</div>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </AuthProvider>
  );
}
