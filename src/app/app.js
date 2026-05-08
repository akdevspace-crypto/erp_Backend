import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from '../routes/index.js';
import { errorHandler } from '../shared/middleware/error.middleware.js';
import { auditLogger } from '../shared/middleware/audit.middleware.js';
import { ExotelController } from '../modules/exotel/controller.js';
import { TwilioController } from '../modules/twilio/controller.js';

const app = express();

// Global Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({
    verify: (req, _res, buffer) => {
        if (buffer?.length) {
            req.rawBody = Buffer.from(buffer);
        }
    }
}));
app.use(express.urlencoded({
    extended: true,
    verify: (req, _res, buffer) => {
        if (buffer?.length && !req.rawBody) {
            req.rawBody = Buffer.from(buffer);
        }
    }
}));

// Global Audit Logger
app.use(auditLogger);

// Rate Limiting could be added here

// Public provider webhooks that require provider-owned root paths.
app.post('/webhook/exotel/call', ExotelController.exotelCallWebhook);
app.post('/webhook/twilio/call', TwilioController.callWebhook);

// API Routes
// Keep `/api` for existing frontend clients and expose `/api/v1` for versioned access.
app.use('/api/v1', routes);
app.use('/api', routes);

// Centralized Error Handler
app.use(errorHandler);

export default app;
