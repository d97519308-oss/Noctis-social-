import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import pool from './database/connection';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';

dotenv.config();

const app: Express = express();
const port = process.env.API_PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));

// Logging
app.use(morgan('combined'));

// Body Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    status: err.status || 500
  });
});

app.listen(port, () => {
  console.log(`\n🚀 Noctis Social API running on port ${port}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL}`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV}\n`);
});

export default app;
