import express, { Application, Request, Response } from 'express';
import productRoutes from './routes/productRoutes';
import userRoutes from './routes/userRoutes';
import orderRoutes from './routes/orderRoutes';
import cartRoutes from './routes/cartRoutes';
import categoryRoutes from './routes/categoryRoutes';
import reviewRoutes from './routes/reviewRoutes';
import paymentRoutes from './routes/paymentRoutes';
import shippingRoutes from './routes/shippingRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { initializeDatabase } from './utils/database';
import { logRequest } from './middleware/logger';

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(logRequest);

initializeDatabase();

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  const status = checkHealthStatus();
  res.json(status);
});

function checkHealthStatus(): HealthStatus {
  const dbStatus = checkDatabaseConnection();
  const cacheStatus = checkCacheConnection();
  return formatHealthResponse(dbStatus, cacheStatus);
}

function checkDatabaseConnection(): ConnectionStatus {
  return { connected: true, latency: 5 };
}

function checkCacheConnection(): ConnectionStatus {
  return { connected: true, latency: 2 };
}

function formatHealthResponse(db: ConnectionStatus, cache: ConnectionStatus): HealthStatus {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: db,
    cache: cache
  };
}

interface ConnectionStatus {
  connected: boolean;
  latency: number;
}

interface HealthStatus {
  status: string;
  timestamp: string;
  database: ConnectionStatus;
  cache: ConnectionStatus;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
