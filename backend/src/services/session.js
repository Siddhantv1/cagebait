import { createClient } from 'redis';
import config from '../config.js';

class SessionManager {
    constructor() {
        this.useRedis = false;
        this.memoryStore = new Map(); // Fallback in-memory storage

        this.client = createClient({
            socket: {
                host: config.redisHost,
                port: config.redisPort
            }
        });

        this.client.on('error', err => {
            if (this.useRedis) {
                console.error('Redis error:', err);
            }
        });

        // Try to connect to Redis
        this.initRedis();
    }

    async initRedis() {
        try {
            await this.client.connect();
            this.useRedis = true;
            console.log('✅ Connected to Redis');
        } catch (error) {
            this.useRedis = false;
            console.log('⚠️ Redis not available, using in-memory storage (data will not persist across restarts)');
        }
    }

    async getSession(sessionId) {
        try {
            if (this.useRedis) {
                const data = await this.client.get(`session:${sessionId}`);
                return data ? JSON.parse(data) : null;
            } else {
                // In-memory fallback
                const session = this.memoryStore.get(sessionId);
                return session || null;
            }
        } catch (error) {
            console.error('Get session error:', error);
            // Try memory fallback on Redis error
            return this.memoryStore.get(sessionId) || null;
        }
    }

    async createSession(sessionId) {
        const session = {
            sessionId,
            createdAt: new Date().toISOString(),
            messageCount: 0,
            scamDetected: false,
            scamType: 'unknown',
            persona: this.selectPersona(),
            conversationHistory: [],
            intelligence: {
                bankAccounts: [],
                upiIds: [],
                phishingLinks: [],
                phoneNumbers: [],
                suspiciousKeywords: []
            },
            lastIntelligenceUpdate: 0,
            finalCallbackSent: false
        };

        await this.saveSession(sessionId, session);
        return session;
    }

    async saveSession(sessionId, session) {
        try {
            if (this.useRedis) {
                await this.client.setEx(
                    `session:${sessionId}`,
                    3600, // 1 hour TTL
                    JSON.stringify(session)
                );
            } else {
                // In-memory fallback
                this.memoryStore.set(sessionId, session);
            }
        } catch (error) {
            console.error('Save session error:', error);
            // Fallback to memory on Redis error
            this.memoryStore.set(sessionId, session);
        }
    }

    selectPersona() {
        const personas = ['elderly', 'professional', 'newbie'];
        const weights = [0.4, 0.3, 0.3]; // Elderly works best
        const random = Math.random();
        let sum = 0;

        for (let i = 0; i < personas.length; i++) {
            sum += weights[i];
            if (random < sum) return personas[i];
        }
        return personas[0];
    }

    shouldEnd(session) {
        const now = new Date();
        const created = new Date(session.createdAt);
        const minutesElapsed = (now - created) / 1000 / 60;

        // Count total intelligence items
        const intelCount = Object.values(session.intelligence)
            .reduce((sum, arr) => sum + arr.length, 0);

        // End conditions
        if (session.messageCount >= 15) {
            return { should: true, reason: 'Maximum messages reached' };
        }
        if (minutesElapsed >= 10) {
            return { should: true, reason: 'Maximum duration exceeded' };
        }
        if (intelCount >= 5 && session.messageCount >= 8) {
            return { should: true, reason: 'Sufficient intelligence collected' };
        }
        if (session.messageCount - session.lastIntelligenceUpdate > 3 && session.messageCount > 8) {
            return { should: true, reason: 'No new intelligence extracted' };
        }

        return { should: false, reason: '' };
    }
}

export default SessionManager;
