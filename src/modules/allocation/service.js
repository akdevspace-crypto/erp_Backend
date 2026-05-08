import { prisma } from '../../app/prisma.js';

export const createAllocation = async (tenantId, unitId, data) => {
    return prisma.allocation.create({
        data: {
            refNo: data.refNo,
            enquiryId: data.enquiryId,
            staffId: data.staffId,
            type: data.type || 'HOME_CARE',
            status: data.status || 'ALLOCATED',
            metadata: data.metadata || {},
            tenantId,
            unitId,
        }
    });
};

export const getAllocationsByType = async (tenantId, unitId, type) => {
    return prisma.allocation.findMany({
        where: {
            tenantId,
            type,
            isDeleted: false
        },
        include: {
            enquiry: {
                select: {
                    id: true,
                    refNo: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                            mobile: true
                        }
                    },
                    service: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            },
            staff: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    empId: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const updateAllocation = async (tenantId, unitId, id, data) => {
    const existing = await prisma.allocation.findFirst({
        where: { id, tenantId, unitId, isDeleted: false },
        select: { id: true }
    });
    if (!existing) {
        const error = new Error('Allocation not found');
        error.status = 404;
        throw error;
    }
    return prisma.allocation.update({
        where: { id },
        data
    });
};
