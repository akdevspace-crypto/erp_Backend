import { Router } from 'express';
import authRoutes from '../modules/auth/routes.js';
import enquiryRoutes from '../modules/enquiry/routes.js';
import profileRoutes from '../modules/profile/routes.js';
import masterRoutes from '../modules/master/routes.js';
import accountsRoutes from '../modules/accounts/routes.js';
import allocationRoutes from '../modules/allocation/routes.js';
import hrRoutes from '../modules/hr/routes.js';
import cmsRoutes from '../modules/cms/routes.js';
import customerCareRoutes from '../modules/customer_care/routes.js';
import tasksRoutes from '../modules/tasks/routes.js';
import aiRoutes from '../modules/ai/routes.js';
import analyticsRoutes from '../modules/analytics/routes.js';
import businessRoutes from '../modules/business/routes.js';
import inhouseCareRoutes from '../modules/inhouse-care/routes.js';
import welcomeCallRoutes from '../modules/welcome-call/routes.js';
import vitalSignRoutes from '../modules/vital-sign/routes.js';
import automationRuleRoutes from '../automation-engine/routes.js';
import conversationRoutes from '../modules/conversation/routes.js';
import webhookRoutes from '../modules/webhooks/routes.js';
import exotelRoutes from '../modules/exotel/routes.js';
import twilioRoutes from '../modules/twilio/routes.js';
import intelligenceRoutes from '../modules/intelligence/routes.js';
import copilotRoutes from '../modules/copilot/copilot.routes.js';
import inventoryRoutes from '../modules/inventory/routes.js';
import healthcareRoutes from '../modules/healthcare/routes.js';
import locationRoutes from '../modules/location/routes.js';
import explainabilityRoutes from '../intelligence/controllers/explainability.controller.js';
import { protect } from '../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../shared/middleware/tenant.middleware.js';
import { handleCreateStaffLogin } from '../modules/hr/controller.js';

const router = Router();

// Public auth routes must be registered before protected routers.
router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/', exotelRoutes);
router.use('/', twilioRoutes);

// Core CRM modules
router.use('/enquiry', enquiryRoutes);
router.use('/automation', automationRuleRoutes);
router.use('/automation', explainabilityRoutes);
router.use('/intelligence', intelligenceRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);

// Frontend-prefixed modules
router.use('/hr', hrRoutes);
router.use('/accounts', accountsRoutes);
router.use('/customer-care', customerCareRoutes);
router.use('/cms', cmsRoutes);
router.use('/location', locationRoutes);

// Alias for direct staff login creation flow
router.post('/staff/:id/create-login', protect, enforceTenant, handleCreateStaffLogin);

// Existing modules that already include their own path segments
router.use('/', inventoryRoutes);
router.use('/', healthcareRoutes);
router.use('/', conversationRoutes);

router.use('/master', masterRoutes);
router.use('/profile', profileRoutes);
router.use('/allocation', allocationRoutes);
router.use('/tasks', tasksRoutes);
router.use('/business', businessRoutes);
router.use('/inhouse-care', inhouseCareRoutes);
router.use('/welcome-call', welcomeCallRoutes);
router.use('/vital-sign', vitalSignRoutes);
router.use('/copilot', copilotRoutes);

export default router;
