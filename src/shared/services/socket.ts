import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Emitter } from "@socket.io/redis-emitter";
import { Server as HttpServer } from "http";

let io: Server;
let emitter: Emitter;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const initSocket = async (server: HttpServer) => {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => console.error("[SOCKET] pubClient error:", err));
    subClient.on("error", (err) => console.error("[SOCKET] subClient error:", err));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        adapter: createAdapter(pubClient, subClient)
    });

    console.log("🔌 Socket.io initialized with Redis Adapter");

    io.on("connection", (socket) => {
        console.log(`👤 Client connected: ${socket.id}`);

        socket.on("disconnect", () => {
            console.log(`👤 Client disconnected: ${socket.id}`);
        });

        // Handle Internal Chat Calling (Redis-powered)
        socket.on("chat:call:initiate", (payload: any) => {
            console.log(`📞 Call initiated by ${payload.senderName} in room ${payload.conversationId}`);
            // Broadcast to all clients (Redis Adapter handles propagation across instances)
            io.emit("chat:call:broadcast", payload);
        });

        // Room Management
        socket.on("join", (room: string) => {
            if (room) {
                socket.join(room);
                console.log(`👤 Client ${socket.id} joined room: ${room}`);
            }
        });

        socket.on("leave", (room: string) => {
            if (room) {
                socket.leave(room);
                console.log(`👤 Client ${socket.id} left room: ${room}`);
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
    });

    return io;
};

export const initEmitter = async () => {
    const redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", (err) => console.error("[SOCKET] emitter redisClient error:", err));
    await redisClient.connect();
    emitter = new Emitter(redisClient);
    console.log("📡 Socket.io Emitter initialized (Redis)");
    return emitter;
};

export const emitAutomationUpdate = (data: any) => {
    // If io exists (same process as server), use it
    if (io) {
        io.emit("automation:update", data);
        console.log("📡 WebSocket emitted (Direct): automation:update", data.entityId);
    }
    // If emitter exists (worker process), use it
    else if (emitter) {
        emitter.emit("automation:update", data);
        console.log("📡 WebSocket emitted (Redis Emitter): automation:update", data.entityId);
    } else {
        console.warn("⚠️ WebSocket emission failed: Neither IO nor Emitter initialized");
    }
};

export const emitRealtimeEvent = (eventName: string, data: any) => {
    if (io) {
        io.emit(eventName, data);
        console.log(`📡 WebSocket emitted (Direct): ${eventName}`);
    } else if (emitter) {
        emitter.emit(eventName, data);
        console.log(`📡 WebSocket emitted (Redis Emitter): ${eventName}`);
    } else {
        console.warn(`⚠️ WebSocket emission failed for ${eventName}: Neither IO nor Emitter initialized`);
    }
};

export const emitRoomEvent = (room: string, eventName: string, data: any) => {
    if (io) {
        io.to(room).emit(eventName, data);
        console.log(`📡 WebSocket room emitted (Direct) [${room}]: ${eventName}`);
    } else if (emitter) {
        emitter.to(room).emit(eventName, data);
        console.log(`📡 WebSocket room emitted (Redis Emitter) [${room}]: ${eventName}`);
    } else {
        console.warn(`⚠️ WebSocket emission failed for ${eventName} in ${room}: Neither IO nor Emitter initialized`);
    }
};
export const getIO = () => io;
export const getEmitter = () => emitter;
