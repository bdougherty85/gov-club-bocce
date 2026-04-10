import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await prisma.statusUpdate.findMany({
      where: { actionItemId: id },
      include: {
        staff: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(updates);
  } catch (error) {
    console.error('Error fetching status updates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status updates' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: actionItemId } = await params;
    const body = await request.json();
    const { staffId, trafficLight, notes } = body;

    if (!staffId) {
      return NextResponse.json(
        { error: 'Staff ID is required' },
        { status: 400 }
      );
    }

    if (!trafficLight || !['Red', 'Yellow', 'Green'].includes(trafficLight)) {
      return NextResponse.json(
        { error: 'Valid traffic light status is required (Red, Yellow, Green)' },
        { status: 400 }
      );
    }

    if (!notes || notes.trim() === '') {
      return NextResponse.json(
        { error: 'Notes are required' },
        { status: 400 }
      );
    }

    // Verify the task exists
    const task = await prisma.actionItem.findUnique({
      where: { id: actionItemId },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Create the status update
    const statusUpdate = await prisma.statusUpdate.create({
      data: {
        actionItemId,
        staffId,
        trafficLight,
        notes: notes.trim(),
      },
      include: {
        staff: true,
        actionItem: true,
      },
    });

    // Also update the task's traffic light to match the latest update
    await prisma.actionItem.update({
      where: { id: actionItemId },
      data: { trafficLight },
    });

    return NextResponse.json(statusUpdate, { status: 201 });
  } catch (error) {
    console.error('Error creating status update:', error);
    return NextResponse.json(
      { error: 'Failed to create status update' },
      { status: 500 }
    );
  }
}
