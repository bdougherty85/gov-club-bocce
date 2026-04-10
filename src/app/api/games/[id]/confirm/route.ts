import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Confirm a game's scores
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const game = await prisma.game.findUnique({
      where: { id },
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only confirm completed games' },
        { status: 400 }
      );
    }

    if (game.homeScore === null || game.awayScore === null) {
      return NextResponse.json(
        { error: 'Scores must be entered before confirming' },
        { status: 400 }
      );
    }

    const updatedGame = await prisma.game.update({
      where: { id },
      data: {
        isConfirmed: true,
        confirmedAt: new Date(),
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    return NextResponse.json(updatedGame);
  } catch (error) {
    console.error('Error confirming game:', error);
    return NextResponse.json({ error: 'Failed to confirm game' }, { status: 500 });
  }
}

// Unconfirm a game (for corrections)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const updatedGame = await prisma.game.update({
      where: { id },
      data: {
        isConfirmed: false,
        confirmedAt: null,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    return NextResponse.json(updatedGame);
  } catch (error) {
    console.error('Error unconfirming game:', error);
    return NextResponse.json({ error: 'Failed to unconfirm game' }, { status: 500 });
  }
}
