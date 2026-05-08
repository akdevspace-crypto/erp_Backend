import { createComplaint, getComplaints } from './service.js';
import { success } from '../../shared/utils/response.js';
import { complaintSchema } from './schema.js';

const normalizePriority = (p) => {
    const map = {
        low: "Low",
        medium: "Medium",
        high: "High",
        critical: "Critical"
    };
    return map[p?.toLowerCase()] || "Low";
};

const normalizeStatus = (s) => {
    const map = {
        new: "Open",
        open: "Open",
        progress: "In Progress",
        resolved: "Resolved"
    };
    return map[s?.toLowerCase()] || "Open";
};

export const handleCreateComplaint = async (req, res, next) => {
    try {
        console.log("📥 Incoming Request:", req.body);
        console.log("🧠 Context:", req.context);

        const rawData = {
            ...req.body,
            tenantId: req.context?.tenantId || req.user?.tenantId,
            unitId: req.context?.unitId || req.user?.unitId,
            attachmentUrl: req.file ? `/uploads/${req.file.filename}` : undefined
        };

        rawData.priority = normalizePriority(rawData.priority);
        rawData.status = normalizeStatus(rawData.status);

        const data = complaintSchema.parse(rawData);

        console.log("✅ Validation passed");
        const issue = await createComplaint(data.tenantId, data);
        console.log("💾 Complaint created");

        return success(res, issue, { message: 'Complaint successfully logged' });
    } catch (error) {
        next(error);
    }
};

export const handleGetComplaints = async (req, res, next) => {
    try {
        const complaints = await getComplaints(req.user.tenantId, req.user.unitId);
        return success(res, complaints);
    } catch (error) {
        next(error);
    }
};

export const handleComplaintAnalysis = async (req, res, next) => {
    try {
        const complaints = await getComplaints(req.user.tenantId, req.user.unitId);
        const summary = {
            total: complaints.length,
            open: complaints.filter((item) => item.status === 'OPEN').length,
            resolved: complaints.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length,
            highPriority: complaints.filter((item) => ['HIGH', 'CRITICAL'].includes(String(item.priority || '').toUpperCase())).length,
            byType: complaints.reduce((acc, item) => {
                const key = item.type || 'general';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {}),
            byUrgency: complaints.reduce((acc, item) => {
                const key = item.urgency || 'UNKNOWN';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {})
        };

        return success(res, summary);
    } catch (error) {
        next(error);
    }
};
