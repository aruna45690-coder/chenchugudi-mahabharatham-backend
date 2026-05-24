import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding clean database defaults...");

  // Clear existing data
  await prisma.announcement.deleteMany();
  await prisma.galleryImage.deleteMany();

  // Seed default Announcements (Real/Informational)
  await prisma.announcement.createMany({
    data: [
      {
        title: "Welcome to Chenchugudi Mahabharatham!",
        body: "The official platform for our annual festival is now live. Stay tuned for dates and schedules.",
        isActive: true,
      },
    ],
  });

  // Donations are kept 100% empty for real data
  // Gallery images are kept empty until real photos are uploaded

  console.log("✅ Clean default state seeded!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
