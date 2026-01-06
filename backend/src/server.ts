import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.js';
import { clusterRouter } from './routes/cluster.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/cluster', clusterRouter);

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
