import { prisma } from '../../app/prisma.js';
import bcrypt from 'bcrypt';
import path from 'path';
import { uploadToSupabase } from '../../shared/utils/supabase.js';
import { saveFileMetadata } from '../storage/service.js';

const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const normalizeOptionalString = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
};

const resolveLoginRoleIdentifier = (payload = {}) => (
    normalizeOptionalString(payload.loginRoleId) || normalizeOptionalString(payload.roleId)
);

const staffSelect = {
    id: true,
    empId: true,
    firstName: true,
    lastName: true,
    photoUrl: true,
    designation: true,
    department: true,
    unitId: true,
    phone: true,
    email: true,
    joiningDate: true,
    createdAt: true,
    status: true,
    isDeleted: true,
    deletedAt: true,
    metadata: true,
    user: {
        select: {
            id: true,
            email: true,
            isActive: true,
            role: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    }
};

const staffPrivilegeSelect = {
    id: true,
    empId: true,
    firstName: true,
    lastName: true,
    email: true,
    unitId: true,
    userId: true,
    metadata: true,
    user: {
        select: {
            id: true,
            email: true,
            isActive: true,
            roleId: true,
            role: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    }
};

const STAFF_DOCUMENT_FIELDS = {
    aadhaarDocument: {
        key: 'aadhaarDocument',
        label: 'Aadhaar Document',
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf']
    },
    resumeDocument: {
        key: 'resumeDocument',
        label: 'Resume',
        allowedMimeTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        allowedExtensions: ['.pdf', '.docx']
    }
};

const verhoeffD = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const verhoeffP = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

const detectMimeFromBuffer = (buffer) => {
    if (!buffer || buffer.length < 4) return null;

    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return 'application/pdf';
    }

    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'image/jpeg';
    }

    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47
    ) {
        return 'image/png';
    }

    if (
        buffer[0] === 0x50 &&
        buffer[1] === 0x4B &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04
    ) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    return null;
};

const isValidAadhaarNumber = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!/^[2-9]\d{11}$/.test(digits)) return false;

    let checksum = 0;
    const reversed = digits.split('').reverse().map(Number);

    for (let i = 0; i < reversed.length; i += 1) {
        checksum = verhoeffD[checksum][verhoeffP[i % 8][reversed[i]]];
    }

    return checksum === 0;
};

const parseMetadata = (metadata) => (
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? { ...metadata }
        : {}
);

const validateStaffDocument = (file, config) => {
    if (!file) return;

    if (!config.allowedMimeTypes.includes(file.mimetype)) {
        throw buildHttpError(`${config.label} has an invalid file type`);
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!config.allowedExtensions.includes(extension)) {
        throw buildHttpError(`${config.label} has an invalid file extension`);
    }

    const detectedMime = detectMimeFromBuffer(file.buffer);
    if (!detectedMime || !config.allowedMimeTypes.includes(detectedMime) || detectedMime !== file.mimetype) {
        throw buildHttpError(`${config.label} failed file signature verification`);
    }
};

const validateStaffCompliance = ({ metadata, files }) => {
    const normalizedMetadata = parseMetadata(metadata);
    const aadhaarNo = normalizeOptionalString(normalizedMetadata.aadhaarNo);

    if (aadhaarNo && !isValidAadhaarNumber(aadhaarNo)) {
        throw buildHttpError('Invalid Aadhaar number. Please provide a valid 12-digit Aadhaar number.');
    }

    const aadhaarDocument = files?.aadhaarDocument?.[0];
    const resumeDocument = files?.resumeDocument?.[0];

    validateStaffDocument(aadhaarDocument, STAFF_DOCUMENT_FIELDS.aadhaarDocument);
    validateStaffDocument(resumeDocument, STAFF_DOCUMENT_FIELDS.resumeDocument);

    if (aadhaarNo && !aadhaarDocument && !normalizedMetadata?.documents?.aadhaarDocument?.fileUrl) {
        throw buildHttpError('Aadhaar document upload is required when Aadhaar number is provided.');
    }
};

const persistStaffDocuments = async ({ tenantId, unitId, staffId, files, existingMetadata }) => {
    const metadata = parseMetadata(existingMetadata);
    const documents = { ...(metadata.documents && typeof metadata.documents === 'object' ? metadata.documents : {}) };

    for (const [fieldName, config] of Object.entries(STAFF_DOCUMENT_FIELDS)) {
        const file = files?.[fieldName]?.[0];
        if (!file) continue;

        const fileUrl = await uploadToSupabase('Erp_software', file);
        await saveFileMetadata({
            fileName: file.originalname,
            fileUrl,
            fileType: file.mimetype,
            fileSize: file.size,
            entityType: 'STAFF_DOCUMENT',
            entityId: staffId,
            tenantId,
            unitId
        });

        documents[config.key] = {
            fileName: file.originalname,
            fileUrl,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
            status: fieldName === 'aadhaarDocument' ? 'PENDING_VERIFICATION' : 'UPLOADED'
        };
    }

    const aadhaarNo = normalizeOptionalString(metadata.aadhaarNo);
    const aadhaarDocumentMeta = documents.aadhaarDocument;

    if (aadhaarNo) {
        metadata.aadhaarVerification = {
            aadhaarNo,
            numberVerified: isValidAadhaarNumber(aadhaarNo),
            documentSubmitted: Boolean(aadhaarDocumentMeta?.fileUrl),
            status: aadhaarDocumentMeta?.fileUrl ? 'PENDING_REVIEW' : 'NUMBER_VERIFIED_ONLY',
            updatedAt: new Date().toISOString()
        };
    }

    metadata.documents = documents;

    return prisma.staff.update({
        where: { id: staffId },
        data: { metadata },
        select: staffSelect
    });
};

const buildMenuPrivilegeMetadata = ({ existingMetadata, menuPrivilege }) => ({
    ...(existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {}),
    menuPrivilege: {
        unitAccessMode: menuPrivilege.unitAccessMode,
        selectedUnitIds: menuPrivilege.selectedUnitIds || [],
        permissions: menuPrivilege.permissions || {},
        configuredAt: new Date().toISOString()
    }
});

const hasConfiguredMenuPrivilege = (metadata) => {
    if (!metadata || typeof metadata !== 'object') return false;

    const menuPrivilege = metadata.menuPrivilege;
    if (!menuPrivilege || typeof menuPrivilege !== 'object') return false;

    const selectedUnitIds = Array.isArray(menuPrivilege.selectedUnitIds) ? menuPrivilege.selectedUnitIds : [];
    const permissions = menuPrivilege.permissions && typeof menuPrivilege.permissions === 'object'
        ? Object.values(menuPrivilege.permissions)
        : [];

    if (menuPrivilege.unitAccessMode === 'all') return true;
    if (selectedUnitIds.length > 0) return true;

    return permissions.some((permission) => (
        permission && typeof permission === 'object' && (permission.view || permission.createUpdate)
    ));
};

const generateStaffEmpId = async (tx, tenantId, unitId) => {
    const prefix = 'EMP';
    const counter = await tx.refCounter.upsert({
        where: {
            prefix_tenantId: {
                prefix,
                tenantId
            }
        },
        update: {
            current: { increment: 1 }
        },
        create: {
            prefix,
            tenantId,
            unitId,
            current: 1
        }
    });

    const padded = String(counter.current).padStart(6, '0');
    return `${prefix}-${padded}`;
};

const resolveRoleForLogin = async (tx, tenantId, roleIdentifier) => {
    if (!roleIdentifier) {
        throw buildHttpError('Role is required for staff login');
    }

    // Accept either a Role UUID or a Role Name (e.g. "Admin", "Employee")
    let role = await tx.role.findFirst({
        where: { id: roleIdentifier, tenantId, isDeleted: false }
    });

    if (!role) {
        const normalizedRoleName = String(roleIdentifier).trim();
        if (normalizedRoleName) {
            role = await tx.role.upsert({
                where: {
                    name_tenantId: {
                        name: normalizedRoleName,
                        tenantId
                    }
                },
                update: { isDeleted: false, deletedAt: null },
                create: {
                    name: normalizedRoleName,
                    tenantId,
                    description: `${normalizedRoleName} role`
                }
            });
        }
    }

    if (!role) {
        throw buildHttpError('Invalid role selected for staff login');
    }

    return role;
};

const createAndLinkUserForStaff = async (tx, { tenantId, staff, email, password, roleId }) => {
    if (!roleId) {
        throw buildHttpError('Role is required for staff login');
    }

    const role = await resolveRoleForLogin(tx, tenantId, roleId);

    const existingUser = await tx.user.findFirst({ where: { email } });
    if (existingUser) {
        throw buildHttpError('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await tx.user.create({
        data: {
            email,
            passwordHash,
            firstName: staff.firstName,
            lastName: staff.lastName,
            tenantId,
            unitId: staff.unitId,
            roleId: role.id,
            isActive: true
        }
    });

    return tx.staff.update({
        where: { id: staff.id },
        data: { userId: user.id },
        select: staffSelect
    });
};

const createUserForStaffData = async (tx, { tenantId, unitId, firstName, lastName, email, password, roleId }) => {
    if (!roleId) {
        throw buildHttpError('Role is required for staff login');
    }

    const role = await resolveRoleForLogin(tx, tenantId, roleId);

    const existingUser = await tx.user.findFirst({ where: { email } });
    if (existingUser) {
        throw buildHttpError('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return tx.user.create({
        data: {
            email,
            passwordHash,
            firstName,
            lastName,
            tenantId,
            unitId,
            roleId: role.id,
            isActive: true
        }
    });
};

const createStaffBaseRecord = async (tx, { tenantId, userId, empId, staffData }) => {
    const staffId = crypto.randomUUID();
    const metadataJson = staffData.metadata ? JSON.stringify(staffData.metadata) : null;
    const joiningDate = staffData.joiningDate ? new Date(staffData.joiningDate) : null;
    const now = new Date();

    await tx.$executeRaw`
        INSERT INTO "Staff" (
            "id",
            "empId",
            "firstName",
            "lastName",
            "designation",
            "department",
            "phone",
            "email",
            "joiningDate",
            "status",
            "photoUrl",
            "userId",
            "metadata",
            "tenantId",
            "unitId",
            "isDeleted",
            "deletedAt",
            "createdAt",
            "updatedAt"
        ) VALUES (
            ${staffId},
            ${empId},
            ${staffData.firstName},
            ${staffData.lastName ?? null},
            ${staffData.designation ?? null},
            ${staffData.department ?? null},
            ${staffData.phone ?? null},
            ${staffData.email ?? null},
            ${joiningDate},
            ${staffData.status ?? 'Working'},
            ${staffData.photoUrl ?? null},
            ${userId ?? null},
            CAST(${metadataJson} AS jsonb),
            ${tenantId},
            ${staffData.unitId},
            ${false},
            ${null},
            ${now},
            ${now}
        )
    `;

    return tx.staff.findUnique({
        where: { id: staffId },
        select: staffSelect
    });
};

export const createStaff = async (tenantId, data, files = {}) => {
    const {
        createLogin = false,
        loginEmail,
        loginPassword,
        loginRoleId,
        roleId,
        ...staffData
    } = data;

    validateStaffCompliance({ metadata: staffData.metadata, files });

    const { empId, ...persistableStaffData } = staffData;
    const targetUnitId = persistableStaffData.unitId;
    const resolvedEmpId = normalizeOptionalString(empId) || await generateStaffEmpId(prisma, tenantId, targetUnitId);
    const resolvedLoginRoleId = resolveLoginRoleIdentifier({ loginRoleId, roleId });

    let linkedUser = null;

    try {
        if (createLogin) {
            if (!loginEmail || !loginPassword || !resolvedLoginRoleId) {
                throw buildHttpError('Login email, password and role are required when Create Login is enabled');
            }

            linkedUser = await createUserForStaffData(prisma, {
                tenantId,
                unitId: targetUnitId,
                firstName: persistableStaffData.firstName,
                lastName: persistableStaffData.lastName,
                email: loginEmail,
                password: loginPassword,
                roleId: resolvedLoginRoleId
            });
        }

        return await createStaffBaseRecord(prisma, {
            tenantId,
            userId: linkedUser?.id,
            empId: resolvedEmpId,
            staffData: persistableStaffData
        });
    } catch (error) {
        if (linkedUser?.id) {
            try {
                await prisma.user.delete({ where: { id: linkedUser.id } });
            } catch (cleanupError) {
                console.error('Failed to rollback linked user after staff creation error:', cleanupError);
            }
        }
        throw error;
    }
};

export const updateStaff = async (tenantId, staffId, data, files = {}) => {
    const {
        createLogin,
        loginEmail,
        loginPassword,
        loginRoleId,
        ...persistableData
    } = data;

    const normalizedEmpId = normalizeOptionalString(persistableData.empId);
    if (normalizedEmpId) {
        persistableData.empId = normalizedEmpId;
    } else {
        delete persistableData.empId;
    }

    validateStaffCompliance({ metadata: persistableData.metadata, files });

    return prisma.staff.update({
        where: { id: staffId, tenantId },
        data: persistableData,
        select: staffSelect
    });
};

export const getStaff = async (tenantId, unitId, options = {}) => {
    const { includeFormer = false } = options;
    const where = { tenantId, unitId };

    if (!includeFormer) {
        where.isDeleted = false;
    }

    return prisma.staff.findMany({
        where,
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            designation: true,
            department: true,
            unitId: true,
            phone: true,
            email: true,
            joiningDate: true,
            createdAt: true,
            status: true,
            isDeleted: true,
            deletedAt: true,
            ...staffSelect
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const getRoles = async (tenantId) => {
    const defaultRoles = [
        { name: 'Admin', description: 'System administrator role' },
        { name: 'Employee', description: 'Standard employee role' }
    ];

    for (const role of defaultRoles) {
        await prisma.role.upsert({
            where: {
                name_tenantId: {
                    name: role.name,
                    tenantId
                }
            },
            update: {
                isDeleted: false,
                deletedAt: null,
                description: role.description
            },
            create: {
                name: role.name,
                description: role.description,
                tenantId
            }
        });
    }

    return prisma.role.findMany({
        where: { tenantId, isDeleted: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });
};

export const getStaffPerformance = async (tenantId, unitId) => {
    return prisma.staff.findMany({
        where: { tenantId, unitId, isDeleted: false },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
            performanceScore: true,
            workload: true,
            stressLevel: true,
            isAvailable: true,
            lastActiveAt: true
        },
        orderBy: [
            { performanceScore: 'desc' },
            { workload: 'asc' }
        ]
    });
};

const toDateOnly = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
};

const formatTimeValue = (value) => {
    if (!value) return '-';

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '-';

        if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
            const [hoursRaw, minutesRaw] = trimmed.split(':');
            const hours = Number(hoursRaw);
            const minutes = Number(minutesRaw);
            if (Number.isNaN(hours) || Number.isNaN(minutes)) return trimmed;
            const suffix = hours >= 12 ? 'PM' : 'AM';
            const normalizedHours = hours % 12 || 12;
            return `${String(normalizedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
        }

        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        return trimmed;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';

    return parsed.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const resolveAttendanceSnapshot = (staff, targetDate) => {
    const metadata = staff.metadata && typeof staff.metadata === 'object' ? staff.metadata : {};
    const attendanceMeta = metadata.attendance && typeof metadata.attendance === 'object' ? metadata.attendance : {};
    const dailyLogs = Array.isArray(attendanceMeta.logs) ? attendanceMeta.logs : [];

    const matchedLog = dailyLogs.find((log) => {
        const logDate = toDateOnly(log?.date || log?.attendanceDate || log?.day);
        return logDate === targetDate;
    });

    const checkInRaw =
        matchedLog?.checkIn ||
        matchedLog?.checkInTime ||
        attendanceMeta.checkIn ||
        attendanceMeta.checkInTime ||
        null;

    const checkOutRaw =
        matchedLog?.checkOut ||
        matchedLog?.checkOutTime ||
        attendanceMeta.checkOut ||
        attendanceMeta.checkOutTime ||
        null;

    const lastActiveDate = toDateOnly(staff.lastActiveAt);
    const inferredPresent = Boolean(checkInRaw || checkOutRaw || lastActiveDate === targetDate);
    const inferredStatus = matchedLog?.status || attendanceMeta.status;

    let status = inferredStatus || (inferredPresent ? 'Present' : 'Absent');
    if (status === 'Present' && checkOutRaw && staff.shiftEnd) {
        const normalizedCheckOut = formatTimeValue(checkOutRaw);
        const normalizedShiftEnd = formatTimeValue(staff.shiftEnd);
        if (normalizedCheckOut !== '-' && normalizedShiftEnd !== '-' && normalizedCheckOut !== normalizedShiftEnd) {
            const checkOutDate = new Date(`1970-01-01T${String(checkOutRaw).slice(0, 8)}`);
            const shiftEndDate = new Date(`1970-01-01T${String(staff.shiftEnd).slice(0, 8)}`);
            if (!Number.isNaN(checkOutDate.getTime()) && !Number.isNaN(shiftEndDate.getTime()) && checkOutDate > shiftEndDate) {
                status = 'Present (Overtime)';
            }
        }
    }

    return {
        id: `${staff.id}-${targetDate}`,
        date: targetDate,
        empId: staff.empId,
        name: `${staff.firstName} ${staff.lastName || ''}`.trim(),
        checkIn: formatTimeValue(checkInRaw),
        checkOut: formatTimeValue(checkOutRaw),
        status
    };
};

export const getAttendanceLogs = async (tenantId, unitId, options = {}) => {
    const targetDate = toDateOnly(options.date) || new Date().toISOString().split('T')[0];

    const staff = await prisma.staff.findMany({
        where: {
            tenantId,
            unitId,
            isDeleted: false
        },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            metadata: true,
            lastActiveAt: true,
            shiftEnd: true
        },
        orderBy: [
            { firstName: 'asc' },
            { createdAt: 'asc' }
        ]
    });

    return staff.map((member) => resolveAttendanceSnapshot(member, targetDate));
};

export const deleteStaff = async (tenantId, staffId) => {
    return prisma.staff.update({
        where: { id: staffId, tenantId },
        data: { isDeleted: true, deletedAt: new Date() },
        select: staffSelect
    });
};

// --- Job Applications ---

export const createJobApplication = async (tenantId, unitId, data) => {
    return prisma.jobApplication.create({
        data: { ...data, tenantId, unitId }
    });
};

export const updateJobApplication = async (tenantId, unitId, appId, data) => {
    return prisma.jobApplication.update({
        where: { id: appId, tenantId, unitId },
        data
    });
};

export const getJobApplications = async (tenantId, unitId) => {
    return prisma.jobApplication.findMany({
        where: { tenantId, unitId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const deleteJobApplication = async (tenantId, unitId, appId) => {
    return prisma.jobApplication.update({
        where: { id: appId, tenantId, unitId },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};

export const createStaffLogin = async (tenantId, unitId, staffId, { email, password, roleId }) => {
    const staff = await prisma.staff.findFirst({
        where: { id: staffId, tenantId, isDeleted: false },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            unitId: true,
            userId: true
        }
    });
    if (!staff) throw buildHttpError('Staff not found', 404);
    if (staff.userId) {
        throw buildHttpError('Staff already has a linked login');
    }

    return createAndLinkUserForStaff(prisma, {
        tenantId,
        staff,
        email,
        password,
        roleId
    });
};

export const updateStaffPrivilege = async (tenantId, unitId, staffId, { loginEnabled, roleId, email, password, forceLogout = false }) => {
    const staff = await prisma.staff.findFirst({
        where: { id: staffId, tenantId, isDeleted: false },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            email: true,
            unitId: true,
            userId: true
        }
    });
    if (!staff) throw new Error("Staff not found");

    if (forceLogout) {
        if (!staff.userId) {
            throw buildHttpError('Staff has no linked login to force logout');
        }

        const existingUser = await prisma.user.findUnique({
            where: { id: staff.userId },
            select: {
                roleId: true,
                email: true
            }
        });

        if (!existingUser) {
            throw buildHttpError('Linked user not found', 404);
        }

        await prisma.user.update({
            where: { id: staff.userId },
            data: {
                roleId: roleId || existingUser.roleId || undefined,
                email: email || existingUser.email || undefined
            }
        });
    } else if (loginEnabled) {
        if (staff.userId) {
            const existingUser = await prisma.user.findUnique({ where: { id: staff.userId } });
            if (existingUser && existingUser.unitId !== staff.unitId) {
                throw buildHttpError('Unit mismatch. Staff and user must belong to the same unit');
            }
            const resolvedRole = roleId ? await resolveRoleForLogin(prisma, tenantId, roleId) : null;
            const updateData = { roleId, isActive: true };
            if (resolvedRole) updateData.roleId = resolvedRole.id;
            if (email) updateData.email = email;
            if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

            await prisma.user.update({
                where: { id: staff.userId },
                data: updateData
            });
        } else {
            const defaultEmail = email || staff.email || `${staff.empId.toLowerCase()}@unit.local`;
            const defaultPassword = password || 'Staff@123';
            await createAndLinkUserForStaff(prisma, {
                tenantId,
                staff,
                email: defaultEmail,
                password: defaultPassword,
                roleId
            });
        }
    } else if (staff.userId) {
        await prisma.user.update({
            where: { id: staff.userId },
            data: { isActive: false }
        });
    }

    return prisma.staff.findUnique({ where: { id: staffId }, select: staffSelect });
};

export const updateStaffMenuPrivilege = async (tenantId, unitId, staffId, menuPrivilege) => {
    const staff = await prisma.staff.findFirst({
        where: { id: staffId, tenantId, unitId, isDeleted: false },
        select: staffPrivilegeSelect
    });

    if (!staff) {
        throw buildHttpError('Staff not found', 404);
    }

    if (!staff.userId) {
        throw buildHttpError('Staff has no login. Enable login during onboarding.');
    }

    if (!staff.user?.roleId) {
        throw buildHttpError('Staff has no privilege assigned. Assign a role before configuring menu privileges.');
    }

    return prisma.staff.update({
        where: { id: staffId },
        data: {
            metadata: buildMenuPrivilegeMetadata({
                existingMetadata: staff.metadata,
                menuPrivilege
            })
        },
        select: staffSelect
    });
};

export { hasConfiguredMenuPrivilege, persistStaffDocuments };
