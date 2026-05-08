import { prisma } from '../../../app/prisma.js';

const ensureLocationModelAvailable = () => {
    if (!prisma?.location) {
        const error = new Error('Location system is not yet activated on the server. Run the Prisma migration and regenerate Prisma Client.');
        error.status = 503;
        error.code = 'LOCATION_SYSTEM_NOT_READY';
        throw error;
    }
};

const ensureLocationExists = async (locationId) => {
    ensureLocationModelAvailable();

    const location = await prisma.location.findUnique({
        where: { id: locationId }
    });

    if (!location) {
        const error = new Error('Selected location does not exist');
        error.status = 400;
        throw error;
    }
};

const ensureUnitExists = async (id, tenantId) => {
    const unit = await prisma.unit.findFirst({
        where: {
            id,
            tenantId,
            isDeleted: false
        }
    });

    if (!unit) {
        const error = new Error('Unit not found');
        error.status = 404;
        throw error;
    }

    return unit;
};

export const createUnit = async (tenantId, data) => {
    await ensureLocationExists(data.locationId);

    return prisma.unit.create({
        data: {
            ...data,
            tenantId
        },
        include: {
            location: true
        }
    });
};

export const getUnits = async (tenantId) => {
    return prisma.unit.findMany({
        where: {
            tenantId,
            isDeleted: false
        },
        include: {
            location: true
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const updateUnit = async (id, tenantId, data) => {
    await ensureUnitExists(id, tenantId);
    await ensureLocationExists(data.locationId);

    return prisma.unit.update({
        where: { id },
        data,
        include: {
            location: true
        }
    });
};

export const deleteUnit = async (id, tenantId) => {
    await ensureUnitExists(id, tenantId);

    return prisma.unit.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
