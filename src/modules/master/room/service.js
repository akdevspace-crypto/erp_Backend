import { prisma } from '../../../app/prisma.js';
import { AppError } from '../../../shared/utils/response.js';

export const createRoom = async (data, unitId, tenantId) => {
    return await prisma.room.create({
        data: {
            ...data,
            unitId,
            tenantId
        }
    });
};

export const getRooms = async (unitId, tenantId) => {
    return await prisma.room.findMany({
        where: { unitId, tenantId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const getRoomById = async (id, unitId, tenantId) => {
    const record = await prisma.room.findFirst({
        where: { id, unitId, tenantId, isDeleted: false }
    });
    if (!record) throw new AppError('Room not found', 404);
    return record;
};

export const updateRoom = async (id, data, unitId, tenantId) => {
    await getRoomById(id, unitId, tenantId); // ensure exists
    return await prisma.room.update({
        where: { id },
        data
    });
};

export const deleteRoom = async (id, unitId, tenantId) => {
    await getRoomById(id, unitId, tenantId); // ensure exists
    return await prisma.room.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
