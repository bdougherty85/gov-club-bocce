import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const offWeeks = await prisma.seasonOffWeek.findMany({
      where: { seasonId: id },
      orderBy: { weekStart: 'asc' },
    });

    return NextResponse.json(offWeeks);
  } catch (error) {
    console.error('Error fetching off weeks:', error);
    return NextResponse.json({ error: 'Failed to fetch off weeks' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { weekStart, reason } = body;

    if (!weekStart) {
      return NextResponse.json(
        { error: 'Week start date is required' },
        { status: 400 }
      );
    }

    // Verify season exists
    const season = await prisma.season.findUnique({
      where: { id },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    const offWeek = await prisma.seasonOffWeek.create({
      data: {
        seasonId: id,
        weekStart: new Date(weekStart),
        reason: reason || null,
      },
    });

    return NextResponse.json(offWeek, { status: 201 });
  } catch (error) {
    console.error('Error creating off week:', error);
    return NextResponse.json({ error: 'Failed to create off week' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const offWeekId = searchParams.get('offWeekId');

    if (!offWeekId) {
      return NextResponse.json(
        { error: 'Off week ID is required' },
        { status: 400 }
      );
    }

    await prisma.seasonOffWeek.delete({
      where: { id: offWeekId },
    });

    return NextResponse.json({ message: 'Off week deleted successfully' });
  } catch (error) {
    console.error('Error deleting off week:', error);
    return NextResponse.json({ error: 'Failed to delete off week' }, { status: 500 });
  }
}
