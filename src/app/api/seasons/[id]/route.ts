import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        divisions: {
          include: {
            teams: {
              include: {
                teamPlayers: {
                  include: {
                    player: true,
                  },
                },
                standings: true,
              },
            },
          },
        },
        games: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
        offWeeks: {
          orderBy: { weekStart: 'asc' },
        },
      },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    return NextResponse.json(season);
  } catch (error) {
    console.error('Error fetching season:', error);
    return NextResponse.json({ error: 'Failed to fetch season' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, startDate, endDate, isActive } = body;

    // If setting this season as active, deactivate others
    if (isActive) {
      await prisma.season.updateMany({
        where: { id: { not: id } },
        data: { isActive: false },
      });
    }

    const season = await prisma.season.update({
      where: { id },
      data: {
        name,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive,
      },
    });

    return NextResponse.json(season);
  } catch (error) {
    console.error('Error updating season:', error);
    return NextResponse.json({ error: 'Failed to update season' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.season.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Season deleted successfully' });
  } catch (error) {
    console.error('Error deleting season:', error);
    return NextResponse.json({ error: 'Failed to delete season' }, { status: 500 });
  }
}
