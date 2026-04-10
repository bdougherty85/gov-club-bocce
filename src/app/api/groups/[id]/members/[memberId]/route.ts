import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role || !['lead', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Valid role is required' }, { status: 400 });
    }

    // If demoting from lead, check there's at least one other lead
    if (role === 'member') {
      const leadCount = await prisma.groupMember.count({
        where: { groupId: id, role: 'lead' },
      });
      const currentMember = await prisma.groupMember.findUnique({
        where: { id: memberId },
      });
      if (currentMember?.role === 'lead' && leadCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last lead. Promote another member first.' },
          { status: 400 }
        );
      }
    }

    const member = await prisma.groupMember.update({
      where: { id: memberId },
      data: { role },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error('Failed to update member:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;

    // Check if this is the last lead
    const member = await prisma.groupMember.findUnique({
      where: { id: memberId },
    });

    if (member?.role === 'lead') {
      const leadCount = await prisma.groupMember.count({
        where: { groupId: id, role: 'lead' },
      });
      if (leadCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last lead. Promote another member first.' },
          { status: 400 }
        );
      }
    }

    await prisma.groupMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
