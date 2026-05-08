import { Router } from 'express';
import multer from 'multer';
import { protect, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { handleCreateComplaint, handleGetComplaints, handleComplaintAnalysis } from './controller.js';

const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

const router = Router();

router.use(protect);
router.use(enforceTenant);

// Canonical frontend paths
router.post('/complaints', upload.single('complaintAttachment'), handleCreateComplaint);
router.get('/complaints', handleGetComplaints);
router.get('/complaints/analysis', handleComplaintAnalysis);

// Backward-compatible aliases
router.post('/complaint', upload.single('complaintAttachment'), handleCreateComplaint);
router.get('/complaint', handleGetComplaints);
router.get('/complaint/analysis', handleComplaintAnalysis);

export default router;
