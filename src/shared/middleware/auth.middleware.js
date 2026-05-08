import jwt from 'jsonwebtoken';
import { prisma } from '../../app/prisma.js';
import { runWithContext } from '../utils/context.js';

export const auth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforerpsystem');

        const user = await prisma.user.findFirst({
            where: {
                id: decoded.id,
                tenantId: decoded.tenantId,
                isDeleted: false
            },
            select: {
                id: true,
                roleId: true,
                tenantId: true,
                unitId: true,
                email: true,
                mobile: true,
                firstName: true,
                lastName: true,
                isActive: true,
                updatedAt: true,
                role: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        }

        const tokenIssuedAtMs = typeof decoded.iat === 'number' ? decoded.iat * 1000 : 0;
        if (tokenIssuedAtMs && user.updatedAt.getTime() > tokenIssuedAtMs) {
            return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        }

        // Mount user info to request
        req.user = {
            id: user.id,
            roleId: user.roleId,
            tenantId: user.tenantId,
            unitId: user.unitId,
            email: user.email,
            mobile: user.mobile,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || user.id,
            role: user.role?.name || decoded.role
        };

        // 🚀 Ensure explicit API layer context
        const headerUnitId = typeof req.headers['x-unit-id'] === 'string'
            ? req.headers['x-unit-id'].trim()
            : Array.isArray(req.headers['x-unit-id'])
                ? String(req.headers['x-unit-id'][0] || '').trim()
                : '';
        const activeUnitId = headerUnitId || req.user.unitId;

        req.context = {
            tenantId: req.user.tenantId,
            unitId: activeUnitId,
            userId: req.user.id
        };

        console.log('CTX:', req.context);

        // 🚀 Rehydrate Context for the request lifecycle
        runWithContext({
            userId: req.user.id,
            tenantId: req.user.tenantId,
            unitId: activeUnitId,
            role: req.user.role
        }, () => {
            next();
        });
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
};

export const enforceTenant = (req, res, next) => {
    if (!req.user || !req.user.tenantId || !req.user.unitId) {
        return res.status(403).json({
            success: false,
            message: 'Tenant or Unit isolation violation detected. Access denied.'
        });
    }
    req.tenantId = req.context?.tenantId || req.user.tenantId;
    req.unitId = req.context?.unitId || req.user.unitId;
    next();
};

export const protect = auth; // Alias for backward compatibility
