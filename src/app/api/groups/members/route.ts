import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const members = await prisma.groupMember.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      distinct: ['email'],
      orderBy: { name: 'asc' },
    });

    // Deduplicate by name+email (some members may be in multiple groups)
    const uniqueMembers = members.reduce((acc, member) => {
      const key = `${member.name}-${member.email || ''}`;
      if (!acc.has(key)) {
        acc.set(key, member);
      } else {
        // If this member is a lead anywhere, mark as lead
        if (member.role === 'lead') {
          const existing = acc.get(key)!;
          existing.role = 'lead';
        }
      }
      return acc;
    }, new Map<string, typeof members[0]>());

    return NextResponse.json(Array.from(uniqueMembers.values()));
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}
