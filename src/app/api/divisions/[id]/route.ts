import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const division = await prisma.division.findUnique({
      where: { id },
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
    });

    if (!division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    }

    return NextResponse.json(division);
  } catch (error) {
    console.error('Error fetching division:', error);
    return NextResponse.json({ error: 'Failed to fetch division' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    const division = await prisma.division.update({
      where: { id },
      data: { name },
      include: {
        season: true,
      },
    });

    return NextResponse.json(division);
  } catch (error) {
    console.error('Error updating division:', error);
    return NextResponse.json({ error: 'Failed to update division' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.division.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Division deleted successfully' });
  } catch (error) {
    console.error('Error deleting division:', error);
    return NextResponse.json({ error: 'Failed to delete division' }, { status: 500 });
  }
}
