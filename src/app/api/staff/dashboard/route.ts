import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');

    // Get current staff member for role-based filtering
    let currentStaff = null;
    if (staffId) {
      currentStaff = await prisma.staff.findUnique({
        where: { id: staffId },
      });
    }

    const now = new Date();

    // Task counts by status
    const [openCount, inProgressCount, completedCount] = await Promise.all([
      prisma.actionItem.count({ where: { status: 'Open' } }),
      prisma.actionItem.count({ where: { status: 'In Progress' } }),
      prisma.actionItem.count({ where: { status: 'Completed' } }),
    ]);

    // Traffic light counts (active tasks only)
    const [redCount, yellowCount, greenCount] = await Promise.all([
      prisma.actionItem.count({
        where: { status: { not: 'Completed' }, trafficLight: 'Red' },
      }),
      prisma.actionItem.count({
        where: { status: { not: 'Completed' }, trafficLight: 'Yellow' },
      }),
      prisma.actionItem.count({
        where: { status: { not: 'Completed' }, trafficLight: 'Green' },
      }),
    ]);

    // Blocked tasks
    const blockedTasks = await prisma.actionItem.findMany({
      where: {
        isBlocked: true,
        status: { not: 'Completed' },
      },
      include: {
        department: true,
        assignedTo: true,
        createdBy: true,
      },
      orderBy: { priority: 'asc' },
    });

    // Overdue tasks (past estimated date, not completed)
    const overdueTasks = await prisma.actionItem.findMany({
      where: {
        status: { not: 'Completed' },
        estimatedDate: { lt: now },
      },
      include: {
        department: true,
        assignedTo: true,
      },
      orderBy: { estimatedDate: 'asc' },
    });

    // Recent status updates
    const recentUpdates = await prisma.statusUpdate.findMany({
      take: 10,
      include: {
        actionItem: true,
        staff: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Tasks by department
    const tasksByDepartment = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            actionItems: {
              where: { status: { not: 'Completed' } },
            },
          },
        },
      },
    });

    return NextResponse.json({
      counts: {
        open: openCount,
        inProgress: inProgressCount,
        completed: completedCount,
        blocked: blockedTasks.length,
        overdue: overdueTasks.length,
      },
      trafficLights: {
        red: redCount,
        yellow: yellowCount,
        green: greenCount,
      },
      blockedTasks,
      overdueTasks,
      recentUpdates,
      tasksByDepartment,
      currentStaff,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
