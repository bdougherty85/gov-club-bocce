import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const body = await request.json();
    const { playerId, isCaptain = false } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    const teamPlayer = await prisma.teamPlayer.create({
      data: {
        teamId,
        playerId,
        isCaptain,
      },
      include: {
        player: true,
        team: true,
      },
    });

    return NextResponse.json(teamPlayer, { status: 201 });
  } catch (error) {
    console.error('Error adding player to team:', error);
    return NextResponse.json({ error: 'Failed to add player to team' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    await prisma.teamPlayer.delete({
      where: {
        teamId_playerId: {
          teamId,
          playerId,
        },
      },
    });

    return NextResponse.json({ message: 'Player removed from team successfully' });
  } catch (error) {
    console.error('Error removing player from team:', error);
    return NextResponse.json({ error: 'Failed to remove player from team' }, { status: 500 });
  }
}
