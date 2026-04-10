import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const role = searchParams.get('role');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;
    if (departmentId) where.departmentId = departmentId;
    if (role) where.role = role;

    const staff = await prisma.staff.findMany({
      where,
      include: {
        department: true,
        _count: {
          select: {
            assignedTasks: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff members' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, role, title, departmentId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Staff name is required' },
        { status: 400 }
      );
    }

    const staff = await prisma.staff.create({
      data: {
        name,
        email,
        role: role || 'Staff',
        title,
        departmentId,
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json(
      { error: 'Failed to create staff member' },
      { status: 500 }
    );
  }
}
