import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Clearing database...");

  // Delete all records
  const deletedAnnouncements = await prisma.announcement.deleteMany();
  const deletedGallery = await prisma.galleryImage.deleteMany();

  console.log(`Deleted ${deletedAnnouncements.count} announcements.`);
  console.log(`Deleted ${deletedGallery.count} gallery images.`);
  console.log("✨ Database is now completely clean and ready for real data!");
}

main()
  .catch((e) => {
    console.error("Error clearing database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
