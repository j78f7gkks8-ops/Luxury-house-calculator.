import { prisma } from "../db.js";
import { hashPassword } from "../auth/hash.js";

/**
 * Раздел 3: "тестовые аккаунты и демонстрационные данные отдели от рабочих". Все посевные
 * пользователи помечены isDemo=true и используют легко узнаваемые тестовые пароли —
 * при боевом развёртывании их нужно сменить или удалить.
 */
async function main() {
  const users: { email: string; name: string; role: "OWNER" | "MANAGER" | "WORKSHOP"; password: string }[] = [
    { email: "owner@demo.luxuryhouse.local", name: "Владелец (демо)", role: "OWNER", password: "owner-demo-pass" },
    { email: "manager@demo.luxuryhouse.local", name: "Менеджер (демо)", role: "MANAGER", password: "manager-demo-pass" },
    { email: "workshop@demo.luxuryhouse.local", name: "Цех (демо)", role: "WORKSHOP", password: "workshop-demo-pass" },
  ];

  for (const u of users) {
    const passwordHash = await hashPassword(u.password);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, name: u.name, role: u.role, isDemo: true },
      create: { email: u.email, passwordHash, name: u.name, role: u.role, isDemo: true },
    });
    console.log(`Пользователь готов: ${u.email} / роль ${u.role}`);
  }

  console.log("\nДемонстрационные пароли (сменить перед реальным использованием):");
  for (const u of users) console.log(`  ${u.email} : ${u.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
