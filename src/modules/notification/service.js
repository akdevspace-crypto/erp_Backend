import { emitRealtimeEvent } from '../../shared/services/socket.js';

export const sendNotification = async ({ userId, message, type, tenantId, unitId }) => {
    emitRealtimeEvent('notification:new', {
        userId,
        message,
        type,
        tenantId,
        unitId,
        createdAt: new Date().toISOString()
    });

    console.log(`[NOTIFICATION - ${type}] To User: ${userId} | Message: ${message} | Tenant: ${tenantId}`);
    return true;
};
