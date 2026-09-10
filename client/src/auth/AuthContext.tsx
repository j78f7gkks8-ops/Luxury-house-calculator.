import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { api, getToken, setToken } from "../api";

export type Role = "OWNER" | "MANAGER" | "WORKSHOP";

export interface AuthUser {
  id?: string;
  sub?: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * JWT использует base64url (символы "-"/"_", без паддинга "="), а не обычный base64 —
 * "голый" atob() на таких строках либо бросает исключение, либо тихо портит данные.
 * Без этой нормализации любое обновление страницы (F5, прямой переход по ссылке) сбрасывало
 * пользователя на экран входа, хотя токен в localStorage был валиден.
 */
function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  // atob() decodes to a byte-per-char binary string (Latin1) — Cyrillic имена в payload
  // это многобайтовый UTF-8, поэтому после atob нужен ещё один проход через TextDecoder,
  // иначе "Владелец" превращается в нечитаемые символы после каждого обновления страницы.
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function decodeUserFromToken(): AuthUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1]));
    return { id: payload.sub, sub: payload.sub, name: payload.name, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => decodeUserFromToken());
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await api.post<{ token: string; user: AuthUser }>("/auth/login", { email, password });
      setToken(result.token);
      setUser({ ...result.user, sub: result.user.id, id: result.user.id });
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return ctx;
}
