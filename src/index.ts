import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { execSync } from 'child_process';
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

// ── GET /api/festival/active ─────────────────────────────────────────
app.get('/api/festival/active', async (req, res) => {
  try {
    const activeYear = await prisma.festivalYear.findFirst({
      where: { isActive: true },
      include: {
        events: {
          orderBy: { id: 'asc' },
        },
        sponsors: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!activeYear) {
      return res.status(404).json({ error: 'No active festival year found' });
    }

    res.json(activeYear);
  } catch (error) {
    console.error('Error fetching active festival year:', error);
    res.status(500).json({ error: 'Failed to fetch active festival year' });
  }
});

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
    const titleTe = req.body.titleTe || null;
    const uploadedBy = req.body.uploadedBy || 'Admin';
    const eventName = req.body.eventName || null;
    const eventNameTe = req.body.eventNameTe || null;
    
    let eventDate = new Date();
    if (req.body.eventDate) {
      eventDate = new Date(req.body.eventDate);
    }

    const mediaTypeInput = req.body.mediaType || 'IMAGE';
    const videoUrl = req.body.videoUrl || null;

    if (!req.file && mediaTypeInput !== 'YOUTUBE') {
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

    let imageUrl = '';
    let publicId = null;
    let finalMediaType = mediaTypeInput;

    if (req.file) {
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
      imageUrl = cloudinaryResult.secure_url;
      publicId = cloudinaryResult.public_id;
      finalMediaType = cloudinaryResult.resource_type || 'IMAGE';
    } else if (mediaTypeInput === 'YOUTUBE') {
      imageUrl = ''; // We will use youtube thumbnail logic in frontend
    }

    // Save to PostgreSQL DB via Prisma
    const galleryImage = await prisma.galleryImage.create({
      data: {
        title,
        titleTe,
        imageUrl,
        publicId,
        uploadedBy,
        mediaType: finalMediaType,
        videoUrl,
        eventDate,
        eventName,
        eventNameTe,
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
    const { title, titleTe, body, bodyTe, isActive } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    const announcement = await prisma.announcement.create({
      data: {
        title,
        titleTe,
        body,
        bodyTe,
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
    const { title, titleTe, body, bodyTe } = req.body;
    if (isNaN(id) || !title || !body) {
      return res.status(400).json({ error: 'Invalid input data' });
    }
    const announcement = await prisma.announcement.update({
      where: { id },
      data: { title, titleTe, body, bodyTe },
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



// Configure Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:your-email@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("VAPID keys not found. Push notifications will be disabled.");
}

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

// ── POST /api/admin/seed ─────────────────────────────────────────────
// ONE-TIME endpoint to seed the production database. Protected by secret key.
app.post('/api/admin/seed', async (req, res) => {
  const { secret } = req.body;
  if (secret !== 'seed-chenchugudi-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    console.log('🌱 Starting production seed...');

    const year2026 = await prisma.festivalYear.upsert({
      where: { year: '2026' },
      update: { isActive: true, pamphletUrl: '/chenchugudi-pamphlet-2026.pdf' },
      create: { year: '2026', isActive: true, pamphletUrl: '/chenchugudi-pamphlet-2026.pdf' },
    });

    await prisma.festivalYear.updateMany({
      where: { year: { not: '2026' } },
      data: { isActive: false },
    });

    await prisma.eventSchedule.deleteMany({ where: { yearId: year2026.id } });
    await prisma.dailySponsor.deleteMany({ where: { yearId: year2026.id } });

    const dailySponsorsData = [
      { date: '29-5-2026', dayTe: 'శుక్రవారం', dayEn: 'Friday', nameTe: 'శ్రీ బండి విజయశేఖర్ రెడ్డి', nameEn: 'Sri Bandi Vijayasekhar Reddy', locationTe: 'రెంటాలచేను', locationEn: 'Rentalacheenu' },
      { date: '30-5-2026', dayTe: 'శనివారం', dayEn: 'Saturday', nameTe: 'శ్రీ పూల పట్టాభి రామిరెడ్డి, ధర్మకర్త', nameEn: 'Sri Poola Pattabhi Ramireddy, Trustee', locationTe: 'రెంటాలచేను', locationEn: 'Rentalacheenu' },
      { date: '31-5-2026', dayTe: 'ఆదివారం', dayEn: 'Sunday', nameTe: 'శ్రీ కె. ఆనందరెడ్డి, చెంచుగుడి, శ్రీ జయరామరెడ్డి', nameEn: 'Sri K. Ananda Reddy, Chenchugudi, Sri Jayarama Reddy', locationTe: 'చవనపల్లి', locationEn: 'Chavanapalli' },
      { date: '01-6-2026', dayTe: 'సోమవారం', dayEn: 'Monday', nameTe: 'శ్రీ డి. నాధమునిరెడ్డి, బి.పి.ఎం.', nameEn: 'Sri D. Nadhamuni Reddy, B.P.M.', locationTe: 'తిరుమలయ్యపల్లి', locationEn: 'Tirumalayya Palli' },
      { date: '02-6-2026', dayTe: 'మంగళవారం', dayEn: 'Tuesday', nameTe: 'శ్రీ టి. దేవరాజులురెడ్డి', nameEn: 'Sri T. Devarajulu Reddy', locationTe: 'బొప్పలమడుగు', locationEn: 'Boppalamadugu' },
      { date: '03-6-2026', dayTe: 'బుధవారం', dayEn: 'Wednesday', nameTe: 'శ్రీ బండి లవ్‌రెడ్డి', nameEn: 'Sri Bandi Love Reddy', locationTe: 'చెంచుగుడి', locationEn: 'Chenchugudi' },
      { date: '04-6-2026', dayTe: 'గురువారం', dayEn: 'Thursday', nameTe: 'శ్రీ యం షణ్ముగం ఆచారి', nameEn: 'Sri M. Shanmugam Achari', locationTe: 'చెంచుగుడి', locationEn: 'Chenchugudi' },
      { date: '05-6-2026', dayTe: 'శుక్రవారం', dayEn: 'Friday', nameTe: 'శ్రీ యర్రసాని కృష్ణారెడ్డి', nameEn: 'Sri Yerrasani Krishna Reddy', locationTe: 'చెంచుగుడి', locationEn: 'Chenchugudi' },
      { date: '06-6-2026', dayTe: 'శనివారం', dayEn: 'Saturday', nameTe: 'కీ॥శే॥ శ్రీ కేశవులురెడ్డి కుమారుడు శ్రీ యస్. మోహన్‌బాబు', nameEn: "Late Sri Keshavulu Reddy's son Sri S. Mohan Babu", locationTe: 'చెంచుగుడి', locationEn: 'Chenchugudi' },
    ];

    await prisma.dailySponsor.createMany({
      data: dailySponsorsData.map(s => ({ ...s, yearId: year2026.id })),
    });

    const eventsData = [
      { date: '06-5-2026', dayTe: 'బుధవారం', dayEn: 'Wednesday', eventTe: 'శ్రీ మహాభారతయజ్ఞ శ్రీకారము', eventEn: 'Sri Mahabharata Yagna Inauguration', sponsorTe: 'శ్రీ కొత్తరెడ్డి నరసింహారెడ్డి, బొప్పలమడుగు', sponsorEn: 'Sri Kotha Reddy Narasimha Reddy, Boppalamadugu', icon: '🪔', highlight: false },
      { date: '29-5-2026', dayTe: 'శుక్రవారం', dayEn: 'Friday', eventTe: 'ధ్వజారోహణము', eventEn: 'Dhwajarohanam (Flag Hoisting)', sponsorTe: 'శ్రీ బండి విజయశేఖర్ రెడ్డి, రెంటాలచేను', sponsorEn: 'Sri Bandi Vijayasekhar Reddy, Rentalacheenu', icon: '🚩', highlight: false },
      { date: '31-5-2026', dayTe: 'ఆదివారం', dayEn: 'Sunday', eventTe: 'బండి కుంభాలు', eventEn: 'Bandi Kumballu (Sacred Pot Procession)', sponsorTe: 'లేట్ శ్రీ యం. నారాయణరెడ్డి కుమారుడు శ్రీధర్‌రెడ్డి మరియు వేణుగోపాలపురం గ్రామస్తులు', sponsorEn: 'Sri Sridhar Reddy and Venugopalapuram villagers', icon: '🎡', highlight: false },
      { date: '01-6-2026', dayTe: 'సోమవారం', dayEn: 'Monday', eventTe: 'ద్రౌపతి కళ్యాణం', eventEn: 'Draupadi Kalyanam (Auspicious Wedding Ceremony)', sponsorTe: 'శ్రీ యస్. రామలింగారెడ్డి, చెంచుగుడి', sponsorEn: 'Sri S. Ramalinga Reddy, Chenchugudi', icon: '💛', highlight: true },
      { date: '02-6-2026', dayTe: 'మంగళవారం రాత్రి', dayEn: 'Tuesday Night', eventTe: 'రాత్రి ద్రౌపతి మాన సంరక్షణ', eventEn: "Draupadi Mana Samrakshana (Protection of Draupadi's Honour)", sponsorTe: 'లేట్ శ్రీ ఆర్. దొరస్వామినాయుడు కుమారుడు దేవరాజులనాయుడు, రెడ్డేపల్లి', sponsorEn: 'Devarajulu Naidu, Reddepalli', icon: '⚔️', highlight: false },
      { date: '03-6-2026', dayTe: 'బుధవారం', dayEn: 'Wednesday', eventTe: 'అర్జున తపస్సు కార్యక్రమం', eventEn: "Arjuna Tapassu (Arjuna's Penance)", sponsorTe: 'శ్రీ పూల వెంకటరామారెడ్డి కుమారుడు పి. యశ్వంత్‌రెడ్డి, రెంటాలచేను', sponsorEn: 'Sri P. Yashwanth Reddy, Rentalacheenu', icon: '🙏', highlight: false },
      { date: '05-6-2026', dayTe: 'శుక్రవారం సా॥', dayEn: 'Friday Evening', eventTe: 'ఉత్తరగోగ్రహణం', eventEn: 'Uttara Gograhanam (Rescue of Cattle)', sponsorTe: 'లేట్ శ్రీ వై. మాధవరెడ్డి, లేట్ రాణమ్మ కుమారుడు వై. రాజేష్‌రెడ్డి, చెంచుగుడి', sponsorEn: 'Y. Rajesh Reddy, Chenchugudi', icon: '🐄', highlight: false },
      { date: '06-6-2026', dayTe: 'శనివారం సా॥', dayEn: 'Saturday Evening', eventTe: 'ఇలావంతుని బలి', eventEn: 'Aravan Bali (Sacrifice of Aravan)', sponsorTe: 'గుతా చంద్రమ్మ అళ్ళుళ్ళు: పి. రాజేష్ నాయుడు, వి. నాగార్జున నాయుడు, రెడ్డేపల్లి', sponsorEn: "Guta Chandramma's sons-in-law, Reddepalli", icon: '🔱', highlight: false },
      { date: '07-6-2026', dayTe: 'ఆదివారం', dayEn: 'Sunday', eventTe: 'ధుర్యోధన వధ', eventEn: 'Duryodhana Vadham (Slaying of Duryodhana)', sponsorTe: 'లేట్ శ్రీ బత్తుల చినన్న బోయుడు కుమారుడు బి. బాలసుబ్రహ్మణ్యం, వేణుగోపాలపురం వడ్డియిండ్లు', sponsorEn: 'B. Balasubrahmanyam, Venugopalapuram Vaddi Indlu', icon: '⚔️', highlight: false },
      { date: '07-6-2026', dayTe: 'ఆదివారం సా॥', dayEn: 'Sunday Evening', eventTe: 'అగ్గిగుండ ప్రవేశం', eventEn: 'Agni Gunda Pravesham (Sacred Fire Walk)', sponsorTe: 'శ్రీ బాలుపల్లి గ్రామస్తులచే జరుపబడును', sponsorEn: 'Will be conducted by Balupalli villagers', icon: '🔥', highlight: true, fee: '₹100' },
      { date: '07-6-2026', dayTe: 'ఆదివారం రాత్రి', dayEn: 'Sunday Night', eventTe: 'ధర్మరాజుల పట్టాభిషేకము', eventEn: 'Dharmaraja Pattabhishekam (Grand Royal Coronation)', sponsorTe: 'శ్రీ వి. బాలకృష్ణ, వేపేరి', sponsorEn: 'Sri V. Balakrishna, Veperi', icon: '👑', highlight: true },
    ];

    await prisma.eventSchedule.createMany({
      data: eventsData.map(e => ({ ...e, yearId: year2026.id })),
    });

    const siteSetting = await prisma.siteSetting.findUnique({ where: { id: 1 } });
    if (!siteSetting) {
      await prisma.siteSetting.create({ data: { id: 1, isLiveActive: false } });
    }

    console.log('✅ Production seed completed!');
    res.json({ success: true, message: '✅ Production database seeded successfully!' });
  } catch (error: any) {
    console.error('Seed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/admin/migrate ─────────────────────────────────────────
// ONE-TIME endpoint to run prisma migrate deploy on production DB.
app.post('/api/admin/migrate', async (req, res) => {
  const { secret } = req.body;
  if (secret !== 'seed-chenchugudi-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    console.log('🔧 Running prisma migrate deploy...');
    const output = execSync('npx prisma migrate deploy', {
      env: { ...process.env },
      encoding: 'utf8',
      timeout: 60000,
    });
    console.log('✅ Migration output:', output);
    res.json({ success: true, message: '✅ Migrations deployed!', output });
  } catch (error: any) {
    console.error('Migration error:', error.message);
    res.status(500).json({ error: error.message, stderr: error.stderr });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

export default app;
