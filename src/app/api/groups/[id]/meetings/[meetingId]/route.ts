import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        room: true,
        group: true,
        staffRequests: true,
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Failed to fetch meeting:', error);
    return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const body = await request.json();
    const { title, description, date, startTime, endTime, roomId, roomCapacity, status, cancellationReason } = body;

    // If changing room or time, check availability
    if (roomId || date || startTime || endTime || roomCapacity) {
      const existingMeeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
      });

      if (!existingMeeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      const targetRoomId = roomId || existingMeeting.roomId;
      const targetDate = date ? new Date(date) : existingMeeting.date;
      const targetStartTime = startTime || existingMeeting.startTime;
      const targetEndTime = endTime || existingMeeting.endTime;
      const targetCapacity = roomCapacity || existingMeeting.roomCapacity;

      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const existingMeetings = await prisma.meeting.findMany({
        where: {
          roomId: targetRoomId,
          date: {
            gte: targetDate,
            lt: nextDay,
          },
          status: 'scheduled',
          id: { not: meetingId },
        },
      });

      let usedCapacity = 0;
      for (const meeting of existingMeetings) {
        if (
          (targetStartTime >= meeting.startTime && targetStartTime < meeting.endTime) ||
          (targetEndTime > meeting.startTime && targetEndTime <= meeting.endTime) ||
          (targetStartTime <= meeting.startTime && targetEndTime >= meeting.endTime)
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
      const requestedCapacity = capacityValues[targetCapacity as string] || 1;

      if (usedCapacity + requestedCapacity > 1) {
        return NextResponse.json(
          { error: 'Room does not have enough capacity for this time slot' },
          { status: 400 }
        );
      }
    }

    const meeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(date && { date: new Date(date) }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(roomId && { roomId }),
        ...(roomCapacity && { roomCapacity }),
        ...(status && { status }),
        ...(cancellationReason !== undefined && { cancellationReason }),
      },
      include: {
        room: true,
      },
    });

    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Failed to update meeting:', error);
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    await prisma.meeting.delete({
      where: { id: meetingId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete meeting:', error);
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
  }
}
