import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const group = await prisma.interestGroup.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: [{ role: 'asc' }, { name: 'asc' }],
        },
        membershipRequests: {
          where: { status: 'pending' },
          orderBy: { requestedAt: 'desc' },
        },
        meetings: {
          where: {
            date: { gte: new Date() },
            status: 'scheduled',
          },
          include: {
            room: true,
          },
          orderBy: { date: 'asc' },
          take: 5,
        },
        recurringSchedules: {
          where: { isActive: true },
          include: {
            room: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('Failed to fetch group:', error);
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, topic } = body;

    const group = await prisma.interestGroup.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(topic && { topic }),
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error('Failed to update group:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete by setting isActive to false
    await prisma.interestGroup.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete group:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
