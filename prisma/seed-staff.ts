import 'dotenv/config';
import prisma from '../src/lib/prisma';

async function main() {
  console.log('Seeding staff management data...');

  // Create Departments
  const administration = await prisma.department.upsert({
    where: { name: 'Administration' },
    update: {},
    create: { name: 'Administration', description: 'Executive and administrative staff' },
  });

  const foodAndBev = await prisma.department.upsert({
    where: { name: 'Food & Beverage' },
    update: {},
    create: { name: 'Food & Beverage', description: 'Bar and dining service staff' },
  });

  const proShop = await prisma.department.upsert({
    where: { name: 'Pro Shop' },
    update: {},
    create: { name: 'Pro Shop', description: 'Golf pro shop and merchandise' },
  });

  const maintenance = await prisma.department.upsert({
    where: { name: 'Maintenance' },
    update: {},
    create: { name: 'Maintenance', description: 'Facilities and grounds maintenance' },
  });

  const kitchen = await prisma.department.upsert({
    where: { name: 'Kitchen' },
    update: {},
    create: { name: 'Kitchen', description: 'Culinary and food preparation staff' },
  });

  console.log('Departments created.');

  // Helper function to create or update staff
  async function upsertStaff(
    name: string,
    role: string,
    title: string,
    departmentId: string,
    email?: string
  ) {
    const emailAddr = email || `${name.toLowerCase().replace(/\s+/g, '.')}@govclub.com`;
    return prisma.staff.upsert({
      where: { email: emailAddr },
      update: { name, role, title, departmentId },
      create: { name, email: emailAddr, role, title, departmentId },
    });
  }

  // Administration
  const markG = await upsertStaff('Mark G', 'Manager', 'Managing Director', administration.id);

  // Food & Beverage
  const markB = await upsertStaff('Mark B', 'Manager', 'F&B Director', foodAndBev.id);
  const jeffrey = await upsertStaff('Jeffrey', 'Staff', 'Bartender', foodAndBev.id);
  const austin = await upsertStaff('Austin', 'Staff', 'Bartender', foodAndBev.id);
  const jarrod = await upsertStaff('Jarrod', 'Staff', 'Bartender', foodAndBev.id);
  const synzei = await upsertStaff('Synzei', 'Staff', 'Bartender', foodAndBev.id);
  const lyndsey = await upsertStaff('Lyndsey', 'Staff', 'Bartender', foodAndBev.id);
  const dave = await upsertStaff('Dave', 'Staff', 'Bartender', foodAndBev.id);
  const brooke = await upsertStaff('Brooke', 'Staff', 'Bartender', foodAndBev.id);
  const jess = await upsertStaff('Jess', 'Staff', 'Bartender', foodAndBev.id);

  // Pro Shop
  const scott = await upsertStaff('Scott', 'Lead', 'Pro Shop Manager', proShop.id);
  const ben = await upsertStaff('Ben', 'Staff', 'Pro Shop Associate', proShop.id);
  const mike = await upsertStaff('Mike', 'Staff', 'Pro Shop Associate', proShop.id);
  const rachel = await upsertStaff('Rachel', 'Staff', 'Pro Shop Associate', proShop.id);

  // Maintenance
  const tomHarris = await upsertStaff('Tom Harris', 'Manager', 'Maintenance Director', maintenance.id);
  const carlos = await upsertStaff('Carlos', 'Lead', 'Maintenance Lead', maintenance.id);
  const james = await upsertStaff('James', 'Staff', 'Groundskeeper', maintenance.id);
  const derek = await upsertStaff('Derek', 'Staff', 'Facilities Tech', maintenance.id);
  const maria = await upsertStaff('Maria', 'Lead', 'Cleaning Supervisor', maintenance.id);

  // Kitchen
  const lee = await upsertStaff('Lee', 'Manager', 'Head Chef', kitchen.id);
  const sarah = await upsertStaff('Sarah', 'Lead', 'Sous Chef', kitchen.id);
  const miguel = await upsertStaff('Miguel', 'Staff', 'Line Cook', kitchen.id);
  const kevin = await upsertStaff('Kevin', 'Staff', 'Line Cook', kitchen.id);
  const amy = await upsertStaff('Amy', 'Staff', 'Prep Cook', kitchen.id);
  const chris = await upsertStaff('Chris', 'Staff', 'Dishwasher', kitchen.id);

  console.log('Staff members created.');

  // Create Sample Action Items
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Task 1: Blocked high priority task
  const task1 = await prisma.actionItem.create({
    data: {
      title: 'Repair irrigation system on hole 7',
      description: 'The irrigation system on hole 7 is malfunctioning. Needs immediate attention.',
      priority: 'High',
      status: 'In Progress',
      trafficLight: 'Red',
      isBlocked: true,
      blockerDescription: 'Waiting on replacement parts - vendor delayed shipment until next week',
      estimatedDate: yesterday,
      departmentId: maintenance.id,
      createdById: tomHarris.id,
      assignedToId: carlos.id,
    },
  });

  // Task 2: Overdue task
  const task2 = await prisma.actionItem.create({
    data: {
      title: 'Quarterly inventory count - Bar',
      description: 'Complete quarterly inventory count for all bar supplies and beverages',
      priority: 'Medium',
      status: 'In Progress',
      trafficLight: 'Yellow',
      estimatedDate: lastWeek,
      departmentId: foodAndBev.id,
      createdById: markB.id,
      assignedToId: jeffrey.id,
    },
  });

  // Task 3: On track task
  await prisma.actionItem.create({
    data: {
      title: 'Update summer menu specials',
      description: 'Create and finalize summer menu specials for the dining room',
      priority: 'Medium',
      status: 'In Progress',
      trafficLight: 'Green',
      estimatedDate: nextWeek,
      departmentId: kitchen.id,
      createdById: lee.id,
      assignedToId: sarah.id,
    },
  });

  // Task 4: New high priority task
  await prisma.actionItem.create({
    data: {
      title: 'Golf cart fleet maintenance',
      description: 'Annual maintenance check for all golf carts before tournament season',
      priority: 'High',
      status: 'Open',
      trafficLight: 'Green',
      estimatedDate: nextWeek,
      departmentId: proShop.id,
      createdById: markG.id,
      assignedToId: scott.id,
    },
  });

  // Task 5: Blocked kitchen task
  await prisma.actionItem.create({
    data: {
      title: 'Install new walk-in freezer',
      description: 'Coordinate installation of the new walk-in freezer unit',
      priority: 'High',
      status: 'Open',
      trafficLight: 'Red',
      isBlocked: true,
      blockerDescription: 'Need electrical upgrade completed first - waiting on permit approval',
      estimatedDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000),
      departmentId: kitchen.id,
      createdById: lee.id,
      assignedToId: null,
    },
  });

  // Task 6: Low priority task
  await prisma.actionItem.create({
    data: {
      title: 'Reorganize storage room',
      description: 'Clean out and reorganize the pro shop storage room',
      priority: 'Low',
      status: 'Open',
      trafficLight: 'Green',
      estimatedDate: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000),
      departmentId: proShop.id,
      createdById: scott.id,
      assignedToId: ben.id,
    },
  });

  // Task 7: Completed task
  await prisma.actionItem.create({
    data: {
      title: 'Deep clean bar area',
      description: 'Complete deep cleaning of the bar area including equipment sanitization',
      priority: 'Medium',
      status: 'Completed',
      trafficLight: 'Green',
      estimatedDate: lastWeek,
      completedDate: new Date(lastWeek.getTime() - 1 * 24 * 60 * 60 * 1000),
      departmentId: foodAndBev.id,
      createdById: markB.id,
      assignedToId: austin.id,
    },
  });

  // Task 8: Another completed task
  await prisma.actionItem.create({
    data: {
      title: 'Staff scheduling for April events',
      description: 'Create and distribute staff schedule for all April club events',
      priority: 'High',
      status: 'Completed',
      trafficLight: 'Green',
      estimatedDate: lastWeek,
      completedDate: lastWeek,
      departmentId: administration.id,
      createdById: markG.id,
      assignedToId: markG.id,
    },
  });

  console.log('Sample action items created.');

  // Create some status updates
  await prisma.statusUpdate.create({
    data: {
      actionItemId: task1.id,
      staffId: carlos.id,
      trafficLight: 'Yellow',
      notes: 'Started diagnosis of the irrigation system. Found multiple broken sprinkler heads and a leak in the main line.',
    },
  });

  await prisma.statusUpdate.create({
    data: {
      actionItemId: task1.id,
      staffId: carlos.id,
      trafficLight: 'Red',
      notes: 'Need to order replacement parts. Placed order but vendor says 5-7 business days for delivery. Marking as blocked.',
    },
  });

  await prisma.statusUpdate.create({
    data: {
      actionItemId: task2.id,
      staffId: jeffrey.id,
      trafficLight: 'Yellow',
      notes: 'Started inventory count. About 60% complete. Need to finish spirits and wine cellar sections.',
    },
  });

  console.log('Status updates created.');

  console.log('✅ Staff management seed data complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
