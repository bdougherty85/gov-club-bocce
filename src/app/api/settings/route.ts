import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    let settings = await prisma.settings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          leagueName: 'Bocce League',
          playoffFormat: 'single',
          teamsInPlayoffs: 8,
          gamesPerMatch: 3,
          pointsToWin: 12,
          primaryColor: '#1B4D3E',
          secondaryColor: '#C5A572',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      leagueName,
      playoffFormat,
      teamsInPlayoffs,
      gamesPerMatch,
      pointsToWin,
      logo,
      primaryColor,
      secondaryColor,
      currentDivisionId,
    } = body;

    let settings = await prisma.settings.findFirst();

    if (settings) {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          leagueName,
          playoffFormat,
          teamsInPlayoffs,
          gamesPerMatch,
          pointsToWin,
          logo,
          primaryColor,
          secondaryColor,
          currentDivisionId,
        },
      });
    } else {
      settings = await prisma.settings.create({
        data: {
          leagueName: leagueName || 'Bocce League',
          playoffFormat: playoffFormat || 'single',
          teamsInPlayoffs: teamsInPlayoffs || 8,
          gamesPerMatch: gamesPerMatch || 3,
          pointsToWin: pointsToWin || 12,
          logo,
          primaryColor: primaryColor || '#1B4D3E',
          secondaryColor: secondaryColor || '#C5A572',
          currentDivisionId,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
