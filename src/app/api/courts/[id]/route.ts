import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, location, isActive } = body;

    const court = await prisma.court.update({
      where: { id },
      data: {
        name,
        location,
        isActive,
      },
    });

    return NextResponse.json(court);
  } catch (error) {
    console.error('Error updating court:', error);
    return NextResponse.json({ error: 'Failed to update court' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.court.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Court deleted successfully' });
  } catch (error) {
    console.error('Error deleting court:', error);
    return NextResponse.json({ error: 'Failed to delete court' }, { status: 500 });
  }
}
