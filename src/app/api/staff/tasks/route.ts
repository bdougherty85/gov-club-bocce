import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const assignedToId = searchParams.get('assignedToId');
    const createdById = searchParams.get('createdById');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const isBlocked = searchParams.get('isBlocked');
    const completed = searchParams.get('completed');

    const where: Record<string, unknown> = {};

    if (departmentId) where.departmentId = departmentId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (createdById) where.createdById = createdById;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (isBlocked === 'true') where.isBlocked = true;
    if (isBlocked === 'false') where.isBlocked = false;

    // Filter for completed vs active tasks
    if (completed === 'true') {
      where.status = 'Completed';
    } else if (completed === 'false') {
      where.status = { not: 'Completed' };
    }

    const tasks = await prisma.actionItem.findMany({
      where,
      include: {
        department: true,
        createdBy: true,
        assignedTo: true,
        _count: {
          select: { statusUpdates: true },
        },
      },
      orderBy: [
        { isBlocked: 'desc' },
        { priority: 'asc' },
        { estimatedDate: 'asc' },
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      priority,
      estimatedDate,
      departmentId,
      createdById,
      assignedToId,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      );
    }

    if (!createdById) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      );
    }

    const task = await prisma.actionItem.create({
      data: {
        title,
        description,
        priority: priority || 'Medium',
        estimatedDate: estimatedDate ? new Date(estimatedDate) : null,
        departmentId,
        createdById,
        assignedToId,
      },
      include: {
        department: true,
        createdBy: true,
        assignedTo: true,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
