"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  SHOP: "Цех",
};

export function AppHeader() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  return (
    <header className="app-header">
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <strong>Luxury House</strong>
        <nav>
          {role === "OWNER" && (
            <>
              <Link href="/owner">Владелец</Link>
              <Link href="/manager">Менеджер</Link>
              <Link href="/shop">Цех</Link>
            </>
          )}
          {role === "MANAGER" && <Link href="/manager">Менеджер</Link>}
          {role === "SHOP" && <Link href="/shop">Цех</Link>}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--text-muted)" }}>
        <span>
          {session?.user?.name} · {role ? ROLE_LABELS[role] : ""}
        </span>
        <button onClick={() => signOut({ callbackUrl: "/login" })}>Выйти</button>
      </div>
    </header>
  );
}
