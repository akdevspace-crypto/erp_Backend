import { Queue } from "bullmq";
import { Redis } from "ioredis";
import dotenv from "dotenv";
import { getOutboundQueueEnv } from "../config/omnichannel.js";
import { logger } from "../shared/services/logger.js";

dotenv.config();

const queueLogger = logger.child({ scope: "outbound-queue" });

let connection: Redis | null = null;
let outboundQueue: Queue | null = null;

export const getOutboundQueueConnection = () => {
    if (!connection) {
        const env = getOutboundQueueEnv();
        connection = new Redis(env.REDIS_URL, {
            maxRetriesPerRequest: null
        });

        connection.on("error", (err) => {
            queueLogger.error("Redis outbound queue connection error", { error: err });
        });
    }

    return connection;
};

export const getOutboundQueue = () => {
    if (!outboundQueue) {
        const env = getOutboundQueueEnv();

        outboundQueue = new Queue("outbound", {
            connection: getOutboundQueueConnection(),
            defaultJobOptions: {
                attempts: env.OUTBOUND_QUEUE_ATTEMPTS,
                backoff: {
                    type: "exponential",
                    delay: env.OUTBOUND_QUEUE_BACKOFF_MS
                },
                removeOnComplete: {
                    count: env.OUTBOUND_REMOVE_ON_COMPLETE_COUNT
                },
                removeOnFail: {
                    count: env.OUTBOUND_REMOVE_ON_FAIL_COUNT
                }
            }
        });
    }

    return outboundQueue;
};
