import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import webpush from 'web-push';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// Configure Multer in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Endpoints

// ── GET /api/stats ────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const announcementCount = await prisma.announcement.count({ where: { isActive: true } });

    res.json({
      activeAnnouncements: announcementCount,
      villages: 24,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});


// ── GET /api/announcements ───────────────────────────────────────────
app.get('/api/announcements', async (req, res) => {
  try {
    const fetchAll = req.query.all === 'true';
    const announcements = await prisma.announcement.findMany({
      where: fetchAll ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// ── GET /api/gallery ─────────────────────────────────────────────────
app.get('/api/gallery', async (req, res) => {
  try {
    const images = await prisma.galleryImage.findMany({
      orderBy: [
        { eventDate: 'asc' },
        { createdAt: 'asc' }
      ],
    });
    res.json(images);
  } catch (error) {
    console.error('Error fetching gallery images:', error);
    res.status(500).json({ error: 'Failed to fetch gallery images' });
  }
});

// ── POST /api/gallery ────────────────────────────────────────────────
app.post('/api/gallery', upload.single('image'), async (req, res) => {
  try {
    const title = req.body.title || 'Chenchugudi Mahabharatham';
    const uploadedBy = req.body.uploadedBy || 'Admin';
    const eventName = req.body.eventName || null;
    
    let eventDate = new Date();
    if (req.body.eventDate) {
      eventDate = new Date(req.body.eventDate);
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Helper to upload buffer to Cloudinary using stream
    const uploadToCloudinary = (fileBuffer: Buffer): Promise<UploadApiResponse> => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'chenchugudi-gallery',
            resource_type: 'auto', // Detects images and videos automatically!
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result) return reject(new Error('Cloudinary response was empty'));
            resolve(result);
          }
        );
        const bufferStream = new Readable();
        bufferStream.push(fileBuffer);
        bufferStream.push(null);
        bufferStream.pipe(stream);
      });
    };

    const cloudinaryResult = await uploadToCloudinary(req.file.buffer);

    // Save to PostgreSQL DB via Prisma
    const galleryImage = await prisma.galleryImage.create({
      data: {
        title,
        imageUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        uploadedBy,
        mediaType: cloudinaryResult.resource_type || 'image',
        eventDate,
        eventName,
      },
    });

    res.json(galleryImage);
  } catch (error) {
    console.error('Error uploading image/video to Cloudinary/DB:', error);
    res.status(500).json({ error: 'Failed to upload image/video', details: String(error) });
  }
});

// ── DELETE /api/gallery/:id ──────────────────────────────────────────
app.delete('/api/gallery/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid gallery image ID' });
    }

    // Find the image record to get the publicId
    const image = await prisma.galleryImage.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: 'Gallery image not found' });
    }

    // If the image has a publicId, delete it from Cloudinary
    if (image.publicId) {
      try {
        await cloudinary.uploader.destroy(image.publicId);
      } catch (cloudinaryErr) {
        console.error(`Failed to delete asset ${image.publicId} from Cloudinary:`, cloudinaryErr);
        // Continue database deletion anyway so we don't block cleaning up orphaned DB records
      }
    }

    // Delete from DB
    await prisma.galleryImage.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Gallery image deleted successfully' });
  } catch (error) {
    console.error('Error deleting gallery image:', error);
    res.status(500).json({ error: 'Failed to delete gallery image', details: String(error) });
  }
});

// ── PATCH /api/announcements/:id ──────────────────────────────────────
app.patch('/api/announcements/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { isActive } = req.body;
    if (isNaN(id) || typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Invalid input data' });
    }
    const announcement = await prisma.announcement.update({
      where: { id },
      data: { isActive },
    });
    res.json(announcement);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// ── POST /api/announcements ───────────────────────────────────────────
app.post('/api/announcements', async (req, res) => {
  try {
    const { title, body, isActive } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    const announcement = await prisma.announcement.create({
      data: {
        title,
        body,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    res.json(announcement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// ── PUT /api/announcements/:id ────────────────────────────────────────
app.put('/api/announcements/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, body } = req.body;
    if (isNaN(id) || !title || !body) {
      return res.status(400).json({ error: 'Invalid input data' });
    }
    const announcement = await prisma.announcement.update({
      where: { id },
      data: { title, body },
    });
    res.json(announcement);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// ── DELETE /api/announcements/:id ─────────────────────────────────────
app.delete('/api/announcements/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }
    await prisma.announcement.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// ── POST /api/visits ──────────────────────────────────────────────────
app.post('/api/visits', async (req, res) => {
  try {
    const ipAddress = req.body.ipAddress || req.ip || '127.0.0.1';
    
    // Get current local date in YYYY-MM-DD format
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const visitDate = `${yyyy}-${mm}-${dd}`;

    try {
      await prisma.userVisit.create({
        data: {
          ipAddress,
          visitDate,
        },
      });
      return res.json({ success: true, isNewToday: true });
    } catch (dbError) {
      // Catch unique constraint
      return res.json({ success: true, isNewToday: false });
    }
  } catch (error) {
    console.error('Error recording visit:', error);
    res.status(500).json({ error: 'Failed to record visit' });
  }
});

// ── POST /api/feedback ────────────────────────────────────────────────
app.post('/api/feedback', async (req, res) => {
  try {
    const { isLike, ipAddress } = req.body;
    const ip = ipAddress || req.ip || '127.0.0.1';
    
    const feedback = await prisma.feedback.upsert({
      where: { ipAddress: ip },
      update: { isLike },
      create: { ipAddress: ip, isLike },
    });
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ── GET /api/feedback/status ──────────────────────────────────────────
app.get('/api/feedback/status', async (req, res) => {
  try {
    const ip = req.query.ipAddress as string || req.ip || '127.0.0.1';
    const feedback = await prisma.feedback.findUnique({
      where: { ipAddress: ip }
    });
    res.json({ success: true, hasVoted: !!feedback, isLike: feedback?.isLike ?? null });
  } catch (error) {
    console.error('Error fetching feedback status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ── GET /api/analytics ────────────────────────────────────────────────
app.get('/api/analytics', async (req, res) => {
  try {
    const uniqueVisitorsResult = await prisma.userVisit.findMany({
      select: { ipAddress: true },
      distinct: ['ipAddress']
    });
    const totalUniqueVisitors = uniqueVisitorsResult.length;

    const likes = await prisma.feedback.count({ where: { isLike: true } });
    const dislikes = await prisma.feedback.count({ where: { isLike: false } });

    const rawDau = await prisma.userVisit.groupBy({
      by: ['visitDate'],
      _count: { ipAddress: true },
      orderBy: { visitDate: 'desc' },
      take: 7,
    });

    const dauList = rawDau.map((row) => ({
      date: row.visitDate,
      count: row._count.ipAddress,
    }));

    res.json({
      success: true,
      totalUniqueVisitors,
      likes,
      dislikes,
      dauList,
    });
  } catch (error) {
    console.error('Error in getAnalytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ── GET /api/live-stream ──────────────────────────────────────────────
app.get('/api/live-stream', async (req, res) => {
  try {
    const settings = await prisma.siteSetting.findUnique({
      where: { id: 1 }
    });
    res.json({ 
      success: true, 
      liveStreamUrl: settings?.liveStreamUrl || "", 
      liveStreamPlatform: settings?.liveStreamPlatform || "youtube",
      isLiveActive: settings?.isLiveActive || false 
    });
  } catch (error) {
    console.error('Error fetching live stream:', error);
    res.status(500).json({ error: 'Failed to fetch live stream' });
  }
});

// ── PUT /api/live-stream ──────────────────────────────────────────────
app.put('/api/live-stream', async (req, res) => {
  try {
    const { url, platform, isActive } = req.body;
    const settings = await prisma.siteSetting.upsert({
      where: { id: 1 },
      update: { liveStreamUrl: url, liveStreamPlatform: platform, isLiveActive: isActive },
      create: { id: 1, liveStreamUrl: url, liveStreamPlatform: platform, isLiveActive: isActive },
    });
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating live stream:', error);
    res.status(500).json({ error: 'Failed to update live stream' });
  }
});

// ── GET /api/seed ─────────────────────────────────────────────────────
app.get('/api/seed', async (req, res) => {
  try {
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

    res.json({ success: true, message: 'Database cleared and clean default state seeded successfully' });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({ error: 'Failed to seed database', details: String(error) });
  }
});

// Also support POST /api/seed for flexibility
app.post('/api/seed', async (req, res) => {
  try {
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

    res.json({ success: true, message: 'Database cleared and clean default state seeded successfully' });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({ error: 'Failed to seed database', details: String(error) });
  }
});

// Configure Web Push
webpush.setVapidDetails(
  'mailto:admin@chenchugudi.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// ── POST /api/notifications/subscribe ─────────────────────────────────
app.post('/api/notifications/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    res.json({ success: true, message: 'Subscription saved.' });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── POST /api/notifications/send ──────────────────────────────────────
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { title, message, url } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Missing title or message' });
    }

    const subscriptions = await prisma.pushSubscription.findMany();
    
    if (subscriptions.length === 0) {
      return res.json({ success: true, message: 'No subscribers found.' });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || 'http://localhost:3000',
      icon: '/icon-192x192.png'
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };
        await webpush.sendNotification(pushSubscription, payload);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          console.error('Failed to send push notification:', error);
        }
      }
    });

    await Promise.all(sendPromises);

    res.json({ success: true, message: `Sent to ${subscriptions.length} subscribers.` });
  } catch (error) {
    console.error('Error sending push notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

export default app;
