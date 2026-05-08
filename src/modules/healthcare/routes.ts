import { Router } from 'express';
import { prisma } from '../../app/prisma.js';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { z } from 'zod';

const router = Router();

const patientSchema = z.object({
    name: z.string().min(1)
});

const medicationSchema = z.object({
    patientId: z.string().uuid(),
    name: z.string().min(1),
    dosage: z.string().min(1)
});

const nutritionSchema = z.object({
    patientId: z.string().uuid(),
    calories: z.number().int().positive(),
    dietPlan: z.string().min(1)
});

const getScope = (req: any) => ({
    tenantId: req.user.tenantId,
    unitId: req.user.unitId
});

// POST /api/v1/patient
router.post('/patient', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = patientSchema.parse(req.body);
        const patient = await (prisma as any).patient.create({
            data: {
                ...validated,
                ...getScope(req)
            }
        });
        res.status(201).json({ success: true, data: patient, message: 'Patient registered successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET /api/v1/patient
router.get('/patient', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const patients = await (prisma as any).patient.findMany({
            where: getScope(req),
            include: {
                admissions: true,
                medications: true,
                nutritions: true
            }
        });
        res.json({ success: true, data: patients });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/v1/medication
router.post('/medication', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = medicationSchema.parse(req.body);
        const medication = await (prisma as any).medication.create({
            data: { ...validated }
        });
        res.status(201).json({ success: true, data: medication, message: 'Medication added successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// POST /api/v1/nutrition
router.post('/nutrition', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = nutritionSchema.parse(req.body);
        const nutrition = await (prisma as any).nutrition.create({
            data: { ...validated }
        });
        res.status(201).json({ success: true, data: nutrition, message: 'Nutrition plan added successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

export default router;
