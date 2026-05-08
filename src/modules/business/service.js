import { prisma } from '../../app/prisma.js';

export const createWelcomeCall = async (tenantId, unitId, data) => {
    return prisma.welcomeCall.create({
        data: {
            ...data,
            tenantId,
            unitId,
        }
    });
};

export const getWelcomeCalls = async (tenantId, unitId) => {
    return prisma.welcomeCall.findMany({
        where: { tenantId, unitId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const updateWelcomeCall = async (id, data) => {
    return prisma.welcomeCall.update({
        where: { id },
        data
    });
};
