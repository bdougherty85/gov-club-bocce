import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const memberId = searchParams.get('memberId');

    const where: Record<string, unknown> = { isActive: true };
    if (topic) {
      where.topic = topic;
    }

    const groups = await prisma.interestGroup.findMany({
      where,
      include: {
        members: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        meetings: {
          where: {
            date: { gte: new Date() },
            status: 'scheduled',
          },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Get unique topics for filter
    const allGroups = await prisma.interestGroup.findMany({
      where: { isActive: true },
      select: { topic: true },
      distinct: ['topic'],
    });
    const topics = allGroups.map((g) => g.topic).sort();

    const formattedGroups = groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      topic: group.topic,
      memberCount: group.members.length,
      leads: group.members.filter((m) => m.role === 'lead'),
      upcomingMeetingCount: group.meetings.length,
      isMember: memberId ? group.members.some((m) => m.id === memberId) : false,
    }));

    return NextResponse.json({ groups: formattedGroups, topics });
  } catch (error) {
    console.error('Failed to fetch groups:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, topic, creatorName, creatorEmail } = body;

    if (!name || !topic || !creatorName) {
      return NextResponse.json(
        { error: 'Name, topic, and creator name are required' },
        { status: 400 }
      );
    }

    const group = await prisma.interestGroup.create({
      data: {
        name,
        description,
        topic,
        members: {
          create: {
            name: creatorName,
            email: creatorEmail || null,
            role: 'lead',
          },
        },
      },
      include: {
        members: true,
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('Failed to create group:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
