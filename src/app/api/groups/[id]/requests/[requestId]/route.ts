import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action (approve/reject) is required' },
        { status: 400 }
      );
    }

    const membershipRequest = await prisma.membershipRequest.findUnique({
      where: { id: requestId },
    });

    if (!membershipRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (membershipRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Request has already been processed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Create the member and update the request in a transaction
      await prisma.$transaction([
        prisma.groupMember.create({
          data: {
            groupId: id,
            name: membershipRequest.name,
            email: membershipRequest.email,
            role: 'member',
          },
        }),
        prisma.membershipRequest.update({
          where: { id: requestId },
          data: { status: 'approved', respondedAt: new Date() },
        }),
      ]);
    } else {
      await prisma.membershipRequest.update({
        where: { id: requestId },
        data: { status: 'rejected', respondedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('Failed to process request:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
