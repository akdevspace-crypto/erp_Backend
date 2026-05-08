import {
    createStaff,
    getStaff,
    getRoles,
    getStaffPerformance,
    getAttendanceLogs,
    updateStaff,
    createStaffLogin,
    updateStaffPrivilege,
    updateStaffMenuPrivilege,
    deleteStaff,
    createJobApplication,
    updateJobApplication,
    getJobApplications,
    deleteJobApplication,
    persistStaffDocuments
} from './service.js';
import { success } from '../../shared/utils/response.js';
import { staffSchema, staffPrivilegeSchema, jobApplicationSchema, createStaffLoginSchema, staffMenuPrivilegeSchema } from './schema.js';

const normalizeStaffPayload = (body = {}) => {
    const normalized = { ...body };

    if (typeof normalized.createLogin === 'string') {
        const createLoginValue = normalized.createLogin.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(createLoginValue)) {
            normalized.createLogin = true;
        } else if (['false', '0', 'no', 'off', ''].includes(createLoginValue)) {
            normalized.createLogin = false;
        }
    }

    if (typeof normalized.metadata === 'string') {
        try {
            normalized.metadata = JSON.parse(normalized.metadata);
        } catch {
            normalized.metadata = {};
        }
    }

    return normalized;
};

export const handleCreateStaff = async (req, res, next) => {
    try {
        const data = staffSchema.parse(normalizeStaffPayload(req.body));
        console.log('BODY UNIT:', req.body.unitId);
        const tenantId = req.context?.tenantId || req.user.tenantId;
        const unitId = req.context?.unitId || req.user.unitId;
        let staff = await createStaff(tenantId, data, req.files || {});
        if (req.files && Object.keys(req.files).length > 0) {
            staff = await persistStaffDocuments({
                tenantId,
                unitId: staff.unitId || unitId,
                staffId: staff.id,
                files: req.files,
                existingMetadata: staff.metadata
            });
        }
        return success(res, staff, { message: 'Staff member onboarded successfully' }, 201);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateStaff = async (req, res, next) => {
    try {
        const data = staffSchema.parse(normalizeStaffPayload(req.body));
        const tenantId = req.context?.tenantId || req.user.tenantId;
        const unitId = req.context?.unitId || req.user.unitId;
        let staff = await updateStaff(tenantId, req.params.id, data, req.files || {});
        if (req.files && Object.keys(req.files).length > 0) {
            staff = await persistStaffDocuments({
                tenantId,
                unitId: staff.unitId || unitId,
                staffId: staff.id,
                files: req.files,
                existingMetadata: staff.metadata
            });
        }
        return success(res, staff, { message: 'Staff member updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetStaff = async (req, res, next) => {
    try {
        const includeFormer = String(req.query.includeFormer || '').toLowerCase() === 'true';
        const staff = await getStaff(
            req.context?.tenantId || req.user.tenantId,
            req.context?.unitId || req.user.unitId,
            { includeFormer }
        );
        return success(res, staff);
    } catch (error) {
        next(error);
    }
};

export const handleGetRoles = async (req, res, next) => {
    try {
        const tenantId = req.context?.tenantId || req.user?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID is required' });
        }
        const roles = await getRoles(tenantId);
        return success(res, roles);
    } catch (error) {
        next(error);
    }
};

export const handleGetStaffPerformance = async (req, res, next) => {
    try {
        const staff = await getStaffPerformance(req.context?.tenantId || req.user.tenantId, req.context?.unitId || req.user.unitId);
        return success(res, staff);
    } catch (error) {
        next(error);
    }
};

export const handleGetAttendanceLogs = async (req, res, next) => {
    try {
        const logs = await getAttendanceLogs(
            req.context?.tenantId || req.user.tenantId,
            req.context?.unitId || req.user.unitId,
            { date: req.query.date }
        );
        return success(res, logs);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateStaffPrivilege = async (req, res, next) => {
    try {
        const data = staffPrivilegeSchema.parse(req.body);
        const staff = await updateStaffPrivilege(req.context?.tenantId || req.user.tenantId, req.context?.unitId || req.user.unitId, req.params.id, data);
        return success(res, staff, { message: 'Staff privilege updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleCreateStaffLogin = async (req, res, next) => {
    try {
        const data = createStaffLoginSchema.parse(req.body);
        const staff = await createStaffLogin(req.context?.tenantId || req.user.tenantId, req.context?.unitId || req.user.unitId, req.params.id, data);
        return success(res, staff, { message: 'Staff login created and linked successfully' }, 201);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateStaffMenuPrivilege = async (req, res, next) => {
    try {
        const data = staffMenuPrivilegeSchema.parse(req.body);
        const staff = await updateStaffMenuPrivilege(req.context?.tenantId || req.user.tenantId, req.context?.unitId || req.user.unitId, req.params.id, data);
        return success(res, staff, { message: 'Staff menu privilege updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleDeleteStaff = async (req, res, next) => {
    try {
        await deleteStaff(req.user.tenantId, req.params.id);
        return success(res, null, { message: 'Staff member deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// --- Job Applications Controllers ---

export const handleCreateJobApplication = async (req, res, next) => {
    try {
        const data = jobApplicationSchema.parse(req.body);
        const application = await createJobApplication(req.context?.tenantId || req.user.tenantId, req.context?.unitId || req.user.unitId, data);
        return success(res, application, { message: 'Job application submitted successfully' }, 201);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateJobApplication = async (req, res, next) => {
    try {
        const data = jobApplicationSchema.partial().parse(req.body);
        const application = await updateJobApplication(req.context?.tenantId || req.user.tenantId, req.context?.unitId || req.user.unitId, req.params.id, data);
        return success(res, application, { message: 'Job application updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetJobApplications = async (req, res, next) => {
    try {
        const applications = await getJobApplications(req.context?.tenantId || req.user.tenantId, req.context?.unitId || req.user.unitId);
        return success(res, applications);
    } catch (error) {
        next(error);
    }
};

export const handleDeleteJobApplication = async (req, res, next) => {
    try {
        await deleteJobApplication(req.context?.tenantId || req.user.tenantId, req.context?.unitId || req.user.unitId, req.params.id);
        return success(res, null, { message: 'Job application deleted successfully' });
    } catch (error) {
        next(error);
    }
};
