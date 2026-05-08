import { Router } from 'express';
import {
    handleCreateStaff,
    handleGetStaff,
    handleGetRoles,
    handleGetStaffPerformance,
    handleGetAttendanceLogs,
    handleUpdateStaff,
    handleCreateStaffLogin,
    handleUpdateStaffPrivilege,
    handleUpdateStaffMenuPrivilege,
    handleDeleteStaff,
    handleCreateJobApplication,
    handleGetJobApplications,
    handleUpdateJobApplication,
    handleDeleteJobApplication
} from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';
import { upload } from '../storage/service.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

const staffDocumentUpload = upload.fields([
    { name: 'aadhaarDocument', maxCount: 1 },
    { name: 'resumeDocument', maxCount: 1 }
]);

router.post('/staff', staffDocumentUpload, handleCreateStaff);
router.get('/staff', handleGetStaff);
router.get('/roles', handleGetRoles);
router.get('/staff/performance', handleGetStaffPerformance);
router.get('/attendance', handleGetAttendanceLogs);
router.put('/staff/:id', staffDocumentUpload, handleUpdateStaff);
router.post('/staff/:id/create-login', handleCreateStaffLogin);
router.patch('/staff/:id/privilege', handleUpdateStaffPrivilege);
router.patch('/staff/:id/menu-privilege', handleUpdateStaffMenuPrivilege);
router.delete('/staff/:id', handleDeleteStaff);

router.post('/job-applications', handleCreateJobApplication);
router.get('/job-applications', handleGetJobApplications);
router.put('/job-applications/:id', handleUpdateJobApplication);
router.delete('/job-applications/:id', handleDeleteJobApplication);

export default router;
