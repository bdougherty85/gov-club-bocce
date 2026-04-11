import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const firstNames = [
  'James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark',
  'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian',
  'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
];

const teamNames = [
  'The Pallinos', 'Rolling Thunder', 'Ball Busters', 'The Bocce Boys',
  'Spin Doctors', 'Lane Legends', 'Court Jesters', 'The Underdogs',
  'Lucky Rollers', 'Bocce Ballers', 'The Godfathers', 'Italian Stallions',
  'Smooth Operators', 'The Closers', 'Victory Lane'
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.playerStats.deleteMany();
  await prisma.standing.deleteMany();
  await prisma.game.deleteMany();
  await prisma.divisionPlayNight.deleteMany();
  await prisma.teamPlayer.deleteMany();
  await prisma.team.deleteMany();
  await prisma.division.deleteMany();
  await prisma.season.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.court.deleteMany();
  await prisma.player.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userAppAccess.deleteMany();
  await prisma.user.deleteMany();

  // Create Admin User
  console.log('\nCreating admin user...');
  const passwordHash = await bcrypt.hash('sprinklz', 12);
  const adminUser = await prisma.user.create({
    data: {
      username: 'Bdougherty85',
      email: 'bdougherty85@govclub.com',
      passwordHash,
      name: 'Brian Dougherty',
      role: 'admin',
      appAccess: {
        create: [
          { appName: 'bocce', role: 'admin' },
          { appName: 'staff', role: 'admin' },
        ],
      },
    },
  });
  console.log(`  ✓ Created admin user: ${adminUser.username}`);

  // Create Season
  console.log('Creating season...');
  const season = await prisma.season.create({
    data: {
      name: 'Spring 2026',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    },
  });
  console.log(`  ✓ Created season: ${season.name}`);

  // Create 2 Divisions
  console.log('\nCreating divisions...');
  const divisionA = await prisma.division.create({
    data: {
      name: 'Gold Division',
      seasonId: season.id,
    },
  });
  const divisionB = await prisma.division.create({
    data: {
      name: 'Silver Division',
      seasonId: season.id,
    },
  });
  console.log(`  ✓ Created division: ${divisionA.name}`);
  console.log(`  ✓ Created division: ${divisionB.name}`);

  // Create Courts
  console.log('\nCreating courts...');
  const courts = await Promise.all([
    prisma.court.create({ data: { name: 'Court 1', location: 'North Side' } }),
    prisma.court.create({ data: { name: 'Court 2', location: 'North Side' } }),
    prisma.court.create({ data: { name: 'Court 3', location: 'South Side' } }),
  ]);
  console.log(`  ✓ Created ${courts.length} courts`);

  // Create Time Slots (Monday and Wednesday evenings)
  console.log('\nCreating time slots...');
  const mondaySlot = await prisma.timeSlot.create({
    data: {
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '21:00',
      courtId: courts[0].id,
    },
  });
  const wednesdaySlot = await prisma.timeSlot.create({
    data: {
      dayOfWeek: 3,
      startTime: '18:00',
      endTime: '21:00',
      courtId: courts[1].id,
    },
  });
  console.log(`  ✓ Created Monday 6-9pm slot`);
  console.log(`  ✓ Created Wednesday 6-9pm slot`);

  // Assign play nights to divisions
  await prisma.divisionPlayNight.create({
    data: { divisionId: divisionA.id, timeSlotId: mondaySlot.id },
  });
  await prisma.divisionPlayNight.create({
    data: { divisionId: divisionB.id, timeSlotId: wednesdaySlot.id },
  });
  console.log(`  ✓ Gold Division plays on Mondays`);
  console.log(`  ✓ Silver Division plays on Wednesdays`);

  // Create 30 Players
  console.log('\nCreating 30 players...');
  const players = [];
  for (let i = 0; i < 30; i++) {
    const player = await prisma.player.create({
      data: {
        firstName: firstNames[i],
        lastName: lastNames[i],
        email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@email.com`,
        phone: `555-${String(100 + i).padStart(3, '0')}-${String(1000 + i * 33).slice(-4)}`,
      },
    });
    players.push(player);
  }
  console.log(`  ✓ Created ${players.length} players`);

  // Create 15 Teams (8 in Gold, 7 in Silver)
  console.log('\nCreating 15 teams...');
  const teams = [];
  for (let i = 0; i < 15; i++) {
    const division = i < 8 ? divisionA : divisionB;
    const team = await prisma.team.create({
      data: {
        name: teamNames[i],
        divisionId: division.id,
      },
    });
    teams.push(team);

    await prisma.standing.create({
      data: {
        teamId: team.id,
        divisionId: division.id,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      },
    });
  }
  console.log(`  ✓ Created ${teams.length} teams`);
  console.log(`    - 8 teams in Gold Division`);
  console.log(`    - 7 teams in Silver Division`);

  // Assign 2 players to each team
  console.log('\nAssigning players to teams...');
  for (let i = 0; i < 15; i++) {
    const player1Index = i * 2;
    const player2Index = i * 2 + 1;

    await prisma.teamPlayer.create({
      data: {
        teamId: teams[i].id,
        playerId: players[player1Index].id,
        isCaptain: true,
      },
    });
    await prisma.teamPlayer.create({
      data: {
        teamId: teams[i].id,
        playerId: players[player2Index].id,
        isCaptain: false,
      },
    });
  }
  console.log(`  ✓ Assigned 2 players to each team (30 total assignments)`);

  // Create some sample games with scores for standings
  console.log('\nCreating sample games with scores...');
  let gamesCreated = 0;

  const goldTeams = teams.slice(0, 8);
  const goldGames = [
    { home: 0, away: 1, homeScore: 12, awayScore: 8 },
    { home: 2, away: 3, homeScore: 12, awayScore: 10 },
    { home: 4, away: 5, homeScore: 9, awayScore: 12 },
    { home: 6, away: 7, homeScore: 12, awayScore: 6 },
    { home: 0, away: 2, homeScore: 12, awayScore: 11 },
    { home: 1, away: 3, homeScore: 7, awayScore: 12 },
    { home: 4, away: 6, homeScore: 12, awayScore: 12 },
    { home: 5, away: 7, homeScore: 12, awayScore: 9 },
  ];

  for (let i = 0; i < goldGames.length; i++) {
    const g = goldGames[i];
    await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: goldTeams[g.home].id,
        awayTeamId: goldTeams[g.away].id,
        scheduledDate: new Date(2026, 3, 7 + Math.floor(i / 4) * 7),
        timeSlotId: mondaySlot.id,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        status: 'completed',
      },
    });
    gamesCreated++;

    const homeWon = g.homeScore > g.awayScore;
    await prisma.standing.update({
      where: { teamId_divisionId: { teamId: goldTeams[g.home].id, divisionId: divisionA.id } },
      data: {
        wins: { increment: homeWon ? 1 : 0 },
        losses: { increment: homeWon ? 0 : 1 },
        pointsFor: { increment: g.homeScore },
        pointsAgainst: { increment: g.awayScore },
      },
    });
    await prisma.standing.update({
      where: { teamId_divisionId: { teamId: goldTeams[g.away].id, divisionId: divisionA.id } },
      data: {
        wins: { increment: homeWon ? 0 : 1 },
        losses: { increment: homeWon ? 1 : 0 },
        pointsFor: { increment: g.awayScore },
        pointsAgainst: { increment: g.homeScore },
      },
    });
  }

  const silverTeams = teams.slice(8, 15);
  const silverGames = [
    { home: 0, away: 1, homeScore: 12, awayScore: 7 },
    { home: 2, away: 3, homeScore: 10, awayScore: 12 },
    { home: 4, away: 5, homeScore: 12, awayScore: 11 },
    { home: 6, away: 0, homeScore: 8, awayScore: 12 },
    { home: 1, away: 2, homeScore: 12, awayScore: 9 },
    { home: 3, away: 4, homeScore: 12, awayScore: 10 },
  ];

  for (let i = 0; i < silverGames.length; i++) {
    const g = silverGames[i];
    await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: silverTeams[g.home].id,
        awayTeamId: silverTeams[g.away].id,
        scheduledDate: new Date(2026, 3, 9 + Math.floor(i / 3) * 7),
        timeSlotId: wednesdaySlot.id,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        status: 'completed',
      },
    });
    gamesCreated++;

    const homeWon = g.homeScore > g.awayScore;
    await prisma.standing.update({
      where: { teamId_divisionId: { teamId: silverTeams[g.home].id, divisionId: divisionB.id } },
      data: {
        wins: { increment: homeWon ? 1 : 0 },
        losses: { increment: homeWon ? 0 : 1 },
        pointsFor: { increment: g.homeScore },
        pointsAgainst: { increment: g.awayScore },
      },
    });
    await prisma.standing.update({
      where: { teamId_divisionId: { teamId: silverTeams[g.away].id, divisionId: divisionB.id } },
      data: {
        wins: { increment: homeWon ? 0 : 1 },
        losses: { increment: homeWon ? 1 : 0 },
        pointsFor: { increment: g.awayScore },
        pointsAgainst: { increment: g.homeScore },
      },
    });
  }

  // Create upcoming scheduled games
  console.log('\nCreating upcoming scheduled games...');
  const upcomingGoldGames = [
    { home: 0, away: 3 },
    { home: 1, away: 2 },
    { home: 4, away: 7 },
    { home: 5, away: 6 },
  ];
  for (const g of upcomingGoldGames) {
    await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: goldTeams[g.home].id,
        awayTeamId: goldTeams[g.away].id,
        scheduledDate: new Date(2026, 3, 21),
        timeSlotId: mondaySlot.id,
        status: 'scheduled',
      },
    });
    gamesCreated++;
  }

  const upcomingSilverGames = [
    { home: 5, away: 6 },
    { home: 0, away: 2 },
    { home: 1, away: 3 },
  ];
  for (const g of upcomingSilverGames) {
    await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: silverTeams[g.home].id,
        awayTeamId: silverTeams[g.away].id,
        scheduledDate: new Date(2026, 3, 23),
        timeSlotId: wednesdaySlot.id,
        status: 'scheduled',
      },
    });
    gamesCreated++;
  }

  console.log(`  ✓ Created ${gamesCreated} games (14 completed, 7 scheduled)`);

  // Create default settings
  console.log('\nCreating league settings...');
  await prisma.settings.deleteMany();
  await prisma.settings.create({
    data: {
      leagueName: 'Governors Club Bocce League',
      playoffFormat: 'single',
      teamsInPlayoffs: 8,
      gamesPerMatch: 3,
      pointsToWin: 12,
      primaryColor: '#1B4D3E',
      secondaryColor: '#C5A572',
    },
  });
  console.log('  ✓ Created league settings');

  console.log('\n✅ Seeding complete!\n');
  console.log('Summary:');
  console.log('  - 1 Admin User (Bdougherty85 / sprinklz)');
  console.log('  - 1 Season (Spring 2026)');
  console.log('  - 2 Divisions (Gold & Silver)');
  console.log('  - 3 Courts');
  console.log('  - 2 Time Slots (Mon & Wed evenings)');
  console.log('  - 30 Players');
  console.log('  - 15 Teams (8 Gold, 7 Silver)');
  console.log('  - 21 Games (14 completed with scores, 7 upcoming)');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
