import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    const staffRequests = await prisma.meetingStaffRequest.findMany({
      where: { meetingId },
      orderBy: { requestedAt: 'desc' },
    });

    return NextResponse.json(staffRequests);
  } catch (error) {
    console.error('Failed to fetch staff requests:', error);
    return NextResponse.json({ error: 'Failed to fetch staff requests' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const { id, meetingId } = await params;
    const body = await request.json();
    const { requestType, description, requestedBy } = body;

    if (!requestType || !description || !requestedBy) {
      return NextResponse.json(
        { error: 'Request type, description, and requester name are required' },
        { status: 400 }
      );
    }

    // Validate request type
    const validTypes = ['catering', 'setup', 'equipment', 'other'];
    if (!validTypes.includes(requestType)) {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      );
    }

    // Verify the meeting exists and belongs to this group
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, groupId: id },
      include: { group: true, room: true },
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Create the staff request
    const staffRequest = await prisma.meetingStaffRequest.create({
      data: {
        meetingId,
        groupId: id,
        requestType,
        description,
        requestedBy,
        status: 'pending',
      },
    });

    // Try to create an ActionItem in the Staff Tasks app
    // First, find a default staff member to assign as creator
    const systemStaff = await prisma.staff.findFirst({
      where: { role: 'Manager' },
    });

    if (systemStaff) {
      // Find relevant department based on request type
      let departmentName = 'General';
      if (requestType === 'catering') {
        departmentName = 'Food & Beverage';
      } else if (requestType === 'setup' || requestType === 'equipment') {
        departmentName = 'Facilities';
      }

      const department = await prisma.department.findFirst({
        where: { name: { contains: departmentName, mode: 'insensitive' } },
      });

      const meetingDate = new Date(meeting.date);
      const formattedDate = meetingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      const actionItem = await prisma.actionItem.create({
        data: {
          title: `[${meeting.group.name}] ${requestType.charAt(0).toUpperCase() + requestType.slice(1)} Request`,
          description: `${description}\n\nMeeting Details:\n- Group: ${meeting.group.name}\n- Date: ${formattedDate}\n- Time: ${meeting.startTime} - ${meeting.endTime}\n- Room: ${meeting.room.name}\n- Requested by: ${requestedBy}`,
          priority: 'Medium',
          status: 'Open',
          trafficLight: 'Green',
          estimatedDate: meetingDate,
          departmentId: department?.id || null,
          createdById: systemStaff.id,
        },
      });

      // Update the staff request with the action item ID
      await prisma.meetingStaffRequest.update({
        where: { id: staffRequest.id },
        data: { actionItemId: actionItem.id },
      });

      return NextResponse.json(
        { ...staffRequest, actionItemId: actionItem.id },
        { status: 201 }
      );
    }

    return NextResponse.json(staffRequest, { status: 201 });
  } catch (error) {
    console.error('Failed to create staff request:', error);
    return NextResponse.json({ error: 'Failed to create staff request' }, { status: 500 });
  }
}
