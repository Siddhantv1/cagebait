class SessionManager {
    constructor() {
        this.memoryStore = new Map();
        console.log('Session Manager initialized (In-Memory Only)');
    }

    async getSession(sessionId) {
        if (this.memoryStore.has(sessionId)) {
            return this.memoryStore.get(sessionId);
        }
        return null;
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
