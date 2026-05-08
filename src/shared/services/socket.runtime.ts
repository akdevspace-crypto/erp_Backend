import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Emitter } from "@socket.io/redis-emitter";
import { Server as HttpServer } from "http";
// @ts-ignore jsonwebtoken is used from the existing JS runtime package.
import jwt from "jsonwebtoken";

let io: Server;
let callsNamespace: any;
let emitter: Emitter;

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JWT_SECRET = process.env.JWT_SECRET || "supersecretjwtkeyforerpsystem";

const normalizeScopeValue = (value: unknown) => String(value || "").trim();
const buildTenantRoom = (tenantId: string) => `tenant:${tenantId}`;
const buildUnitRoom = (tenantId: string, unitId: string) => `${buildTenantRoom(tenantId)}:unit:${unitId}`;

const normalizeConversationRoom = (conversationId: string) =>
    String(conversationId || "").startsWith("conversation:")
        ? String(conversationId)
        : `conversation:${conversationId}`;

const resolveAudienceRoom = (data: any) => {
    const tenantId = normalizeScopeValue(data?.tenantId);
    const unitId = normalizeScopeValue(data?.unitId);

    if (!tenantId) return null;
    if (unitId && unitId !== "ALL") {
        return buildUnitRoom(tenantId, unitId);
    }

    return buildTenantRoom(tenantId);
};

const emitScopedEvent = (target: any, eventName: string, data: any) => {
    const room = resolveAudienceRoom(data);

    if (room && typeof target?.to === "function") {
        target.to(room).emit(eventName, data);
        return room;
    }

    target.emit(eventName, data);
    return null;
};

const resolveSocketContext = (socket: any) => {
    const auth = socket?.handshake?.auth || {};
    const token = typeof auth?.token === "string" ? auth.token.trim() : "";

    if (!token) return null;

    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const tenantId = normalizeScopeValue(decoded?.tenantId);
        const requestedUnitId = normalizeScopeValue(auth?.unitId);
        const fallbackUnitId = normalizeScopeValue(decoded?.unitId);
        const unitId = requestedUnitId || fallbackUnitId || "";

        if (!tenantId) return null;

        return {
            userId: normalizeScopeValue(decoded?.id),
            tenantId,
            unitId
        };
    } catch (error) {
        console.warn("[SOCKET] Failed to resolve authenticated socket context", error);
        return null;
    }
};

export const initSocket = async (server: HttpServer) => {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => console.error("[SOCKET] pubClient error:", err));
    subClient.on("error", (err) => console.error("[SOCKET] subClient error:", err));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true
        },
        adapter: createAdapter(pubClient, subClient)
    });

    console.log("[SOCKET] Socket.io initialized with Redis adapter");

    callsNamespace = io.of("/calls");

    callsNamespace.on("connection", (socket: any) => {
        console.log(`[SOCKET:/calls] Client connected: ${socket.id}`);
        const context = resolveSocketContext(socket);
        if (context?.tenantId) {
            socket.data.context = context;
            socket.join(buildTenantRoom(context.tenantId));
            if (context.unitId && context.unitId !== "ALL") {
                socket.join(buildUnitRoom(context.tenantId, context.unitId));
            }
            if (context.userId) socket.join(`agent:${context.userId}`);
        }

        socket.on("join:global:calls", () => {
            socket.join("global:calls");
            console.log(`[SOCKET:/calls] Client ${socket.id} joined global:calls`);
        });
        socket.on("join:conversation", (conversationId: string) => {
            if (conversationId) socket.join(normalizeConversationRoom(conversationId));
        });
        socket.on("leave:conversation", (conversationId: string) => {
            if (conversationId) socket.leave(normalizeConversationRoom(conversationId));
        });
        socket.on("join:agent", (agentId: string) => {
            if (agentId) socket.join(`agent:${agentId}`);
        });
        socket.on("join:department", (departmentId: string) => {
            if (departmentId) socket.join(`department:${departmentId}`);
        });
        socket.on("presence:update", (payload: any) => {
            const room = payload?.departmentId ? `department:${payload.departmentId}` : undefined;
            const event = { ...payload, userId: payload?.userId || context?.userId, updatedAt: new Date().toISOString() };
            if (room) socket.to(room).emit("agent:presence", event);
            callsNamespace.emit("agent:presence", event);
        });
    });

    io.on("connection", (socket) => {
        console.log(`[SOCKET] Client connected: ${socket.id}`);

        const context = resolveSocketContext(socket);
        if (context?.tenantId) {
            socket.data.context = context;
            socket.join(buildTenantRoom(context.tenantId));

            if (context.unitId && context.unitId !== "ALL") {
                socket.join(buildUnitRoom(context.tenantId, context.unitId));
            }
        } else {
            console.warn(`[SOCKET] Client ${socket.id} connected without tenant scope`);
        }

        socket.on("disconnect", () => {
            console.log(`[SOCKET] Client disconnected: ${socket.id}`);
        });

        // Room Management
        socket.on("join", (room: string) => {
            if (room) {
                socket.join(room);
                console.log(`[SOCKET] Client ${socket.id} joined room: ${room}`);
            }
        });

        socket.on("join:conversation", (conversationId: string) => {
            if (conversationId) {
                socket.join(conversationId);
                console.log(`[SOCKET] Client ${socket.id} joined conversation room: ${conversationId}`);
            }
        });

        socket.on("leave", (room: string) => {
            if (room) {
                socket.leave(room);
                console.log(`[SOCKET] Client ${socket.id} left room: ${room}`);
            }
        });

        socket.on("leave:conversation", (conversationId: string) => {
            if (conversationId) {
                socket.leave(conversationId);
                console.log(`[SOCKET] Client ${socket.id} left conversation room: ${conversationId}`);
            }
        });

        // Omnichannel Typing Indicators
        socket.on("typing:start", (payload: any) => {
            if (payload?.conversationId) {
                socket.to(payload.conversationId).emit("typing:start", payload);
            } else {
                io.emit("typing:start", payload);
            }
        });

        socket.on("typing:stop", (payload: any) => {
            if (payload?.conversationId) {
                socket.to(payload.conversationId).emit("typing:stop", payload);
            } else {
                io.emit("typing:stop", payload);
            }
        });

        socket.on("chat:call:initiate", (payload: any) => {
            console.log(`[SOCKET] Call initiated by ${payload.senderName} in room ${payload.conversationId}`);
            io.emit("chat:call:broadcast", payload);
        });
    });

    return io;
};

export const initEmitter = async () => {
    const redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", (err) => console.error("[SOCKET] emitter redisClient error:", err));
    await redisClient.connect();
    emitter = new Emitter(redisClient);
    console.log("[SOCKET] Socket.io emitter initialized");
    return emitter;
};

export const emitAutomationUpdate = (data: any) => {
    if (io) {
        const room = emitScopedEvent(io, "automation:update", data);
        console.log("[SOCKET] WebSocket emitted (Direct): automation:update", data.entityId, room || "global");
    } else if (emitter) {
        const room = emitScopedEvent(emitter, "automation:update", data);
        console.log("[SOCKET] WebSocket emitted (Redis Emitter): automation:update", data.entityId, room || "global");
    } else {
        console.warn("[SOCKET] WebSocket emission failed: neither IO nor emitter initialized");
    }
};

export const emitRealtimeEvent = (eventName: string, data: any) => {
    if (io) {
        const room = emitScopedEvent(io, eventName, data);
        console.log(`[SOCKET] WebSocket emitted (Direct): ${eventName}${room ? ` -> ${room}` : " -> global"}`);
    } else if (emitter) {
        const room = emitScopedEvent(emitter, eventName, data);
        console.log(`[SOCKET] WebSocket emitted (Redis Emitter): ${eventName}${room ? ` -> ${room}` : " -> global"}`);
    } else {
        console.warn(`[SOCKET] WebSocket emission failed for ${eventName}: neither IO nor emitter initialized`);
    }
};

export const emitRoomEvent = (room: string, eventName: string, data: any) => {
    if (io) {
        io.to(room).emit(eventName, data);
        console.log(`[SOCKET] WebSocket room emitted (Direct) [${room}]: ${eventName}`);
    } else if (emitter) {
        emitter.to(room).emit(eventName, data);
        console.log(`[SOCKET] WebSocket room emitted (Redis Emitter) [${room}]: ${eventName}`);
    } else {
        console.warn(`[SOCKET] WebSocket emission failed for ${eventName} in ${room}: neither IO nor emitter initialized`);
    }
};

export const emitCallsEvent = (room: string | null, eventName: string, data: any) => {
    const target = callsNamespace || io?.of?.("/calls");
    if (!target) {
        console.warn(`[SOCKET:/calls] Emit failed for ${eventName}: namespace unavailable`);
        return;
    }

    if (room) {
        target.to(room).emit(eventName, data);
        console.log(`[SOCKET:/calls] emitted ${eventName} -> ${room}`);
        return;
    }

    target.emit(eventName, data);
    console.log(`[SOCKET:/calls] emitted ${eventName} -> namespace`);
};

export const getIO = () => io;
export const getCallsNamespace = () => callsNamespace;
export const getEmitter = () => emitter;
