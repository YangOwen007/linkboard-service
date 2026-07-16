import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed one realistic profile so the API is easy to demo after setup.
  const profile = await prisma.profile.upsert({
    where: { handle: "owenyang" },
    update: {},
    create: {
      handle: "owenyang",
      displayName: "Owen Yang",
      bio: "UC San Diego AI major building backend-focused internship projects.",
      links: {
        create: [
          {
            slug: "resume",
            title: "Resume",
            url: "https://example.com/resume",
            position: 1
          },
          {
            slug: "github",
            title: "GitHub",
            url: "https://github.com/example",
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
