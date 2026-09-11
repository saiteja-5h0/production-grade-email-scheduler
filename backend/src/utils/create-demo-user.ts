import { prisma } from "../config/database.js";

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: "demo@reachinbox.local",
    },
    update: {},
    create: {
      id: "demo-user",
      name: "Demo User",
      email: "demo@reachinbox.local",
    },
  });

  console.log(user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());