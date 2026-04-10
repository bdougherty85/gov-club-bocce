import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const seasons = await prisma.season.findMany({
      include: {
        divisions: {
          include: {
            teams: true,
          },
        },
        offWeeks: {
          orderBy: { weekStart: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    return NextResponse.json(seasons);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, startDate, endDate, isActive } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Name, start date, and end date are required' },
        { status: 400 }
      );
    }

    // If setting this season as active, deactivate others
    if (isActive) {
      await prisma.season.updateMany({
        data: { isActive: false },
      });
    }

    const season = await prisma.season.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive || false,
      },
    });

    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    console.error('Error creating season:', error);
    return NextResponse.json({ error: 'Failed to create season' }, { status: 500 });
  }
}
