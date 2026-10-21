const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SUPER_ADMIN_NAME?.trim();
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!name || !email || !password || password.length < 12) {
    throw new Error("Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, and a 12-character SUPER_ADMIN_PASSWORD before seeding.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: { name, email, passwordHash, role: "SUPER_ADMIN" },
    update: { name, passwordHash, role: "SUPER_ADMIN", tenantId: null },
  });
}

main()
  .then(() => console.info("Super administrator provisioned."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());