import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.error('❌ Redis Error:', err));

export const connectRedis = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log('🔌 Connected to Redis successfully');
    }
};

export const setCache = async (key: string, value: any, ttlSeconds = 3600) => {
    await connectRedis();
    await redisClient.set(key, JSON.stringify(value), {
        EX: ttlSeconds
    });
};

export const getCache = async <T>(key: string): Promise<T | null> => {
    await connectRedis();
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
};

export const deleteCache = async (key: string) => {
    await connectRedis();
    await redisClient.del(key);
};
