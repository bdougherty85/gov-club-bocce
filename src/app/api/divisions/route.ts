import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    const where = seasonId ? { seasonId } : {};

    const divisions = await prisma.division.findMany({
      where,
      include: {
        season: true,
        teams: {
          include: {
            teamPlayers: {
              include: {
                player: true,
              },
            },
          },
        },
        playNights: {
          include: {
            timeSlot: true,
          },
        },
        standings: {
          include: {
            team: true,
          },
          orderBy: [{ wins: 'desc' }, { pointsFor: 'desc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(divisions);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    return NextResponse.json({ error: 'Failed to fetch divisions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, seasonId } = body;

    if (!name || !seasonId) {
      return NextResponse.json(
        { error: 'Division name and season are required' },
        { status: 400 }
      );
    }

    const division = await prisma.division.create({
      data: {
        name,
        seasonId,
      },
      include: {
        season: true,
      },
    });

    return NextResponse.json(division, { status: 201 });
  } catch (error) {
    console.error('Error creating division:', error);
    return NextResponse.json({ error: 'Failed to create division' }, { status: 500 });
  }
}
