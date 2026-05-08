import { createTask, getTasks, updateTaskStatus } from './service.js';
import { success } from '../../shared/utils/response.js';
import { taskSchema, updateTaskStatusSchema } from './schema.js';
import { emitEvent, EVENTS } from '../event/service.js';

export const handleCreateTask = async (req, res, next) => {
    try {
        const data = taskSchema.parse(req.body);
        const task = await createTask(
            req.tenantId || req.context?.tenantId || req.user.tenantId,
            req.unitId || req.context?.unitId || req.user.unitId,
            data
        );
        emitEvent(EVENTS.TASK_CREATED, { task });
        return success(res, task, { message: 'Task successfully assigned' });
    } catch (error) {
        next(error);
    }
};

export const handleGetTasks = async (req, res, next) => {
    try {
        const filters = {};
        if (req.query.type) filters.type = req.query.type;
        if (req.query.status) filters.status = req.query.status;
        if (req.query.approvalAuthorityId) filters.approvalAuthorityId = req.query.approvalAuthorityId;
        if (req.query.assigneeId) filters.assigneeId = req.query.assigneeId;

        const tasks = await getTasks(
            req.tenantId || req.context?.tenantId || req.user.tenantId,
            req.unitId || req.context?.unitId || req.user.unitId,
            filters
        );
        return success(res, tasks);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateTaskStatus = async (req, res, next) => {
    try {
        const { status } = updateTaskStatusSchema.parse(req.body);
        const task = await updateTaskStatus(
            req.params.id,
            req.tenantId || req.context?.tenantId || req.user.tenantId,
            req.unitId || req.context?.unitId || req.user.unitId,
            status
        );
        return success(res, task, { message: 'Task status updated' });
    } catch (error) {
        next(error);
    }
};
