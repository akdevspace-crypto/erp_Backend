import { prisma } from '../../app/prisma.js';

export const getDashboardKPIs = async (tenantId, unitId) => {
    const totalEnquiries = await prisma.enquiry.count({
        where: { tenantId, unitId, isDeleted: false }
    });

    const pendingFollowups = await prisma.followUp.count({
        where: {
            tenantId,
            unitId,
            isDeleted: false,
            scheduledAt: { gte: new Date() }
        }
    });

    const revenue = await prisma.accountTransaction.aggregate({
        _sum: { amount: true },
        where: {
            tenantId,
            unitId,
            status: "POSTED",
            type: "RECEIPT",
            isDeleted: false
        }
    });

    const pendingApprovals = await prisma.approval.count({
        where: {
            tenantId,
            unitId,
            status: "PENDING",
            isDeleted: false
        }
    });

    const activeEnquiries = await prisma.enquiry.count({
        where: {
            tenantId,
            unitId,
            isDeleted: false,
            status: { in: ["NEW", "FOLLOW_UP", "IN_PROGRESS"] }
        }
    });

    const criticalPatients = await prisma.vitalSign.count({
        where: {
            tenantId,
            unitId,
            isDeleted: false,
            OR: [
                { spO2: { lt: 92 } },
                { pulse: { gt: 110 } },
                { temp: { gt: 100.4 } },
                { notes: { contains: "Critical", mode: "insensitive" } }
            ]
        }
    });

    const lowStockAlerts = await prisma.stock.count({
        where: {
            tenantId,
            unitId,
            quantity: { lt: 12 }
        }
    });

    const pendingPayments = await prisma.accountTransaction.count({
        where: {
            tenantId,
            unitId,
            isDeleted: false,
            OR: [
                { status: "PENDING_APPROVAL" },
                { notes: { contains: "pending", mode: "insensitive" } },
                { notes: { contains: "overdue", mode: "insensitive" } },
                { notes: { contains: "partial", mode: "insensitive" } }
            ]
        }
    });

    return {
        totalEnquiries,
        pendingFollowups,
        revenue: revenue._sum.amount || 0,
        pendingApprovals,
        activeEnquiries,
        criticalPatients,
        lowStockAlerts,
        pendingPayments
    };
};

// Caching layer for analytics
const cache = new Map();

export const cachedKPIs = async (key, fn) => {
    if (cache.has(key)) return cache.get(key);

    const data = await fn();
    cache.set(key, data);

    // Expiry after 5 minutes
    setTimeout(() => cache.delete(key), 5 * 60 * 1000);

    return data;
};
