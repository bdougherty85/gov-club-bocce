import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.actionItem.findUnique({
      where: { id },
      include: {
        department: true,
        createdBy: true,
        assignedTo: true,
        statusUpdates: {
          include: {
            staff: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      priority,
      status,
      trafficLight,
      estimatedDate,
      completedDate,
      isBlocked,
      blockerDescription,
      departmentId,
      assignedToId,
    } = body;

    // Get the current task
    const task = await prisma.actionItem.findUnique({ where: { id } });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Build update data - allow all fields to be updated
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;
    if (trafficLight !== undefined) updateData.trafficLight = trafficLight;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
    if (blockerDescription !== undefined) updateData.blockerDescription = blockerDescription;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;

    if (estimatedDate !== undefined) {
      updateData.estimatedDate = estimatedDate ? new Date(estimatedDate) : null;
    }

    // Set completed date when status changes to Completed
    if (status === 'Completed' && task.status !== 'Completed') {
      updateData.completedDate = new Date();
    } else if (completedDate !== undefined) {
      updateData.completedDate = completedDate ? new Date(completedDate) : null;
    }

    const updatedTask = await prisma.actionItem.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        createdBy: true,
        assignedTo: true,
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.actionItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
