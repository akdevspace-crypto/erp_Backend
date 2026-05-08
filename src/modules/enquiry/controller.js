import { createEnquiry, listEnquiries, updateEnquiry, deleteEnquiry, addFollowUp, getEnquiry } from './service.js';
import { enquirySchema, followUpSchema } from './schema.js';
import { success } from '../../shared/utils/response.js';
import { paginate } from '../../shared/utils/paginate.js';

export const handleCreateEnquiry = async (req, res, next) => {
    try {
        const validatedData = enquirySchema.parse(req.body);
        const result = await createEnquiry(validatedData, req.user);

        return success(res, result, { message: 'Enquiry created successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleListEnquiries = async (req, res, next) => {
    try {
        const { page, limit, search, status } = req.query;
        const pagination = paginate({ page, limit });

        const result = await listEnquiries({
            ...pagination,
            search,
            status
        }, req.user);

        return success(res, result.data, { total: result.count, message: 'Enquiries fetched successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetEnquiry = async (req, res, next) => {
    try {
        const result = await getEnquiry(req.params.id, req.user);
        if (!result) {
            const error = new Error('Enquiry not found');
            error.status = 404;
            throw error;
        }
        return success(res, result, { message: 'Enquiry fetched successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleUpdateEnquiry = async (req, res, next) => {
    try {
        const result = await updateEnquiry(req.params.id, req.body, req.user);
        return success(res, result, { message: 'Enquiry updated successfully' });
    } catch (error) { next(error); }
};

export const handleDeleteEnquiry = async (req, res, next) => {
    try {
        const result = await deleteEnquiry(req.params.id, req.user);
        return success(res, result, { message: 'Enquiry deleted successfully' });
    } catch (error) { next(error); }
};

export const handleAddFollowUp = async (req, res, next) => {
    try {
        const validatedData = followUpSchema.parse(req.body);
        const result = await addFollowUp(req.params.id, validatedData, req.user);
        return success(res, result, { message: 'Follow-up created successfully' });
    } catch (error) { next(error); }
};
