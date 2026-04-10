import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        department: true,
        assignedTasks: {
          where: { status: { not: 'Completed' } },
          include: {
            department: true,
          },
          orderBy: { estimatedDate: 'asc' },
        },
        statusUpdates: {
          take: 10,
          include: {
            actionItem: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff member:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff member' },
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
    const { name, email, role, title, departmentId, isActive } = body;

    const staff = await prisma.staff.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(role !== undefined && { role }),
        ...(title !== undefined && { title }),
        ...(departmentId !== undefined && { departmentId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error updating staff member:', error);
    return NextResponse.json(
      { error: 'Failed to update staff member' },
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

    // Soft delete by setting isActive to false
    const staff = await prisma.staff.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error deleting staff member:', error);
    return NextResponse.json(
      { error: 'Failed to delete staff member' },
      { status: 500 }
    );
  }
}
