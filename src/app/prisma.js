import { PrismaClient } from "../generated/prisma/index.js";

const buildPrismaClientOptions = () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return {};

    try {
        const parsed = new URL(databaseUrl);
        const isSupabaseDirectHost = /^db\..+\.supabase\.co$/i.test(parsed.hostname);
        const isPoolerHost = /\.pooler\.supabase\.com$/i.test(parsed.hostname);
        const preferredPoolerHost = process.env.SUPABASE_POOLER_HOST?.trim() || 'aws-0-ap-south-1.pooler.supabase.com';

        if (isSupabaseDirectHost && !isPoolerHost) {
            parsed.hostname = preferredPoolerHost;
            parsed.port = '6543';
        }

        // Reduce transient connect errors on slower or unstable networks.
        if (!parsed.searchParams.has("connect_timeout")) {
            parsed.searchParams.set("connect_timeout", "30");
        }

        if (!parsed.searchParams.has("pool_timeout")) {
            parsed.searchParams.set("pool_timeout", "30");
        }

        if (!parsed.searchParams.has("pgbouncer")) {
            parsed.searchParams.set("pgbouncer", "true");
        }

        if (!parsed.searchParams.has("connection_limit")) {
            parsed.searchParams.set("connection_limit", "1");
        }

        // Optional local override, e.g. DATABASE_SSL_MODE=disable
        const sslModeOverride = process.env.DATABASE_SSL_MODE?.trim();
        if (sslModeOverride) {
            parsed.searchParams.set("sslmode", sslModeOverride);
        } else if (!parsed.searchParams.has("sslmode")) {
            parsed.searchParams.set("sslmode", "require");
        }

        const resolvedUrl = parsed.toString();
        if (resolvedUrl === databaseUrl) return {};

        return {
            datasources: {
                db: {
                    url: resolvedUrl
                }
            }
        };
    } catch {
        return {};
    }
};

const prismaClientOptions = buildPrismaClientOptions();

/** @type {PrismaClient} */
let prisma;

if (process.env.NODE_ENV === "production") {
    prisma = new PrismaClient(prismaClientOptions);
} else {
    if (!global.prisma) {
        global.prisma = new PrismaClient(prismaClientOptions);
    }
    prisma = global.prisma;
}

export { prisma };
