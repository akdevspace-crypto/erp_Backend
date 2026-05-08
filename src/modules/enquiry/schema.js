import { z } from 'zod';

export const enquirySchema = z.object({
    clientName: z.string().min(1, 'Name is required'),
    mobile: z.string().min(10, 'Mobile must be at least 10 characters'),
    email: z.string().email().optional().or(z.literal('')),
    service: z.string().optional().or(z.literal('')),
    unitId: z.string().optional().or(z.literal('')),
    mode: z.enum(['Call', 'Walk-in', 'Website', 'Reference']).optional(),
    comments: z.string().optional().or(z.literal('')),
    status: z.enum(['Open', 'In Progress', 'Converted', 'Lost']).optional(),
    patientName: z.string().optional().or(z.literal('')),
    patientAge: z.string().optional().or(z.literal('')),
    patientGender: z.string().optional().or(z.literal('')),
    patientHealthCondition: z.string().optional().or(z.literal('')),
    clientAddress: z.string().optional().or(z.literal('')),
    clientLocation: z.string().optional().or(z.literal('')),
    remarks: z.string().optional().or(z.literal(''))
});

export const followUpSchema = z.object({
    notes: z.string().min(1, 'Notes are required'),
    nextDate: z.string().datetime(),
    staffId: z.string().optional(),
    channel: z.string().optional(),
    outcome: z.string().optional(),
    attachmentName: z.string().optional().or(z.literal('')),
    clientInterest: z.string().optional(),
    readyToPayAmount: z.number().optional(),
    paymentMode: z.string().optional(),
    nextFollowupStatus: z.string().optional()
});
