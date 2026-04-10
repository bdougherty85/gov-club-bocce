import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const timeSlots = await prisma.timeSlot.findMany({
      include: {
        court: true,
        playNights: {
          include: {
            division: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return NextResponse.json(timeSlots);
  } catch (error) {
    console.error('Error fetching time slots:', error);
    return NextResponse.json({ error: 'Failed to fetch time slots' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dayOfWeek, startTime, endTime, courtId } = body;

    if (dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Day, start time, and end time are required' },
        { status: 400 }
      );
    }

    const timeSlot = await prisma.timeSlot.create({
      data: {
        dayOfWeek,
        startTime,
        endTime,
        courtId,
      },
      include: {
        court: true,
      },
    });

    return NextResponse.json(timeSlot, { status: 201 });
  } catch (error) {
    console.error('Error creating time slot:', error);
    return NextResponse.json({ error: 'Failed to create time slot' }, { status: 500 });
  }
}
