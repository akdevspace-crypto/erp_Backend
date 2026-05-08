import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../../shared/services/logger.js";

const queueLogger = logger.child({ scope: "call-event-queues" });
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection;
let workersStarted = false;

const getConnection = () => {
    if (!connection) {
        connection = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false
        });
        connection.on("error", (error) => queueLogger.error("Call queue Redis error", { error }));
    }

    return connection;
};

const queueOptions = {
    get connection() {
        return getConnection();
    },
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 }
    }
};

export const callEventsQueue = new Queue("call-events", queueOptions);
export const analyticsEventsQueue = new Queue("analytics-events", queueOptions);
export const webhookEventsQueue = new Queue("webhook-events", queueOptions);
export const recordingSyncQueue = new Queue("recording-sync", queueOptions);
export const notificationEventsQueue = new Queue("notification-events", queueOptions);

export const addWebhookEventJob = (data) => webhookEventsQueue.add("provider-webhook", data);
export const addCallEventJob = (data) => callEventsQueue.add("call-event", data);
export const addAnalyticsEventJob = (data) => analyticsEventsQueue.add("analytics-event", data);
export const addRecordingSyncJob = (data) => recordingSyncQueue.add("recording-sync", data);
export const addNotificationEventJob = (data) => notificationEventsQueue.add("notification-event", data);

export const startCallQueueWorkers = () => {
    if (workersStarted) return [];
    workersStarted = true;

    const connection = getConnection();
    const workers = [
        new Worker("webhook-events", async (job) => {
            if (job.data?.provider === "exotel") {
                const { ExotelController } = await import("../exotel/controller.js");
                return ExotelController.processExotelCallEvent(job.data.request);
            }
            if (job.data?.provider === "twilio") {
                const { TwilioController } = await import("../twilio/controller.js");
                return TwilioController.processCallWebhookEvent(job.data.request);
            }
            return { skipped: true };
        }, { connection, concurrency: 10 }),
        new Worker("call-events", async (job) => job.data, { connection, concurrency: 10 }),
        new Worker("analytics-events", async (job) => job.data, { connection, concurrency: 5 }),
        new Worker("recording-sync", async (job) => job.data, { connection, concurrency: 3 }),
        new Worker("notification-events", async (job) => job.data, { connection, concurrency: 10 })
    ];

    workers.forEach((worker) => {
        worker.on("failed", (job, error) => queueLogger.error("Call queue job failed", { queue: worker.name, jobId: job?.id, error }));
        worker.on("error", (error) => queueLogger.error("Call queue worker error", { queue: worker.name, error }));
    });

    queueLogger.info("Call queue workers started");
    return workers;
};
