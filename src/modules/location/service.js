import { prisma } from '../../app/prisma.js';

const ensureLocationModelAvailable = () => {
    if (!prisma?.location) {
        const error = new Error('Location system is not yet activated on the server. Run the Prisma migration and regenerate Prisma Client.');
        error.status = 503;
        error.code = 'LOCATION_SYSTEM_NOT_READY';
        throw error;
    }
};

const normalizeLocation = (location) => ({
    id: location.id,
    name: location.name,
    state: location.state,
    country: location.country,
    pincode: location.pincode || null,
    label: `${location.name}, ${location.state}, ${location.country}`
});

export const searchLocations = async (query) => {
    ensureLocationModelAvailable();

    const q = String(query || '').trim();
    if (!q) {
        return [];
    }

    const locations = await prisma.location.findMany({
        where: {
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { state: { contains: q, mode: 'insensitive' } },
                { country: { contains: q, mode: 'insensitive' } },
                { pincode: { contains: q, mode: 'insensitive' } }
            ]
        },
        orderBy: [
            { country: 'asc' },
            { state: 'asc' },
            { name: 'asc' }
        ],
        take: 15
    });

    return locations.map(normalizeLocation);
};

export const createLocation = async (data) => {
    ensureLocationModelAvailable();

    const location = await prisma.location.upsert({
        where: {
            name_state_country_pincode: {
                name: data.name,
                state: data.state,
                country: data.country,
                pincode: data.pincode || null
            }
        },
        update: {
            name: data.name,
            state: data.state,
            country: data.country,
            pincode: data.pincode || null
        },
        create: {
            name: data.name,
            state: data.state,
            country: data.country,
            pincode: data.pincode || null
        }
    });

    return normalizeLocation(location);
};

export const getLocationById = async (id) => {
    ensureLocationModelAvailable();

    const location = await prisma.location.findUnique({
        where: { id }
    });

    if (!location) {
        const error = new Error('Location not found');
        error.status = 404;
        throw error;
    }

    return normalizeLocation(location);
};
