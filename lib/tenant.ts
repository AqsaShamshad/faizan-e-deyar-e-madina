import type { Prisma } from "@prisma/client";

export const notDeletedTenantWhere = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
} satisfies Prisma.TenantWhereInput;
