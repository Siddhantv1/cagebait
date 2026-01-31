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
        const { sessionId, message, conversationHistory } = req.body;

        // 1. Get or create session
        let session = await sessionManager.getSession(sessionId);
        if (!session) {
            session = await sessionManager.createSession(sessionId);
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
                        keywordScore: detection.keywordScore
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
        session.conversationHistory.push({
            sender: message.sender,
            text: message.text,
            timestamp: message.timestamp || new Date().toISOString()
        });

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
            conversationHistory,
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
                keywordMatches: session.detection.keywordMatches
            } : null
        });

    } catch (error) {
        console.error('Honeypot error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function sendFinalCallback(sessionId, session, reason) {
    try {
        await axios.post(config.guviCallbackUrl, {
            sessionId,
            scamDetected: true,
            totalMessagesExchanged: session.messageCount,
            extractedIntelligence: session.intelligence,
            agentNotes: `${session.scamType} scam detected. ${reason}`
        }, {
            timeout: 5000
        });
        console.log(`Final callback sent for session ${sessionId}`);
    } catch (error) {
        console.error('Callback failed:', error.message);
    }
}

export default router;
