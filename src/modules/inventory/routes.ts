import { Router } from 'express';
import { prisma } from '../../app/prisma.js';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { z } from 'zod';

const router = Router();

const productSchema = z.object({
    name: z.string().min(1),
    category: z.string().min(1)
});

const stockUpdateSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int()
});

const purchaseSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    vendor: z.string().min(1)
});

const getScope = (req: any) => ({
    tenantId: req.user.tenantId,
    unitId: req.user.unitId
});

// POST /api/v1/product
router.post('/product', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = productSchema.parse(req.body);
        const product = await (prisma as any).product.create({
            data: {
                ...validated,
                ...getScope(req)
            }
        });
        res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET /api/v1/product
router.get('/product', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const products = await (prisma as any).product.findMany({
            where: getScope(req),
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: products });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/v1/stock
router.get('/stock', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const stock = await (prisma as any).stock.findMany({
            where: getScope(req),
            include: { product: true },
            orderBy: { updatedAt: 'desc' }
        });
        res.json({ success: true, data: stock });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/v1/stock/update
router.post('/stock/update', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const { productId, quantity } = stockUpdateSchema.parse(req.body);
        const scope = getScope(req);
        const stock = await (prisma as any).stock.upsert({
            where: {
                productId_tenantId_unitId: {
                    productId,
                    tenantId: scope.tenantId,
                    unitId: scope.unitId
                }
            },
            update: { quantity: { increment: quantity } },
            create: {
                productId,
                quantity,
                ...scope
            }
        });
        res.json({ success: true, data: stock, message: 'Stock updated successfully' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// POST /api/v1/purchase
router.post('/purchase', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const validated = purchaseSchema.parse(req.body);
        const scope = getScope(req);
        const purchase = await (prisma as any).purchase.create({
            data: {
                ...validated,
                ...scope
            }
        });

        // Also update stock
        await (prisma as any).stock.upsert({
            where: {
                productId_tenantId_unitId: {
                    productId: validated.productId,
                    tenantId: scope.tenantId,
                    unitId: scope.unitId
                }
            },
            update: { quantity: { increment: validated.quantity } },
            create: {
                productId: validated.productId,
                quantity: validated.quantity,
                ...scope
            }
        });

        res.status(201).json({ success: true, data: purchase, message: 'Purchase recorded and stock updated' });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
});

export default router;
