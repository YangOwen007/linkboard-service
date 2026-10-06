import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Explicit demo fixture; never automatically insert sample data on deployment.
  const profile = await prisma.profile.upsert({
    where: { handle: "owenyang" },
    update: {},
    create: {
      handle: "owenyang",
      displayName: "Owen Yang",
      bio: "Demo profile for local API evaluation.",
      links: {
        create: [
          {
            slug: "docs",
            title: "Service source and documentation",
            url: "https://github.com/YangOwen007/linkboard-service",
            position: 1
          },
          {
            slug: "github",
            title: "GitHub",
            url: "https://github.com/YangOwen007",
            position: 2
          }
        ]
      }
    }
  });

  console.log(`Seeded profile ${profile.handle}`);
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
