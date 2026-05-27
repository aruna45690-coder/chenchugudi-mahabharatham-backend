-- CreateTable
CREATE TABLE IF NOT EXISTS "GalleryImage" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "titleTe" TEXT,
    "imageUrl" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'IMAGE',
    "videoUrl" TEXT,
    "publicId" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventName" TEXT,
    "eventNameTe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "titleTe" TEXT,
    "body" TEXT NOT NULL,
    "bodyTe" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserVisit" (
    "id" SERIAL NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" SERIAL NOT NULL,
    "isLike" BOOLEAN NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "liveStreamUrl" TEXT,
    "liveStreamPlatform" TEXT NOT NULL DEFAULT 'youtube',
    "isLiveActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FestivalYear" (
    "id" SERIAL NOT NULL,
    "year" TEXT NOT NULL,
    "pamphletUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FestivalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventSchedule" (
    "id" SERIAL NOT NULL,
    "yearId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "dayTe" TEXT NOT NULL,
    "dayEn" TEXT NOT NULL,
    "eventTe" TEXT NOT NULL,
    "eventEn" TEXT NOT NULL,
    "sponsorTe" TEXT,
    "sponsorEn" TEXT,
    "icon" TEXT,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "fee" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DailySponsor" (
    "id" SERIAL NOT NULL,
    "yearId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "dayTe" TEXT NOT NULL,
    "dayEn" TEXT NOT NULL,
    "nameTe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "locationTe" TEXT,
    "locationEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySponsor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserVisit_ipAddress_visitDate_key" ON "UserVisit"("ipAddress", "visitDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Feedback_ipAddress_key" ON "Feedback"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FestivalYear_year_key" ON "FestivalYear"("year");

-- AddForeignKey
ALTER TABLE "EventSchedule" ADD CONSTRAINT "EventSchedule_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "FestivalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySponsor" ADD CONSTRAINT "DailySponsor_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "FestivalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
