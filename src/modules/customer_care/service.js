import { prisma } from '../../app/prisma.js';
import { generateRefNumber as generateRef } from '../../shared/utils/refGenerator.js';
import { ComplaintIntelligenceService } from '../../intelligence/services/complaint-intelligence.service.js';


export const createComplaint = async (tenantId, data) => {
    const refNo = await generateRef('CMP', tenantId, data.unitId);
    const intelligence = await ComplaintIntelligenceService.analyzeComplaint(data);

    return prisma.complaint.create({
        data: {
            refNo,
            title: `${data.category} complaint from ${data.clientName}`,
            type: data.category || null,
            description: data.description,
            status: "OPEN",
            priority: data.priority || null,
            channel: data.metadata?.channel || null,
            channelId: data.metadata?.channelId || null,
            sentiment: intelligence.sentiment,
            urgency: intelligence.urgency,
            serviceTag: intelligence.serviceTag,
            metadata: {
                clientName: data.clientName,
                category: data.category,
                priority: data.priority,
                assignedTo: data.assignedTo || null,
                intelligence,
                attachmentUrl: data.attachmentUrl || null
            },
            unitId: data.unitId,
            tenantId,
        }
    });
};

export const getComplaints = async (tenantId, unitId) => {
    return prisma.complaint.findMany({
        where: { tenantId, unitId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};
