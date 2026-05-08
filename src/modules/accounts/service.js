import { prisma } from '../../app/prisma.js';
import { generateRefNumber as generateRef } from '../../shared/utils/refGenerator.js';
import { AnomalyEngine } from '../../intelligence/services/anomaly.engine.js';

export const createInvoice = async (tenantId, unitId, data) => {
    const refNo = await generateRef('INV', tenantId, unitId);

    return prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
            data: {
                amount: Number(data.amount),
                status: data.status || 'ISSUED',
                tenantId,
                unitId
            }
        });

        await tx.accountTransaction.create({
            data: {
                refNo,
                type: 'INVOICE',
                amount: Number(data.amount),
                paymentMode: data.mode,
                category: data.category,
                clientName: data.clientName || data.vendor || data.source,
                notes: data.notes || data.remarks,
                status: 'POSTED',
                date: data.date ? new Date(data.date) : new Date(),
                tenantId,
                unitId
            }
        });

        return invoice;
    });
};

export const listInvoices = async (tenantId, unitId) => {
    return prisma.invoice.findMany({
        where: { tenantId, unitId },
        orderBy: { createdAt: 'desc' }
    });
};

export const createIncome = async (tenantId, unitId, userId, data) => {
    const refNo = await generateRef('REC', tenantId, unitId);

    // AI Anomaly Check
    const anomalyResult = await AnomalyEngine.detectTransactionAnomaly(tenantId, unitId, { ...data, type: 'RECEIPT' });

    return prisma.accountTransaction.create({
        data: {
            refNo,
            type: 'RECEIPT',
            amount: Number(data.amount),
            paymentMode: data.mode,
            category: data.category,
            clientName: data.clientName || data.vendor || data.source,
            notes: data.notes || data.remarks,
            status: 'PENDING_APPROVAL',
            metadata: anomalyResult.isAnomaly ? JSON.stringify(anomalyResult.anomalies) : null,
            date: data.date ? new Date(data.date) : new Date(),
            tenantId,
            unitId
        }
    });
};

export const createExpense = async (tenantId, unitId, userId, data) => {
    const refNo = await generateRef('EXP', tenantId, unitId);

    // AI Anomaly Check
    const anomalyResult = await AnomalyEngine.detectTransactionAnomaly(tenantId, unitId, { ...data, type: 'EXPENSE' });

    return prisma.accountTransaction.create({
        data: {
            refNo,
            type: 'EXPENSE',
            amount: Number(-Math.abs(data.amount)), // Expense amount negative to reflect in totals
            paymentMode: data.mode,
            category: data.category,
            clientName: data.clientName || data.vendor || data.source,
            notes: data.notes || data.remarks,
            status: 'PENDING_APPROVAL',
            metadata: anomalyResult.isAnomaly ? JSON.stringify(anomalyResult.anomalies) : null,
            date: data.date ? new Date(data.date) : new Date(),
            tenantId,
            unitId
        }
    });
};

export const getCashbox = async (tenantId, unitId) => {
    const where = { tenantId, isDeleted: false };
    if (unitId && unitId !== 'ALL') {
        where.unitId = unitId;
    }
    return prisma.accountTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    });
};

export const approveTransaction = async (id, approverId, status, comments) => {
    return prisma.$transaction(async (tx) => {
        const transaction = await tx.accountTransaction.update({
            where: { id },
            data: {
                status: status === 'APPROVED' ? 'POSTED' : 'REJECTED'
            }
        });

        await tx.approval.create({
            data: {
                entityType: 'ACCOUNT_TRANSACTION',
                entityId: id,
                approverId,
                status,
                comments,
                tenantId: transaction.tenantId,
                unitId: transaction.unitId
            }
        });

        return transaction;
    });
};

export const updateTransaction = async (id, tenantId, unitId, data) => {
    // Two-step validation
    const where = { id, tenantId, isDeleted: false };
    if (unitId && unitId !== 'ALL') {
        where.unitId = unitId;
    }
    const existing = await prisma.accountTransaction.findFirst({ where });

    if (!existing) {
        throw new Error('Transaction not found or unauthorized');
    }

    return prisma.accountTransaction.update({
        where: { id },
        data: {
            category: data.category,
            amount: data.amount !== undefined ? Number(data.type === 'EXPENSE' ? -Math.abs(data.amount) : Math.abs(data.amount)) : undefined,
            paymentMode: data.mode,
            clientName: data.clientName || data.vendor || data.source,
            notes: data.notes || data.remarks,
            date: data.date ? new Date(data.date) : undefined
        }
    });
};

export const deleteTransaction = async (id, tenantId, unitId) => {
    // Two-step validation
    const where = { id, tenantId, isDeleted: false };
    if (unitId && unitId !== 'ALL') {
        where.unitId = unitId;
    }
    const existing = await prisma.accountTransaction.findFirst({ where });

    if (!existing) {
        throw new Error('Transaction not found or unauthorized');
    }

    return prisma.accountTransaction.update({
        where: { id },
        data: { isDeleted: true }
    });
};
