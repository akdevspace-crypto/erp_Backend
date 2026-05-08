import { Redis } from "ioredis";
import { logger } from "./logger.js";

export const createRedisConnection = (component) => {
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
        throw new Error("REDIS_URL is required to initialize Redis connections");
    }

    const connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null
    });

    const componentLogger = logger.child({
        component,
        subsystem: "redis"
    });

    connection.on("connect", () => {
        componentLogger.info("Redis connected");
    });

    connection.on("error", (error) => {
        componentLogger.error("Redis connection error", { error });
    });

    return connection;
};
