import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getContext } from "../../shared/utils/context.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: Redis;

const getConnection = () => {
    if (!connection) {
        connection = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null
        });
        connection.on("connect", () => console.log("Automation Redis connected"));
        connection.on("error", (err: any) => console.error("Automation Redis error:", err));
    }
    return connection;
};

export const queue = new Queue("automation", {
    get connection() { return getConnection(); }
} as any);

export const addAutomationJob = async (data: any) => {
    const context = getContext();

    return await queue.add("process_event", {
        ...data,
        tenantId: data.tenantId || context?.tenantId,
        unitId: data.unitId || context?.unitId,
        userId: data.userId || context?.userId,
        _context: context
    });
};
