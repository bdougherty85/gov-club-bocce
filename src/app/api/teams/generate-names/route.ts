import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Fun name templates that incorporate player last names
const funNameTemplates = [
  // Alliterative/punny names
  (names: string[]) => `The ${names[0]} ${getRandomAdjective(names[0][0])}s`,
  (names: string[]) => `${names[0]}'s ${getRandomNoun(names[0][0])}s`,
  (names: string[]) => `Team ${names[0]} ${getRandomVerb()}`,

  // Combo names (if 2+ players)
  (names: string[]) => names.length >= 2 ? `${names[0]}-${names[1]} Express` : `${names[0]} Express`,
  (names: string[]) => names.length >= 2 ? `The ${names[0]}${names[1].slice(-3)}s` : `The ${names[0]}s`,
  (names: string[]) => names.length >= 2 ? `${names[0]} & ${names[1]}` : `Team ${names[0]}`,

  // Action names
  (names: string[]) => `${names[0]}'s Rollers`,
  (names: string[]) => `The ${names[0]} Bocce Bunch`,
  (names: string[]) => `${names[0]}'s Ball Busters`,
  (names: string[]) => `The Rolling ${names[0]}s`,
  (names: string[]) => `${names[0]}'s Pallino Posse`,
  (names: string[]) => `The ${names[0]} Legends`,
  (names: string[]) => `${names[0]} & The Bocce Boys`,
  (names: string[]) => `The ${names[0]} Dynasty`,
  (names: string[]) => `${names[0]}'s All-Stars`,
  (names: string[]) => `The Mighty ${names[0]}s`,
  (names: string[]) => `${names[0]}'s Crushers`,
  (names: string[]) => `Ball & ${names[0]}`,
  (names: string[]) => `The ${names[0]} Factor`,
  (names: string[]) => `${names[0]} Nation`,
];

// Adjectives that start with specific letters (for alliteration)
const adjectives: Record<string, string[]> = {
  default: ['Mighty', 'Rolling', 'Blazing', 'Golden', 'Silver', 'Thunder', 'Lightning', 'Flying', 'Raging', 'Wild'],
  A: ['Awesome', 'Amazing', 'Ace', 'Atomic'],
  B: ['Bold', 'Blazing', 'Brilliant', 'Brawny'],
  C: ['Crazy', 'Crushing', 'Cool', 'Crafty'],
  D: ['Dynamic', 'Daring', 'Dominant', 'Devastating'],
  E: ['Elite', 'Epic', 'Electric', 'Explosive'],
  F: ['Fierce', 'Flying', 'Fantastic', 'Furious'],
  G: ['Golden', 'Grand', 'Great', 'Gutsy'],
  H: ['Hot', 'Heavy', 'Heroic', 'Hungry'],
  I: ['Incredible', 'Invincible', 'Iron', 'Intense'],
  J: ['Jacked', 'Juiced', 'Jolly', 'Jammin'],
  K: ['Killer', 'Keen', 'Kinetic', 'Knockout'],
  L: ['Lucky', 'Legendary', 'Lethal', 'Loud'],
  M: ['Mighty', 'Magnificent', 'Mad', 'Merciless'],
  N: ['Nasty', 'Noble', 'Notorious', 'Nuclear'],
  O: ['Outstanding', 'Outrageous', 'Ominous', 'Olympian'],
  P: ['Powerful', 'Prime', 'Precision', 'Punishing'],
  Q: ['Quick', 'Quantum', 'Quality', 'Quintessential'],
  R: ['Rolling', 'Raging', 'Radical', 'Ruthless'],
  S: ['Super', 'Savage', 'Smooth', 'Slick'],
  T: ['Thunder', 'Tough', 'Terrific', 'Turbo'],
  U: ['Ultimate', 'Unstoppable', 'Unbeatable', 'Ultra'],
  V: ['Vicious', 'Victorious', 'Vibrant', 'Volcanic'],
  W: ['Wild', 'Wicked', 'Winning', 'Warrior'],
  X: ['Xtreme', 'X-Factor', 'Xenial', 'X-tra'],
  Y: ['Young', 'Youthful', 'Yelling', 'Yellow'],
  Z: ['Zealous', 'Zesty', 'Zero-Tolerance', 'Zippy'],
};

const nouns: Record<string, string[]> = {
  default: ['Rollers', 'Crushers', 'Ballers', 'Strikers', 'Champions', 'Warriors', 'Legends', 'Titans'],
  A: ['Aces', 'Avengers', 'Arrows', 'Assassins'],
  B: ['Ballers', 'Bombers', 'Bruisers', 'Bandits'],
  C: ['Crushers', 'Champions', 'Cannons', 'Cobras'],
  D: ['Dragons', 'Destroyers', 'Dominators', 'Devils'],
  E: ['Eagles', 'Enforcers', 'Eliminators', 'Express'],
  F: ['Fighters', 'Flames', 'Force', 'Fury'],
  G: ['Gladiators', 'Giants', 'Gurus', 'Gang'],
  H: ['Hammers', 'Hawks', 'Heroes', 'Hurricanes'],
  I: ['Invaders', 'Icons', 'Impact', 'Ironmen'],
  J: ['Jaguars', 'Jets', 'Juggernauts', 'Jokers'],
  K: ['Kings', 'Knights', 'Krakens', 'Killers'],
  L: ['Lions', 'Legends', 'Lancers', 'Legion'],
  M: ['Mavericks', 'Masters', 'Machines', 'Monsters'],
  N: ['Ninjas', 'Nobles', 'Nighthawks', 'Nation'],
  O: ['Outlaws', 'Olympians', 'Overlords', 'Onslaught'],
  P: ['Panthers', 'Pros', 'Pirates', 'Pioneers'],
  Q: ['Queens', 'Quake', 'Quest', 'Quicksilver'],
  R: ['Rollers', 'Raiders', 'Rockets', 'Renegades'],
  S: ['Strikers', 'Slammers', 'Sharks', 'Spartans'],
  T: ['Titans', 'Thunder', 'Tigers', 'Terminators'],
  U: ['United', 'Uprising', 'Ultimates', 'Unicorns'],
  V: ['Vikings', 'Vipers', 'Victors', 'Vanguard'],
  W: ['Warriors', 'Wolves', 'Wizards', 'Wreckers'],
  X: ['X-Men', 'X-Force', 'Xenomorphs', 'X-treme'],
  Y: ['Yetis', 'Yankees', 'Youngbloods', 'Yahoos'],
  Z: ['Zealots', 'Zombies', 'Zephyrs', 'Zeniths'],
};

const verbs = ['Strikes', 'Rolls', 'Crushes', 'Dominates', 'Rules', 'Rocks', 'Wins', 'Destroys'];

function getRandomAdjective(letter: string): string {
  const letterUpper = letter.toUpperCase();
  const options = adjectives[letterUpper] || adjectives.default;
  return options[Math.floor(Math.random() * options.length)];
}

function getRandomNoun(letter: string): string {
  const letterUpper = letter.toUpperCase();
  const options = nouns[letterUpper] || nouns.default;
  return options[Math.floor(Math.random() * options.length)];
}

function getRandomVerb(): string {
  return verbs[Math.floor(Math.random() * verbs.length)];
}

function generateFunName(playerLastNames: string[]): string {
  if (playerLastNames.length === 0) {
    // No players, use a generic fun name
    const genericNames = [
      'The Underdogs',
      'Team TBD',
      'The Mystery Squad',
      'The Wildcards',
      'No Name Needed',
    ];
    return genericNames[Math.floor(Math.random() * genericNames.length)];
  }

  // Pick a random template and generate the name
  const template = funNameTemplates[Math.floor(Math.random() * funNameTemplates.length)];
  return template(playerLastNames);
}

// POST: Generate fun names for all teams
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { divisionId } = body; // Optional: only generate for specific division

    // Get teams with their players
    const whereClause = divisionId ? { divisionId } : {};
    const teams = await prisma.team.findMany({
      where: whereClause,
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    const updates = [];
    const usedNames = new Set<string>();

    for (const team of teams) {
      // Get player last names, prioritizing captain
      const playerNames = team.teamPlayers
        .sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0))
        .map((tp) => tp.player.lastName);

      // Generate a unique name (try up to 10 times to avoid duplicates)
      let newName = generateFunName(playerNames);
      let attempts = 0;
      while (usedNames.has(newName) && attempts < 10) {
        newName = generateFunName(playerNames);
        attempts++;
      }
      usedNames.add(newName);

      // Update the team
      await prisma.team.update({
        where: { id: team.id },
        data: { name: newName },
      });

      updates.push({ teamId: team.id, oldName: team.name, newName });
    }

    return NextResponse.json({
      message: `Generated fun names for ${updates.length} teams`,
      updates,
    });
  } catch (error) {
    console.error('Error generating team names:', error);
    return NextResponse.json(
      { error: 'Failed to generate team names' },
      { status: 500 }
    );
  }
}

// PUT: Reset team names to simple format (Team 1, Team 2, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { divisionId } = body; // Optional: only reset for specific division

    // Get teams grouped by division
    const teams = await prisma.team.findMany({
      where: divisionId ? { divisionId } : {},
      include: {
        division: true,
      },
      orderBy: [
        { divisionId: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Group by division and number sequentially
    const teamsByDivision = new Map<string, typeof teams>();
    for (const team of teams) {
      const divTeams = teamsByDivision.get(team.divisionId) || [];
      divTeams.push(team);
      teamsByDivision.set(team.divisionId, divTeams);
    }

    const updates = [];

    for (const [, divTeams] of teamsByDivision) {
      for (let i = 0; i < divTeams.length; i++) {
        const team = divTeams[i];
        const newName = `Team ${i + 1}`;

        await prisma.team.update({
          where: { id: team.id },
          data: { name: newName },
        });

        updates.push({ teamId: team.id, oldName: team.name, newName });
      }
    }

    return NextResponse.json({
      message: `Reset names for ${updates.length} teams`,
      updates,
    });
  } catch (error) {
    console.error('Error resetting team names:', error);
    return NextResponse.json(
      { error: 'Failed to reset team names' },
      { status: 500 }
    );
  }
}
