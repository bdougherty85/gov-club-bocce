import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const schedules = await prisma.recurringSchedule.findMany({
      where: { groupId: id },
      include: {
        room: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Failed to fetch recurring schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      roomId,
      recurrenceType,
      dayOfWeek,
      dayOfMonth,
      weekOrdinal,
      startTime,
      endTime,
      roomCapacity = 'FULL',
      description,
      startDate,
      endDate,
    } = body;

    if (!roomId || !recurrenceType || !startTime || !endTime || !startDate) {
      return NextResponse.json(
        { error: 'Room, recurrence type, times, and start date are required' },
        { status: 400 }
      );
    }

    // Validate recurrence type parameters
    if (recurrenceType === 'weekly' || recurrenceType === 'biweekly') {
      if (dayOfWeek === undefined || dayOfWeek === null) {
        return NextResponse.json(
          { error: 'Day of week is required for weekly/biweekly schedules' },
          { status: 400 }
        );
      }
    } else if (recurrenceType === 'monthly_day') {
      if (dayOfMonth === undefined || dayOfMonth === null) {
        return NextResponse.json(
          { error: 'Day of month is required for monthly (by day) schedules' },
          { status: 400 }
        );
      }
    } else if (recurrenceType === 'monthly_ordinal') {
      if (
        weekOrdinal === undefined ||
        weekOrdinal === null ||
        dayOfWeek === undefined ||
        dayOfWeek === null
      ) {
        return NextResponse.json(
          { error: 'Week ordinal and day of week are required for monthly (ordinal) schedules' },
          { status: 400 }
        );
      }
    }

    const schedule = await prisma.recurringSchedule.create({
      data: {
        groupId: id,
        roomId,
        recurrenceType,
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        weekOrdinal: weekOrdinal ?? null,
        startTime,
        endTime,
        roomCapacity,
        description: description || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      },
      include: {
        room: true,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error('Failed to create recurring schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}
