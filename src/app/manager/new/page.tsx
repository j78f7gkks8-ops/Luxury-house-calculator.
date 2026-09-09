import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { NewProjectWizard } from "@/components/manager/NewProjectWizard";

export default async function NewProjectPage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "OWNER") redirect("/");

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <h1>Новый проект</h1>
        <NewProjectWizard />
      </main>
    </div>
  );
}
