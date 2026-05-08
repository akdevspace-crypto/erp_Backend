import { prisma } from '../../app/prisma.js';
import { buildSessionUser } from '../auth/access.js';

export const getProfileInfo = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            mobile: true,
            createdAt: true,
            role: {
                select: {
                    id: true,
                    name: true,
                    description: true
                }
            },
            unit: {
                select: {
                    id: true,
                    name: true,
                    code: true
                }
            },
            tenant: {
                select: {
                    name: true
                }
            },
            staff: {
                select: {
                    metadata: true
                }
            }
        }
    });

    if (!user) throw new Error('User profile not found');

    const sessionUser = buildSessionUser(user);

    return {
        empId: user.id.split('-')[0], // derived employee ID
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        role: user.role.name,
        department: user.role.description || user.role.name,
        unitId: `${user.unit.code} ${user.unit.name}`,
        phone: user.mobile || 'N/A',
        email: user.email,
        joiningDate: user.createdAt.toISOString().split('T')[0],
        sessionUser
    };
};
