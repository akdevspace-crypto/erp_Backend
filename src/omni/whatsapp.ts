import { OmniParser } from './parser.js';
import { EnquiryAutomation } from '../automation-engine/modules/enquiry/EnquiryAutomation.js';
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { ClientService } from '../modules/master/client/service.js';
// @ts-ignore
import { ConversationService } from '../intelligence/services/conversation.service.js';
import { prisma } from '../app/prisma.js';




export async function handleWhatsappWebhook(reqBody: any, tenantId: string, unitId: string) {
    const normalized = OmniParser.normalize('whatsapp', reqBody, tenantId, unitId);
    if (!normalized || !normalized.mobile) return { success: false, reason: 'Invalid payload or missing mobile' };

    // 1. Resolve Client
    const client = await ClientService.getOrCreateByPhone({
        mobile: normalized.mobile,
        tenantId,
        unitId
    });

    // 2. CRM Enquiry Creation (Find latest active or create new)
    let enquiry = await prisma.enquiry.findFirst({
        where: { clientId: client.id, tenantId, unitId, status: { not: 'CLOSED' } },
        orderBy: { createdAt: 'desc' }
    });

    if (!enquiry) {
        enquiry = await prisma.enquiry.create({
            data: {
                refNo: `ENQ-WA-${Date.now()}`,
                clientId: client.id,
                source: 'whatsapp',
                channelId: normalized.channelId,
                rawMessage: normalized.message,
                description: normalized.message,
                status: 'NEW',
                tenantId,
                unitId
            }
        });
    }

    // 3. Log to Unified Conversation System
    await ConversationService.appendMessage({
        tenantId,
        unitId,
        entityType: 'ENQUIRY',
        entityId: enquiry.id,
        clientId: client.id,
        enquiryId: enquiry.id,
        channel: 'whatsapp',
        direction: 'INBOUND',
        body: normalized.message,
        sender: normalized.mobile,
        channelId: normalized.channelId,
        rawPayload: normalized.rawPayload
    });

    // 4. Trigger Automation (Enqueues job)
    await EnquiryAutomation.onEnquiryCreated(tenantId, unitId, enquiry.id, normalized, 'whatsapp', normalized.channelId);

    return { success: true, enquiryId: enquiry.id };
}
