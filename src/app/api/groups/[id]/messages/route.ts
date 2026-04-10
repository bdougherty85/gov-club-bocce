import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const messages = await prisma.groupMessage.findMany({
      where: { groupId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.groupMessage.count({
      where: { groupId: id },
    });

    return NextResponse.json({
      messages: messages.reverse(), // Return in chronological order
      total,
      hasMore: offset + messages.length < total,
    });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { authorId, authorName, content } = body;

    if (!authorId || !authorName || !content?.trim()) {
      return NextResponse.json(
        { error: 'Author and content are required' },
        { status: 400 }
      );
    }

    // Verify the author is a member of the group
    const member = await prisma.groupMember.findFirst({
      where: { id: authorId, groupId: id },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'You must be a member of this group to post messages' },
        { status: 403 }
      );
    }

    const message = await prisma.groupMessage.create({
      data: {
        groupId: id,
        authorId,
        authorName,
        content: content.trim(),
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Failed to create message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
