import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  const role = session.user.role;
  if (role === "OWNER") redirect("/owner");
  if (role === "MANAGER") redirect("/manager");
  redirect("/shop");
}
