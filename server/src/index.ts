import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'node:http';
import path from 'node:path';
import healthRouter from './routes/health';
import telemetryRouter from './routes/telemetry';
import dashboardRouter from './routes/dashboard';
import shelvesRouter from './routes/shelves';
import inventoryRouter from './routes/inventory';
import alertsRouter from './routes/alerts';
import devicesRouter from './routes/devices';
import settingsRouter from './routes/settings';
import surplusRouter from './routes/surplus';
import reportsRouter from './routes/reports';
import rfidRouter from './routes/rfid';
import { errorHandler } from './middleware/errorHandler';
import { HttpError } from './services/http';
import dotenv from 'dotenv';
import { initializeSocketServer } from './sockets/socketServer';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
].filter(Boolean) as string[];

const app = express();
const httpServer = createServer(app);
const io = initializeSocketServer(httpServer, allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api', healthRouter);
app.use('/api', dashboardRouter);
app.use('/api', telemetryRouter);
app.use('/api', shelvesRouter);
app.use('/api', inventoryRouter);
app.use('/api', alertsRouter);
app.use('/api', devicesRouter);
app.use('/api', settingsRouter);
app.use('/api', surplusRouter);
app.use('/api', reportsRouter);
app.use('/api', rfidRouter);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API endpoint not found.')));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

export { app, io };
