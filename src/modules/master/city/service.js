import { prisma } from '../../../app/prisma.js';

export const createCity = async (tenantId, unitId, data) => {
    return prisma.city.create({
        data: {
            ...data,
            tenantId,
            unitId,
        }
    });
};

export const getCities = async (tenantId, unitId) => {
    return prisma.city.findMany({
        where: {
            tenantId,
            unitId,
            isDeleted: false
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const getCityById = async (id, tenantId, unitId) => {
    const record = await prisma.city.findFirst({
        where: { id, tenantId, unitId, isDeleted: false }
    });
    if (!record) {
        const error = new Error('City not found');
        error.status = 404;
        throw error;
    }
    return record;
};

export const updateCity = async (id, tenantId, unitId, data) => {
    await getCityById(id, tenantId, unitId);
    return prisma.city.update({
        where: { id },
        data
    });
};

export const deleteCity = async (id, tenantId, unitId) => {
    await getCityById(id, tenantId, unitId);
    return prisma.city.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
