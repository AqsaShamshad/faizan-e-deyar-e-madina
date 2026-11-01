import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notDeletedTenantWhere } from "@/lib/tenant";
import { MosqueAccounts } from "./mosque-accounts";

export const instant = false;

export default async function AdminPage() {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return null;

  const tenants = await prisma.tenant.findMany({
    where: notDeletedTenantWhere,
    orderBy: { createdAt: "desc" },
    include: { admins: { where: { role: "MOSQUE_ADMIN" }, take: 1, select: { name: true, email: true } } },
  });

  return (
    <MosqueAccounts
      initialTenants={tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        address: tenant.address ?? "",
        contactNumber: tenant.contactNumber ?? "",
        status: tenant.status,
        adminName: tenant.admins[0]?.name ?? "Account unavailable",
        email: tenant.admins[0]?.email ?? "",
        createdAt: tenant.createdAt.toISOString(),
      }))}
    />
  );
}