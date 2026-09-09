import { AppRole } from "@/lib/domain/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      email: string;
      name: string;
    };
  }
  interface User {
    id: string;
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: AppRole;
    userId: string;
  }
}
