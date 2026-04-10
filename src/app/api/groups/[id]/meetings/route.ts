import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    const where: Record<string, unknown> = { groupId: id };
    if (!includeCompleted) {
      where.status = 'scheduled';
      where.date = { gte: new Date() };
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        room: true,
        staffRequests: true,
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(meetings);
  } catch (error) {
    console.error('Failed to fetch meetings:', error);
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { roomId, title, description, date, startTime, endTime, roomCapacity = 'FULL' } = body;

    if (!roomId || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Room, date, start time, and end time are required' },
        { status: 400 }
      );
    }

    // Check room availability
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const existingMeetings = await prisma.meeting.findMany({
      where: {
        roomId,
        date: {
          gte: targetDate,
          lt: nextDay,
        },
        status: 'scheduled',
      },
    });

    // Calculate used capacity during requested time
    let usedCapacity = 0;
    for (const meeting of existingMeetings) {
      if (
        (startTime >= meeting.startTime && startTime < meeting.endTime) ||
        (endTime > meeting.startTime && endTime <= meeting.endTime) ||
        (startTime <= meeting.startTime && endTime >= meeting.endTime)
      ) {
        const capacityMap: Record<string, number> = {
          QUARTER: 0.25,
          HALF: 0.5,
          THREE_QUARTER: 0.75,
          FULL: 1,
        };
        usedCapacity += capacityMap[meeting.roomCapacity] || 1;
      }
    }

    const capacityValues: Record<string, number> = {
      QUARTER: 0.25,
      HALF: 0.5,
      THREE_QUARTER: 0.75,
      FULL: 1,
    };
    const requestedCapacity = capacityValues[roomCapacity as string] || 1;

    if (usedCapacity + requestedCapacity > 1) {
      return NextResponse.json(
        { error: 'Room does not have enough capacity for this time slot' },
        { status: 400 }
      );
    }

    const meeting = await prisma.meeting.create({
      data: {
        groupId: id,
        roomId,
        title: title || null,
        description: description || null,
        date: new Date(date),
        startTime,
        endTime,
        roomCapacity,
      },
      include: {
        room: true,
      },
    });

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    console.error('Failed to create meeting:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
