import express from 'express';
import axios from 'axios';
import config from '../config.js';
import ScamDetector from '../services/scamDetector.js';
import Agent from '../services/agent.js';
import IntelligenceExtractor from '../services/intelligence.js';
import SessionManager from '../services/session.js';

const router = express.Router();

// Initialize services
const scamDetector = new ScamDetector();
const agent = new Agent();
const intelligenceExtractor = new IntelligenceExtractor();
const sessionManager = new SessionManager();

// API key middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== config.apiKey) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
};

router.post('/honeypot', validateApiKey, async (req, res) => {
    try {
        const { sessionId, message, conversationHistory, metadata } = req.body;

        // 1. Get or create session
        let session = await sessionManager.getSession(sessionId);
        if (!session) {
            session = await sessionManager.createSession(sessionId);
            // If new session but history provided (e.g. server restart), restore it
            if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
                console.log(`Restoring history for session ${sessionId} from request`);
                session.conversationHistory = conversationHistory;
                // Set message count based on history
                session.messageCount = conversationHistory.length;
            }
        } else {
            // Sync history if provided (client as source of truth for history)
            if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > session.conversationHistory.length) {
                session.conversationHistory = conversationHistory;
                session.messageCount = conversationHistory.length;
            }
        }

        // Store metadata if provided
        if (metadata) {
            session.metadata = { ...session.metadata, ...metadata };
        }

        // 2. Increment message count
        session.messageCount++;

        // 3. Detect scam (if not already detected)
        let detection = null;
        if (!session.scamDetected) {
            detection = await scamDetector.detect(message.text);
            console.log('Detection result:', detection);

            if (!detection.isScam) {
                return res.json({
                    status: 'success',
                    response: 'Thank you for your message.',
                    scamDetected: false,
                    analysis: {
                        confidence: detection.confidence,
                        scamType: detection.scamType,
                        reasoning: detection.reasoning,
                        keywordMatches: detection.keywordMatches,
                        keywordScore: detection.keywordScore,
                        matchCount: detection.matchCount
                    }
                });
            }

            session.scamDetected = true;
            session.scamType = detection.scamType;
            session.detection = detection;
        }

        // 4. Extract intelligence
        const newIntel = intelligenceExtractor.extract(message.text);
        session.intelligence = intelligenceExtractor.merge(session.intelligence, newIntel);

        // Update last intelligence timestamp if new data found
        if (newIntel.bankAccounts.length > 0 || newIntel.upiIds.length > 0 ||
            newIntel.phoneNumbers.length > 0 || newIntel.phishingLinks.length > 0) {
            session.lastIntelligenceUpdate = session.messageCount;
        }

        // 5. Add scammer message to history
        const scammerMsgObj = {
            sender: message.sender,
            text: message.text,
            timestamp: message.timestamp || new Date().toISOString()
        };
        session.conversationHistory.push(scammerMsgObj);

        // 6. Check if should end
        const endCheck = sessionManager.shouldEnd(session);

        if (endCheck.should && !session.finalCallbackSent) {
            // Send final callback
            await sendFinalCallback(sessionId, session, endCheck.reason);
            session.finalCallbackSent = true;
            await sessionManager.saveSession(sessionId, session);

            const exitMessage = agent.generateExitMessage(session.persona);

            return res.json({
                status: 'success',
                response: exitMessage,
                scamDetected: true,
                engagementMetrics: {
                    engagementDurationSeconds: Math.floor((new Date() - new Date(session.createdAt)) / 1000),
                    totalMessagesExchanged: session.messageCount
                },
                extractedIntelligence: session.intelligence,
                agentNotes: endCheck.reason
            });
        }

        // 7. Generate agent response
        const agentResponse = await agent.generateResponse(
            message.text,
            session.conversationHistory, // Use session history (now synced)
            session.persona,
            session.messageCount
        );

        // 8. Add agent response to history
        session.conversationHistory.push({
            sender: 'user',
            text: agentResponse,
            timestamp: new Date().toISOString()
        });

        // 9. Save session
        await sessionManager.saveSession(sessionId, session);

        // 10. Return response
        return res.json({
            status: 'success',
            response: agentResponse,
            scamDetected: true,
            persona: session.persona,
            messageCount: session.messageCount,
            analysis: session.detection ? {
                confidence: session.detection.confidence,
                scamType: session.detection.scamType,
                reasoning: session.detection.reasoning,
                keywordMatches: session.detection.keywordMatches,
                matchCount: session.detection.matchCount
            } : null
        });

    } catch (error) {
        console.error('Honeypot error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

import fs from 'fs';
import path from 'path';

// ... existing imports ...

// Helper to generate payload in o.md format
const generateFinalPayload = (sessionId, session, reason) => {
    return {
        status: "success",
        scamDetected: true,
        engagementMetrics: {
            engagementDurationSeconds: Math.floor((new Date() - new Date(session.createdAt)) / 1000),
            totalMessagesExchanged: session.messageCount
        },
        extractedIntelligence: session.intelligence,
        agentNotes: `${session.scamType} scam detected. ${reason}`
    };
};

// ... existing middleware ...

router.post('/end-session', validateApiKey, async (req, res) => {
    try {
        const { sessionId, reason } = req.body;
        const session = await sessionManager.getSession(sessionId);

        if (!session) {
            // 404 is technically correct, but let's provide a helpful message
            return res.status(404).json({ error: 'Session not found. Note: Sessions are in-memory and clear on restart.' });
        }

        if (!session.finalCallbackSent) {
            await sendFinalCallback(sessionId, session, reason || 'User ended session manually');
            session.finalCallbackSent = true;
            await sessionManager.saveSession(sessionId, session);
        }

        // Return final summary
        const payload = generateFinalPayload(sessionId, session, reason || 'User ended session manually');
        res.json(payload);

    } catch (error) {
        console.error('End session error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ... existing /honeypot route ...
// (Note: ensure /honeypot also uses generateFinalPayload if needed, or just sendFinalCallback)

async function sendFinalCallback(sessionId, session, reason) {
    const payload = generateFinalPayload(sessionId, session, reason);

    // 1. Log to console
    console.log('--- FINAL SESSION PAYLOAD (Session ID: ' + sessionId + ') ---');
    console.log(JSON.stringify(payload, null, 2));
    console.log('-----------------------------');

    // 2. Save to separate JSON file per session
    try {
        const sessionsDir = path.join(process.cwd(), 'sessions');
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
        }

        const filePath = path.join(sessionsDir, `${sessionId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
        console.log(`Payload saved to sessions/${sessionId}.json`);
    } catch (err) {
        console.error('Failed to save payload locally:', err);
    }

    // 3. Send to GUVI
    try {
        await axios.post(config.guviCallbackUrl, payload, { timeout: 5000 });
        console.log(`Final callback sent to GUVI for session ${sessionId}`);
    } catch (error) {
        console.error('Callback failed:', error.message);
    }
}

export default router;
