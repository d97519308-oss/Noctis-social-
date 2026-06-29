import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import pool from './database/connection';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';
import usersRoutes from './routes/users';
import commentsRoutes from './routes/comments';
import messagesRoutes from './routes/messages';
import notificationsRoutes from './routes/notifications';
import mediaRoutes from './routes/media';
import searchRoutes from './routes/search';
import reportsRoutes from './routes/reports';

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

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/comments', commentsRoutes);
app.use('/api/v1/messages', messagesRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/reports', reportsRoutes);

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
  console.log(`\n\ud83d\ude80 Noctis Social API - Production Ready`);
  console.log(`\ud83d\udcca Database: ${process.env.DATABASE_URL}`);
  console.log(`\ud83d\udd10 Environment: ${process.env.NODE_ENV}`);
  console.log(`\ud83c\udfaf Port: ${port}\n`);
  console.log('\ud83d\udcc4 Available Routes:');
  console.log('  POST   /api/v1/auth/register');
  console.log('  POST   /api/v1/auth/login');
  console.log('  POST   /api/v1/posts');
  console.log('  GET    /api/v1/posts/feed/me');
  console.log('  GET    /api/v1/users/:userId');
  console.log('  POST   /api/v1/messages');
  console.log('  GET    /api/v1/notifications/me');
  console.log('  POST   /api/v1/reports');
  console.log('  GET    /api/v1/search/posts');
});

export default app;
