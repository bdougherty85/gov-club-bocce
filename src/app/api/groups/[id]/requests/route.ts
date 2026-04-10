import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { groupId: id };
    if (status) {
      where.status = status;
    }

    const requests = await prisma.membershipRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Failed to fetch requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findFirst({
      where: { groupId: id, email },
    });
    if (existingMember) {
      return NextResponse.json(
        { error: 'You are already a member of this group' },
        { status: 400 }
      );
    }

    // Check if already has pending request
    const existingRequest = await prisma.membershipRequest.findFirst({
      where: { groupId: id, email, status: 'pending' },
    });
    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending request for this group' },
        { status: 400 }
      );
    }

    const membershipRequest = await prisma.membershipRequest.create({
      data: {
        groupId: id,
        name,
        email,
        status: 'pending',
      },
    });

    return NextResponse.json(membershipRequest, { status: 201 });
  } catch (error) {
    console.error('Failed to create request:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
