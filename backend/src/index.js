import express from 'express';
import config from './config.js';
import honeypotRouter from './routes/honeypot.js';

const app = express();

// CORS middleware for frontend testing
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware
app.use(express.json());

//middleware for debug logger
app.use((req, res, next) => {
    console.log('--- INCOMING REQUEST ---');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('------------------------');
    next();
});

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('❌ Bad JSON received:', err.message);
        return res.status(400).json({ error: 'Invalid JSON format sent by client' });
    }
    next();
});

// Routes
app.use('/api', honeypotRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(config.port, () => {
    console.log(`🚀 CageBait API running on port ${config.port}`);
    console.log(`📍 Endpoint: http://localhost:${config.port}/api/honeypot`);
});
