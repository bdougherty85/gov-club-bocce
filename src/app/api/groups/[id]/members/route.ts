import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, role = 'member' } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check if member already exists in this group by email
    if (email) {
      const existing = await prisma.groupMember.findFirst({
        where: { groupId: id, email },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A member with this email already exists in the group' },
          { status: 400 }
        );
      }
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId: id,
        name,
        email: email || null,
        role,
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Failed to add member:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}
