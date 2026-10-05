import express from 'express';
import { handleTelemetry } from '../controllers/telemetryController';

const router = express.Router();

router.post('/telemetry', handleTelemetry);

export default router;
