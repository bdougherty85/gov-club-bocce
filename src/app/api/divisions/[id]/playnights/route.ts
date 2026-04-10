import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: divisionId } = await params;
    const body = await request.json();
    const { timeSlotId } = body;

    if (!timeSlotId) {
      return NextResponse.json({ error: 'Time slot ID is required' }, { status: 400 });
    }

    const playNight = await prisma.divisionPlayNight.create({
      data: {
        divisionId,
        timeSlotId,
      },
      include: {
        division: true,
        timeSlot: true,
      },
    });

    return NextResponse.json(playNight, { status: 201 });
  } catch (error) {
    console.error('Error adding play night:', error);
    return NextResponse.json({ error: 'Failed to add play night' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: divisionId } = await params;
    const { searchParams } = new URL(request.url);
    const timeSlotId = searchParams.get('timeSlotId');

    if (!timeSlotId) {
      return NextResponse.json({ error: 'Time slot ID is required' }, { status: 400 });
    }

    await prisma.divisionPlayNight.delete({
      where: {
        divisionId_timeSlotId: {
          divisionId,
          timeSlotId,
        },
      },
    });

    return NextResponse.json({ message: 'Play night removed successfully' });
  } catch (error) {
    console.error('Error removing play night:', error);
    return NextResponse.json({ error: 'Failed to remove play night' }, { status: 500 });
  }
}
