import { prisma } from '../../app/prisma.js';
import { hasConfiguredMenuPrivilege } from '../hr/service.js';
import { StaffIntelligenceService } from '../../intelligence/services/staff-intelligence.service.js';

const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const taskStaffSelect = {
    id: true,
    empId: true,
    firstName: true,
    lastName: true,
    metadata: true,
    isDeleted: true
};

const normalizeIdentifier = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

const findUserWithLinkedStaff = async (tenantId, unitId, normalizedIdentifier) => {
    const scopedUser = await prisma.user.findFirst({
        where: {
            id: normalizedIdentifier,
            tenantId,
            unitId,
            isDeleted: false,
            staff: {
                is: {
                    tenantId,
                    unitId,
                    isDeleted: false
                }
            }
        },
        include: {
            role: true,
            staff: {
                select: taskStaffSelect
            }
        }
    });

    if (scopedUser) {
        return scopedUser;
    }

    return prisma.user.findFirst({
        where: {
            id: normalizedIdentifier,
            tenantId,
            isDeleted: false,
            staff: {
                is: {
                    tenantId,
                    isDeleted: false
                }
            }
        },
        include: {
            role: true,
            staff: {
                select: taskStaffSelect
            }
        }
    });
};

const resolveStaffLinkedUser = async (tenantId, unitId, identifier) => {
    const normalizedIdentifier = normalizeIdentifier(identifier);
    if (!normalizedIdentifier) return null;

    const user = await findUserWithLinkedStaff(tenantId, unitId, normalizedIdentifier);

    if (user) {
        return user;
    }

    const userWithLinkedStaff = await prisma.user.findFirst({
        where: {
            id: normalizedIdentifier,
            tenantId,
            unitId,
            isDeleted: false
        },
        include: {
            role: true
        }
    });

    const crossUnitUserWithLinkedStaff = userWithLinkedStaff || await prisma.user.findFirst({
        where: {
            id: normalizedIdentifier,
            tenantId,
            isDeleted: false
        },
        include: {
            role: true
        }
    });

    if (crossUnitUserWithLinkedStaff) {
        const linkedStaff = await prisma.staff.findFirst({
            where: {
                userId: crossUnitUserWithLinkedStaff.id,
                tenantId,
                isDeleted: false
            },
            select: taskStaffSelect
        });

        if (linkedStaff) {
            return {
                ...crossUnitUserWithLinkedStaff,
                staff: linkedStaff
            };
        }
    }

    const staff = await prisma.staff.findFirst({
        where: {
            OR: [
                { id: normalizedIdentifier },
                { userId: normalizedIdentifier },
                { empId: normalizedIdentifier }
            ],
            tenantId,
            isDeleted: false
        },
        include: {
            user: {
                include: {
                    role: true
                }
            }
        }
    });

    return staff?.user
        ? {
            ...staff.user,
            staff
        }
        : null;
};

export const resolveAssignableStaffContext = async (tenantId, unitId, assigneeId) => {
    if (!assigneeId) return null;

    const user = await resolveStaffLinkedUser(tenantId, unitId, assigneeId);

    if (!user || !user.staff) {
        throw buildHttpError('Staff has no login. Enable login during onboarding.');
    }

    if (!user.isActive) {
        throw buildHttpError('Staff login is disabled. Reactivate login before scheduling tasks.');
    }

    if (!user.roleId || !user.role) {
        throw buildHttpError('Staff has no privilege assigned. Assign a role before scheduling tasks.');
    }

    if (!hasConfiguredMenuPrivilege(user.staff.metadata)) {
        throw buildHttpError('Staff has no menu privilege configured. Configure menu privilege before scheduling tasks.');
    }

    return {
        userId: user.id,
        staffId: user.staff.id,
        user
    };
};

const ensureApprovalAuthorityUser = async (tenantId, unitId, approvalAuthorityId) => {
    if (!approvalAuthorityId) return null;

    const user = await resolveStaffLinkedUser(tenantId, unitId, approvalAuthorityId);

    if (!user || !user.isActive) {
        throw buildHttpError('Invalid approval authority selected');
    }

    return user.id;
};

export const createTask = async (tenantId, unitId, data) => {
    if (!data.assigneeId) {
        throw buildHttpError('Assignee is required for manual task creation.');
    }

    const assigneeContext = await resolveAssignableStaffContext(tenantId, unitId, data.assigneeId);
    const approvalAuthorityUserId = await ensureApprovalAuthorityUser(tenantId, unitId, data.approvalAuthorityId);

    return prisma.task.create({
        data: {
            refNo: `TSK-${Date.now()}`,
            title: data.title,
            description: data.description,
            type: data.type,
            priority: data.priority || 'MEDIUM',
            assigneeId: assigneeContext?.userId || null,
            assignedStaffId: assigneeContext?.staffId || null,
            approvalAuthorityId: approvalAuthorityUserId || null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            tenantId,
            unitId,
            status: 'ASSIGNED'
        }
    });
};

export const createAITaskFromEnquiry = async (tenantId, unitId, data) => {
    if (!data?.enquiryId) {
        throw buildHttpError('enquiryId is required for AI task creation.');
    }

    if (!data?.title || !data?.type || !data?.priority) {
        throw buildHttpError('AI task generation failed');
    }

    await ensureApprovalAuthorityUser(tenantId, unitId, data.approvalAuthorityId);

    return prisma.task.create({
        data: {
            refNo: `TSK-${Date.now()}`,
            title: data.title,
            description: data.description || data.title,
            type: data.type,
            priority: data.priority,
            aiSummary: data.aiSummary || data.title,
            aiUrgency: data.aiUrgency || data.priority,
            enquiryId: data.enquiryId,
            approvalAuthorityId: data.approvalAuthorityId || null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            tenantId,
            unitId,
            status: 'ASSIGNED'
        }
    });
};

export const getTasks = async (tenantId, unitId, filters = {}) => {
    const where = { tenantId, isDeleted: false, ...filters };

    // If we're looking for tasks for a specific assignee, allow searching across all units in the tenant.
    // Otherwise, restrict to the current unit.
    if (!filters.assigneeId && unitId) {
        where.unitId = unitId;
    }

    return prisma.task.findMany({
        where,
        include: {
            assignee: {
                include: {
                    staff: {
                        select: taskStaffSelect
                    }
                }
            },
            approvalAuthority: {
                include: {
                    staff: {
                        select: taskStaffSelect
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const updateTaskStatus = async (id, tenantId, unitId, status, feedbackScore = null) => {
    const existing = await prisma.task.findFirst({
        where: { id, tenantId, unitId, isDeleted: false },
        select: { id: true, assigneeId: true }
    });
    if (!existing) {
        const error = new Error('Task not found');
        error.status = 404;
        throw error;
    }

    const task = await prisma.task.update({
        where: { id },
        data: {
            status,
            feedbackScore: feedbackScore !== null ? feedbackScore : undefined,
            completedAt: (status === 'COMPLETED' || status === 'APPROVED') ? new Date() : undefined
        }
    });

    if (task.assigneeId) {
        await StaffIntelligenceService.updateStaffIntelligence(task.assigneeId);
    }

    return task;
};
