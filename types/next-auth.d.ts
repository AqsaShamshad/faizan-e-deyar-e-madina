import "next-auth";

declare module "next-auth" {
  interface User {
    role: "SUPER_ADMIN" | "MOSQUE_ADMIN" | "USER";
    tenantId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: "SUPER_ADMIN" | "MOSQUE_ADMIN" | "USER";
      tenantId: string | null;
    } & NonNullable<DefaultSession["user"]>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "SUPER_ADMIN" | "MOSQUE_ADMIN" | "USER";
    tenantId: string | null;
  }
}