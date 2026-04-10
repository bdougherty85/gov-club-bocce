import 'dotenv/config';
import prisma from '../src/lib/prisma';

async function main() {
  console.log('Seeding interest groups data...');

  // Create Rooms
  const mensGrill = await prisma.room.upsert({
    where: { name: "Men's Grill" },
    update: {},
    create: { name: "Men's Grill", capacity: 40 },
  });

  const womensLocker = await prisma.room.upsert({
    where: { name: "Women's Locker Room" },
    update: {},
    create: { name: "Women's Locker Room", capacity: 30 },
  });

  const pub = await prisma.room.upsert({
    where: { name: 'Pub' },
    update: {},
    create: { name: 'Pub', capacity: 60 },
  });

  const diningRoom = await prisma.room.upsert({
    where: { name: 'Dining Room' },
    update: {},
    create: { name: 'Dining Room', capacity: 100 },
  });

  const eventRoom = await prisma.room.upsert({
    where: { name: 'Event Room' },
    update: {},
    create: { name: 'Event Room', capacity: 150 },
  });

  console.log('Rooms created.');

  // Create sample Interest Groups
  const wineClub = await prisma.interestGroup.create({
    data: {
      name: 'Wine Enthusiasts',
      description: 'Monthly tastings and discussions about wines from around the world. All levels welcome!',
      topic: 'Wine',
      members: {
        create: [
          { name: 'Robert Chen', email: 'robert.chen@email.com', role: 'lead' },
          { name: 'Patricia Morrison', email: 'patricia.m@email.com', role: 'member' },
          { name: 'David Williams', email: 'david.w@email.com', role: 'member' },
        ],
      },
    },
  });

  const bookClub = await prisma.interestGroup.create({
    data: {
      name: 'Governors Book Club',
      description: 'We read and discuss one book each month. Fiction and non-fiction selections.',
      topic: 'Books',
      members: {
        create: [
          { name: 'Susan Miller', email: 'susan.miller@email.com', role: 'lead' },
          { name: 'James Thompson', email: 'james.t@email.com', role: 'lead' },
          { name: 'Linda Garcia', email: 'linda.g@email.com', role: 'member' },
          { name: 'Michael Brown', email: 'michael.b@email.com', role: 'member' },
        ],
      },
    },
  });

  const investmentClub = await prisma.interestGroup.create({
    data: {
      name: 'Investment Forum',
      description: 'Discuss market trends, investment strategies, and financial planning. Guest speakers monthly.',
      topic: 'Finance',
      members: {
        create: [
          { name: 'William Anderson', email: 'william.a@email.com', role: 'lead' },
          { name: 'Richard Taylor', email: 'richard.t@email.com', role: 'member' },
          { name: 'Elizabeth Davis', email: 'elizabeth.d@email.com', role: 'member' },
        ],
      },
    },
  });

  const golfGroup = await prisma.interestGroup.create({
    data: {
      name: 'Senior Golf League',
      description: 'Weekly golf outings and friendly competitions for members 55+.',
      topic: 'Golf',
      members: {
        create: [
          { name: 'Thomas Wilson', email: 'thomas.w@email.com', role: 'lead' },
          { name: 'Charles Martin', email: 'charles.m@email.com', role: 'member' },
          { name: 'Barbara Johnson', email: 'barbara.j@email.com', role: 'member' },
          { name: 'George Anderson', email: 'george.a@email.com', role: 'member' },
          { name: 'Margaret White', email: 'margaret.w@email.com', role: 'member' },
        ],
      },
    },
  });

  const bridgeClub = await prisma.interestGroup.create({
    data: {
      name: 'Bridge Club',
      description: 'Weekly bridge games. All skill levels welcome - lessons available for beginners.',
      topic: 'Cards',
      members: {
        create: [
          { name: 'Dorothy Harris', email: 'dorothy.h@email.com', role: 'lead' },
          { name: 'Helen Clark', email: 'helen.c@email.com', role: 'member' },
          { name: 'Edward Lewis', email: 'edward.l@email.com', role: 'member' },
          { name: 'Ruth Robinson', email: 'ruth.r@email.com', role: 'member' },
        ],
      },
    },
  });

  console.log('Sample interest groups created.');

  // Create some sample meetings
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const twoWeeks = new Date(today);
  twoWeeks.setDate(today.getDate() + 14);

  await prisma.meeting.create({
    data: {
      groupId: wineClub.id,
      roomId: diningRoom.id,
      title: 'Spanish Wine Tasting',
      description: 'Exploring wines from the Rioja and Ribera del Duero regions.',
      date: nextWeek,
      startTime: '18:00',
      endTime: '20:00',
      roomCapacity: 'HALF',
    },
  });

  await prisma.meeting.create({
    data: {
      groupId: bookClub.id,
      roomId: womensLocker.id,
      title: 'March Book Discussion',
      description: 'Discussing "The Great Gatsby" by F. Scott Fitzgerald',
      date: nextWeek,
      startTime: '14:00',
      endTime: '16:00',
      roomCapacity: 'FULL',
    },
  });

  await prisma.meeting.create({
    data: {
      groupId: investmentClub.id,
      roomId: mensGrill.id,
      title: 'Q2 Market Outlook',
      description: 'Guest speaker from Morgan Stanley discusses market trends.',
      date: twoWeeks,
      startTime: '17:00',
      endTime: '19:00',
      roomCapacity: 'THREE_QUARTER',
    },
  });

  await prisma.meeting.create({
    data: {
      groupId: bridgeClub.id,
      roomId: pub.id,
      title: 'Weekly Bridge Game',
      date: nextWeek,
      startTime: '13:00',
      endTime: '16:00',
      roomCapacity: 'QUARTER',
    },
  });

  console.log('Sample meetings created.');

  // Create a pending membership request
  await prisma.membershipRequest.create({
    data: {
      groupId: wineClub.id,
      name: 'Jennifer Adams',
      email: 'jennifer.a@email.com',
      status: 'pending',
    },
  });

  await prisma.membershipRequest.create({
    data: {
      groupId: investmentClub.id,
      name: 'Christopher Lee',
      email: 'christopher.l@email.com',
      status: 'pending',
    },
  });

  console.log('Sample membership requests created.');

  console.log('✅ Interest groups seed data complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
