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

  // Seed 2026 Festival Year
  console.log("Seeding 2026 Festival Year...");

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
    { date: '06-6-2026', dayTe: 'శనివారం', dayEn: 'Saturday', nameTe: 'కీ॥శే॥ శ్రీ కేశవులురెడ్డి కుమారుడు శ్రీ యస్. మోహన్‌బాబు', nameEn: 'Late Sri Keshavulu Reddy\'s son Sri S. Mohan Babu', locationTe: 'చెంచుగుడి', locationEn: 'Chenchugudi' },
  ];

  await prisma.dailySponsor.createMany({
    data: dailySponsorsData.map(s => ({ ...s, yearId: year2026.id })),
  });

  const eventsData = [
    { date: '06-5-2026', dayTe: 'బుధవారం', dayEn: 'Wednesday', eventTe: 'శ్రీ మహాభారతయజ్ఞ శ్రీకారము', eventEn: 'Sri Mahabharata Yagna Inauguration', sponsorTe: 'శ్రీ కొత్తరెడ్డి నరసింహారెడ్డి, బొప్పలమడుగు', sponsorEn: 'Sri Kotha Reddy Narasimha Reddy, Boppalamadugu', icon: '🪔', highlight: false },
    { date: '29-5-2026', dayTe: 'శుక్రవారం', dayEn: 'Friday', eventTe: 'ధ్వజారోహణము', eventEn: 'Dhwajarohanam (Flag Hoisting)', sponsorTe: 'శ్రీ బండి విజయశేఖర్ రెడ్డి, రెంటాలచేను', sponsorEn: 'Sri Bandi Vijayasekhar Reddy, Rentalacheenu', icon: '🚩', highlight: false },
    { date: '31-5-2026', dayTe: 'ఆదివారం', dayEn: 'Sunday', eventTe: 'బండి కుంభాలు', eventEn: 'Bandi Kumballu (Sacred Pot Procession)', sponsorTe: 'లేట్ శ్రీ యం. నారాయణరెడ్డి కుమారుడు శ్రీధర్‌రెడ్డి మరియు వేణుగోపాలపురం గ్రామస్తులు', sponsorEn: 'Sri Sridhar Reddy and Venugopalapuram villagers', icon: '🎡', highlight: false },
    { date: '01-6-2026', dayTe: 'సోమవారం', dayEn: 'Monday', eventTe: 'ద్రౌపతి కళ్యాణం', eventEn: 'Draupadi Kalyanam (Auspicious Wedding Ceremony)', sponsorTe: 'శ్రీ యస్. రామలింగారెడ్డి, చెంచుగుడి', sponsorEn: 'Sri S. Ramalinga Reddy, Chenchugudi', icon: '💛', highlight: true },
    { date: '02-6-2026', dayTe: 'మంగళవారం రాత్రి', dayEn: 'Tuesday Night', eventTe: 'రాత్రి ద్రౌపతి మాన సంరక్షణ', eventEn: 'Draupadi Mana Samrakshana (Protection of Draupadi\'s Honour)', sponsorTe: 'లేట్ శ్రీ ఆర్. దొరస్వామినాయుడు కుమారుడు దేవరాజులనాయుడు, రెడ్డేపల్లి', sponsorEn: 'Devarajulu Naidu, Reddepalli', icon: '⚔️', highlight: false },
    { date: '03-6-2026', dayTe: 'బుధవారం', dayEn: 'Wednesday', eventTe: 'అర్జున తపస్సు కార్యక్రమం', eventEn: 'Arjuna Tapassu (Arjuna\'s Penance)', sponsorTe: 'శ్రీ పూల వెంకటరామారెడ్డి కుమారుడు పి. యశ్వంత్‌రెడ్డి, రెంటాలచేను', sponsorEn: 'Sri P. Yashwanth Reddy, Rentalacheenu', icon: '🙏', highlight: false },
    { date: '05-6-2026', dayTe: 'శుక్రవారం సా॥', dayEn: 'Friday Evening', eventTe: 'ఉత్తరగోగ్రహణం', eventEn: 'Uttara Gograhanam (Rescue of Cattle)', sponsorTe: 'లేట్ శ్రీ వై. మాధవరెడ్డి, లేట్ రాణమ్మ కుమారుడు వై. రాజేష్‌రెడ్డి, చెంచుగుడి', sponsorEn: 'Y. Rajesh Reddy, Chenchugudi', icon: '🐄', highlight: false },
    { date: '06-6-2026', dayTe: 'శనివారం సా॥', dayEn: 'Saturday Evening', eventTe: 'ఇలావంతుని బలి', eventEn: 'Aravan Bali (Sacrifice of Aravan)', sponsorTe: 'గుతా చంద్రమ్మ అళ్ళుళ్ళు: పి. రాజేష్ నాయుడు, వి. నాగార్జున నాయుడు, రెడ్డేపల్లి', sponsorEn: 'Guta Chandramma\'s sons-in-law, Reddepalli', icon: '🔱', highlight: false },
    { date: '07-6-2026', dayTe: 'ఆదివారం', dayEn: 'Sunday', eventTe: 'ధుర్యోధన వధ', eventEn: 'Duryodhana Vadham (Slaying of Duryodhana)', sponsorTe: 'లేట్ శ్రీ బత్తుల చినన్న బోయుడు కుమారుడు బి. బాలసుబ్రహ్మణ్యం, వేణుగోపాలపురం వడ్డియిండ్లు', sponsorEn: 'B. Balasubrahmanyam, Venugopalapuram Vaddi Indlu', icon: '⚔️', highlight: false },
    { date: '07-6-2026', dayTe: 'ఆదివారం సా॥', dayEn: 'Sunday Evening', eventTe: 'అగ్గిగుండ ప్రవేశం', eventEn: 'Agni Gunda Pravesham (Sacred Fire Walk)', sponsorTe: 'శ్రీ బాలుపల్లి గ్రామస్తులచే జరుపబడును', sponsorEn: 'Will be conducted by Balupalli villagers', icon: '🔥', highlight: true, fee: '₹100' },
    { date: '07-6-2026', dayTe: 'ఆదివారం రాత్రి', dayEn: 'Sunday Night', eventTe: 'ధర్మరాజుల పట్టాభిషేకము', eventEn: 'Dharmaraja Pattabhishekam (Grand Royal Coronation)', sponsorTe: 'శ్రీ వి. బాలకృష్ణ, వేపేరి', sponsorEn: 'Sri V. Balakrishna, Veperi', icon: '👑', highlight: true },
  ];

  await prisma.eventSchedule.createMany({
    data: eventsData.map(e => ({ ...e, yearId: year2026.id })),
  });

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
