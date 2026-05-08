import { createAllocation, getAllocationsByType, updateAllocation } from './service.js';
import { success } from '../../shared/utils/response.js';
import { allocationSchema } from './schema.js';

export const handleCreateAllocation = async (req, res, next) => {
    try {
        const data = allocationSchema.parse(req.body);
        const allocation = await createAllocation(req.user.tenantId, req.user.unitId, data);
        return success(res, allocation, { message: 'Allocation successfully assigned' });
    } catch (error) {
        next(error);
    }
};

export const handleGetHomeCareAllocations = async (req, res, next) => {
    try {
        const allocations = await getAllocationsByType(req.user.tenantId, req.user.unitId, 'HOME_CARE');
        return success(res, allocations);
    } catch (error) {
        next(error);
    }
};

export const handleGetClinicalCareAllocations = async (req, res, next) => {
    try {
        const allocations = await getAllocationsByType(req.user.tenantId, req.user.unitId, 'CLINICAL');
        return success(res, allocations);
    } catch (error) {
        next(error);
    }
};

export const handleGetInHouseCareAllocations = async (req, res, next) => {
    try {
        const allocations = await getAllocationsByType(req.user.tenantId, req.user.unitId, 'IN_HOUSE');
        return success(res, allocations);
    } catch (error) {
        next(error);
    }
};

export const handleGetOthersCareAllocations = async (req, res, next) => {
    try {
        const allocations = await getAllocationsByType(req.user.tenantId, req.user.unitId, 'OTHERS');
        return success(res, allocations);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateAllocation = async (req, res, next) => {
    try {
        const updated = await updateAllocation(req.user.tenantId, req.user.unitId, req.params.id, req.body);
        return success(res, updated, { message: 'Allocation updated successfully' });
    } catch (error) {
        next(error);
    }
};
