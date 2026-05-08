import { prisma } from '../../app/prisma.js';
import { generateRefNumber } from '../../shared/utils/refGenerator.js';

export const requirePermission = (moduleName, actionName) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(403).json({ success: false, message: 'Access denied. No user found.' });
            }

            // Temporary bypass for local development to unblock frontend
            if (process.env.NODE_ENV !== 'production') {
                 return next();
            }

            // Bypass permission check for Admin
            const roleStr = req.user.role ? String(req.user.role).toUpperCase() : '';
            if (roleStr.includes('ADMIN') || roleStr.includes('SUPER')) {
                return next();
            }

            if (!req.user.roleId) {
                return res.status(403).json({ success: false, message: 'Access denied. No role assigned.' });
            }

            // Check if role has the requested permission
            const rolePermission = await prisma.rolePermission.findFirst({
                where: {
                    roleId: req.user.roleId,
                    permission: {
                        module: moduleName,
                        action: actionName
                    },
                    isDeleted: false
                }
            });

            if (!rolePermission) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Requires ${actionName} permission on ${moduleName} module.`
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
