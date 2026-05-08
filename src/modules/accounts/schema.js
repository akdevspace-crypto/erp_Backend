import { z } from 'zod';

export const transactionSchema = z.object({
    source: z.string().optional(),
    category: z.string().optional(),
    clientName: z.string().optional(),
    amount: z.number().positive("Amount must be positive"),
    mode: z.string().optional(),
    remarks: z.string().optional(),
    date: z.string().optional()
});

export const invoiceSchema = transactionSchema.extend({
    status: z.string().optional()
});

export const approvalSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    comments: z.string().optional()
});
