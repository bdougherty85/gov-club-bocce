import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    const rooms = await prisma.room.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // If date and time provided, calculate availability
    if (date && startTime && endTime) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const meetings = await prisma.meeting.findMany({
        where: {
          date: {
            gte: targetDate,
            lt: nextDay,
          },
          status: 'scheduled',
        },
        select: {
          roomId: true,
          startTime: true,
          endTime: true,
          roomCapacity: true,
        },
      });

      const roomsWithAvailability = rooms.map((room) => {
        const roomMeetings = meetings.filter((m) => m.roomId === room.id);

        // Calculate total capacity used during the requested time slot
        let usedCapacity = 0;
        for (const meeting of roomMeetings) {
          // Check if times overlap
          const meetingStart = meeting.startTime;
          const meetingEnd = meeting.endTime;

          if (
            (startTime >= meetingStart && startTime < meetingEnd) ||
            (endTime > meetingStart && endTime <= meetingEnd) ||
            (startTime <= meetingStart && endTime >= meetingEnd)
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

        return {
          ...room,
          usedCapacity,
          availableCapacity: Math.max(0, 1 - usedCapacity),
          isAvailable: usedCapacity < 1,
        };
      });

      return NextResponse.json(roomsWithAvailability);
    }

    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}
