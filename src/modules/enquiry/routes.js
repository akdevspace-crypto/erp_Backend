import { Router } from 'express';
import { handleCreateEnquiry, handleListEnquiries, handleGetEnquiry, handleUpdateEnquiry, handleDeleteEnquiry, handleAddFollowUp } from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { requirePermission } from '../../shared/middleware/rbac.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

// Apply global middlewares
router.use(protect);
router.use(enforceTenant);

router.post('/', requirePermission('ENQUIRY', 'CREATE'), handleCreateEnquiry);
router.get('/', requirePermission('ENQUIRY', 'READ'), handleListEnquiries);
router.get('/:id', requirePermission('ENQUIRY', 'READ'), handleGetEnquiry);
router.put('/:id', requirePermission('ENQUIRY', 'UPDATE'), handleUpdateEnquiry);
router.delete('/:id', requirePermission('ENQUIRY', 'DELETE'), handleDeleteEnquiry);
router.post('/:id/follow-up', requirePermission('ENQUIRY', 'CREATE'), handleAddFollowUp);

export default router;
