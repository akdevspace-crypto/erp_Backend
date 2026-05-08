import { createInvoice, listInvoices, createIncome, createExpense, getCashbox, approveTransaction, updateTransaction, deleteTransaction } from './service.js';
import { success } from '../../shared/utils/response.js';
import { RevenueForecastService } from '../../intelligence/services/revenue-forecast.service.js';
import { invoiceSchema, transactionSchema, approvalSchema } from './schema.js';
import { emitEvent, EVENTS } from '../event/service.js';

export const handleCreateInvoice = async (req, res, next) => {
    try {
        const data = invoiceSchema.parse(req.body);
        const result = await createInvoice(req.tenantId, req.unitId, data);
        emitEvent(EVENTS.INVOICE_CREATED, { invoice: result });
        return success(res, result, { message: 'Invoice created successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleListInvoices = async (req, res, next) => {
    try {
        const invoices = await listInvoices(req.tenantId, req.unitId);
        return success(res, invoices);
    } catch (error) {
        next(error);
    }
};

export const handleGetFinanceForecast = async (req, res, next) => {
    try {
        const forecast = await RevenueForecastService.getLatestForecast(req.tenantId, req.unitId);
        return success(res, forecast);
    } catch (error) {
        next(error);
    }
};

export const handleCreateIncome = async (req, res, next) => {
    try {
        const data = transactionSchema.parse(req.body);
        const result = await createIncome(req.tenantId, req.unitId, req.user.id, data);
        return success(res, result, { message: 'Income recorded and pending approval' });
    } catch (error) {
        next(error);
    }
};

export const handleCreateExpense = async (req, res, next) => {
    try {
        const data = transactionSchema.parse(req.body);
        const result = await createExpense(req.tenantId, req.unitId, req.user.id, data);
        return success(res, result, { message: 'Expense recorded and pending approval' });
    } catch (error) {
        next(error);
    }
};

export const handleGetCashbox = async (req, res, next) => {
    try {
        const results = await getCashbox(req.tenantId, req.unitId);
        return success(res, results);
    } catch (error) {
        next(error);
    }
};

export const handleApproveTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, comments } = approvalSchema.parse(req.body);
        const result = await approveTransaction(id, req.user.id, status, comments);
        return success(res, result, { message: `Transaction has been ${status}` });
    } catch (error) {
        next(error);
    }
};

export const handleUpdateTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await updateTransaction(id, req.tenantId, req.unitId, req.body);
        return success(res, result, { message: 'Transaction updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleDeleteTransaction = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await deleteTransaction(id, req.tenantId, req.unitId);
        return success(res, result, { message: 'Transaction deleted successfully' });
    } catch (error) {
        next(error);
    }
};
