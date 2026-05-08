import { createClientAndEnquiryQuery, listEnquiriesQuery, updateEnquiryQuery, deleteEnquiryQuery, addFollowUpQuery, getEnquiryQuery } from './repository.js';
import { emitEvent, EVENTS } from '../event/service.js';
import { logWorkflow } from '../workflow/service.js';
import { sendNotification } from '../notification/service.js';
import { FeedbackLearningService } from '../../intelligence/services/feedback-learning.service.js';
import { ScoringEngine } from '../../intelligence/services/scoring.engine.js';

export const createEnquiry = async (data, user) => {
    const enquiry = await createClientAndEnquiryQuery(data, user.tenantId, user.unitId);

    emitEvent(EVENTS.ENQUIRY_CREATED, { enquiry, user });

    // 🧠 AI Automation: Generate initial lead score
    try {
        await ScoringEngine.calculateScore(enquiry.id, 'enquiry', {
            tenantId: user.tenantId,
            unitId: user.unitId
        });
    } catch (scoreError) {
        console.error('Initial lead scoring failed:', scoreError);
    }

    logWorkflow({
        entityType: 'ENQUIRY',
        entityId: enquiry.id,
        toState: 'NEW',
        actionBy: user.id,
        tenantId: user.tenantId,
        unitId: user.unitId
    });

    return enquiry;
};

export const listEnquiries = async (query, user) => {
    return listEnquiriesQuery({
        tenantId: user.tenantId,
        unitId: user.unitId,
        skip: query.skip,
        take: query.take,
        search: query.search,
        status: query.status
    });
};

export const getEnquiry = async (id, user) => {
    return getEnquiryQuery(id, user.tenantId, user.unitId);
};

export const updateEnquiry = async (id, data, user) => {
    const updated = await updateEnquiryQuery(id, data, user.tenantId, user.unitId);

    // 🚀 Feedback Loop: Capture signals if converted or lost
    if (updated.status === 'CONVERTED' || updated.status === 'LOST') {
        const isConverted = updated.status === 'CONVERTED';
        await FeedbackLearningService.captureModuleFeedback({
            tenantId: user.tenantId,
            unitId: user.unitId,
            module: 'enquiry',
            entityId: id,
            event: `ENQUIRY_${updated.status}`,
            signals: {
                conversionRate: isConverted ? 1 : 0,
                completionRate: 1,
                responseRate: 1 // If converted/lost, at least they responded
            }
        });
    }

    return updated;
};

export const deleteEnquiry = async (id, user) => {
    const deleted = await deleteEnquiryQuery(id, user.tenantId, user.unitId);
    return deleted;
};

export const addFollowUp = async (id, data, user) => {
    const followUp = await addFollowUpQuery(id, data, user.tenantId, user.unitId, user.id);

    if (followUp.assignedUserId) {
        try {
            await sendNotification({
                userId: followUp.assignedUserId,
                type: 'ENQUIRY_FOLLOW_UP_ASSIGNED',
                message: `You are allocated to enquiry ${followUp.enquiryRefNo || id}${followUp.clientName ? ` for ${followUp.clientName}` : ''}. Please follow up with this client and update the enquiry progress.`,
                tenantId: user.tenantId,
                unitId: user.unitId
            });
        } catch (notificationError) {
            console.error('Follow-up saved but notification dispatch failed:', notificationError);
        }
    }

    emitEvent(EVENTS.ENQUIRY_FOLLOW_UP, { enquiryId: id, followUp, user });

    return followUp;
};
