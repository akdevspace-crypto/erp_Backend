import { prisma } from "../../app/prisma.js";
import { emitRealtimeEvent } from "../../shared/services/socket.js";

export class InternalChatController {
    /**
     * List all staff members for starting a chat
     */
    static async listStaff(req: any, res: any) {
        try {
            const { tenantId, unitId } = req.user;
            const staff = await prisma.staff.findMany({
                where: {
                    tenantId,
                    ...(unitId !== 'ALL' ? { unitId } : {}),
                    isDeleted: false,
                    status: { in: ["Working", "Active"] },
                    userId: { not: null },
                    user: { isDeleted: false }
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    designation: true,
                    department: true,
                    userId: true,
                    photoUrl: true
                }
            });
            res.json({ success: true, data: staff });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Get or Create an internal conversation between two users
     */
    static async getOrCreateConversation(req: any, res: any) {
        try {
            const { tenantId, unitId, id: currentUserId } = req.user;
            const { targetUserId } = req.body;

            if (!targetUserId) {
                return res.status(400).json({ success: false, message: "targetUserId is required" });
            }

            // Internal entities are tracked by a pair of user IDs sorted to ensure uniqueness
            const pair = [currentUserId, targetUserId].sort();
            const entityId = `internal_${pair[0]}_${pair[1]}`;

            let conversation = await prisma.conversation.findFirst({
                where: {
                    tenantId,
                    entityType: "INTERNAL",
                    entityId
                },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        take: 50
                    }
                }
            });

            if (!conversation) {
                conversation = await prisma.conversation.create({
                    data: {
                        tenantId,
                        unitId,
                        entityType: "INTERNAL",
                        entityId,
                        channel: "INTERNAL",
                        status: "OPEN",
                        metadata: { participants: pair }
                    },
                    include: {
                        messages: true
                    }
                }) as any;
            }

            res.json({ success: true, data: conversation });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Send a message in an internal conversation
     */
    static async sendMessage(req: any, res: any) {
        try {
            const { tenantId, unitId, id: currentUserId, name: currentUserName } = req.user;
            const { conversationId, body } = req.body;

            if (!conversationId || !body) {
                return res.status(400).json({ success: false, message: "conversationId and body are required" });
            }

            const message = await prisma.message.create({
                data: {
                    tenantId,
                    unitId,
                    conversationId,
                    body,
                    sender: currentUserName || "Staff",
                    direction: "OUTBOUND", // For internal, we'll just use OUTBOUND relative to the sender
                    channel: "INTERNAL",
                    status: "SENT",
                    metadata: { senderId: currentUserId }
                }
            }) as any;

            // Update conversation lastMessageAt
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { lastMessageAt: new Date() }
            });

            // Emit via Socket.io (Redis Adapter will handle propagation)
            emitRealtimeEvent(`chat:${conversationId}`, {
                type: 'NEW_MESSAGE',
                tenantId,
                unitId,
                message
            });

            res.json({ success: true, data: message });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
