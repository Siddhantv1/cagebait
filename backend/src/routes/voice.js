import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import ScamDetector from '../services/scamDetector.js';
import Agent from '../services/agent.js';
import IntelligenceExtractor from '../services/intelligence.js';
import SessionManager from '../services/session.js';
import MurfTTS from '../services/murfTTS.js';

const router = express.Router();

// Initialize services (shared singletons)
const scamDetector = new ScamDetector();
const agent = new Agent();
const intelligenceExtractor = new IntelligenceExtractor();
const sessionManager = new SessionManager();
const murfTTS = new MurfTTS();


/**
 * POST /api/voice-honeypot
 * 
 * Same scam detection + agent pipeline as /api/honeypot, but returns
 * an AI-generated voice response (MP3 via Murf Falcon) alongside text.
 * 
 * Request body: { sessionId, text, conversationHistory? }
 *   - text: transcribed speech from browser SpeechRecognition
 * 
 * Response: {
 *   status, response (text), audioUrl (base64 data URI),
 *   scamDetected, persona, voiceUsed, messageCount, analysis?
 * }
 */
router.post('/voice-honeypot', async (req, res) => {
    try {
        const { sessionId, text, conversationHistory } = req.body;

        if (!sessionId || !text || !text.trim()) {
            return res.status(400).json({ error: 'sessionId and text are required' });
        }

        // 1. Get or create session
        let session = await sessionManager.getSession(sessionId);
        if (!session) {
            session = await sessionManager.createSession(sessionId);

            // Select and persist a Murf voice for this session's persona
            const selectedVoice = murfTTS.selectVoice(session.persona);
            session.murfVoice = selectedVoice;

            if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
                session.conversationHistory = conversationHistory;
                session.messageCount = conversationHistory.length;
            }
        } else {
            // Sync history if provided
            if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > session.conversationHistory.length) {
                session.conversationHistory = conversationHistory;
                session.messageCount = conversationHistory.length;
            }
        }

        // 2. Increment message count
        session.messageCount++;

        // 3. Detect scam (if not already detected)
        if (!session.scamDetected) {
            const detection = await scamDetector.detect(text);
            console.log('Voice endpoint detection result:', detection);

            if (!detection.isScam) {
                // Still generate a voice response for non-scam
                const nonScamText = 'Thank you for your message.';
                let audioResult = null;

                try {
                    audioResult = await murfTTS.generateAudioBase64(
                        nonScamText,
                        session.persona,
                        session.murfVoice
                    );
                } catch (ttsErr) {
                    console.error('TTS failed for non-scam response:', ttsErr.message);
                }

                return res.json({
                    status: 'success',
                    response: nonScamText,
                    audioUrl: audioResult?.audioDataUri || null,
                    scamDetected: false,
                    persona: session.persona,
                    voiceUsed: session.murfVoice || null,
                    analysis: {
                        confidence: detection.confidence,
                        scamType: detection.scamType,
                        reasoning: detection.reasoning,
                    }
                });
            }

            session.scamDetected = true;
            session.scamType = detection.scamType;
            session.detection = detection;
        }

        // 4. Add scammer message to history
        session.conversationHistory.push({
            sender: 'scammer',
            text: text,
            timestamp: new Date().toISOString()
        });

        // 5. Check if should end based on PAST intelligence levels
        const endCheck = sessionManager.shouldEnd(session);

        if (endCheck.should && !session.finalCallbackSent) {
            session.finalCallbackSent = true;
            await sessionManager.saveSession(sessionId, session);

            const exitMessage = agent.generateExitMessage(session.persona);

            // Generate TTS for exit message
            let audioResult = null;
            try {
                audioResult = await murfTTS.generateAudioBase64(
                    exitMessage,
                    session.persona,
                    session.murfVoice
                );
            } catch (ttsErr) {
                console.error('TTS failed for exit message:', ttsErr.message);
            }

            // --- SAVE SESSION LOG TO FILE SYSTEM ---
            const sessionsDir = path.resolve('sessions');
            try {
                await fs.mkdir(sessionsDir, { recursive: true });
                await fs.writeFile(
                    path.join(sessionsDir, `${sessionId}.json`),
                    JSON.stringify(session, null, 2),
                    'utf8'
                );
                console.log(`✅ Session logged to disk: sessions/${sessionId}.json`);
            } catch (err) {
                console.error('Failed to log session to disk:', err);
            }

            return res.json({
                status: 'success',
                response: exitMessage,
                audioUrl: audioResult?.audioDataUri || null,
                scamDetected: true,
                sessionEnded: true,
                persona: session.persona,
                voiceUsed: session.murfVoice || null,
                engagementMetrics: {
                    engagementDurationSeconds: Math.floor((new Date() - new Date(session.createdAt)) / 1000),
                    totalMessagesExchanged: session.messageCount
                },
                extractedIntelligence: session.intelligence,
                conversationHistory: session.conversationHistory,
                agentNotes: endCheck.reason
            });
        }

        // 6. Generate agent response & Extract intelligence CONCURRENTLY
        const [agentResponse, newIntel] = await Promise.all([
            agent.generateResponse(
                text,
                session.conversationHistory,
                session.persona,
                session.messageCount
            ),
            intelligenceExtractor.extract(session.conversationHistory)
        ]);

        // Merge Concurrent Intel cleanly
        session.intelligence = intelligenceExtractor.merge(session.intelligence, newIntel);
        if (newIntel.bankAccounts?.length > 0 || newIntel.upiIds?.length > 0 ||
            newIntel.phoneNumbers?.length > 0 || newIntel.phishingLinks?.length > 0 || 
            newIntel.scammerInfo?.length > 0) {
            session.lastIntelligenceUpdate = session.messageCount;
        }

        // We already generated the agentResponse in step 6

        // 8. Add agent response to history
        session.conversationHistory.push({
            sender: 'user',
            text: agentResponse,
            timestamp: new Date().toISOString()
        });

        // 9. Generate TTS audio for agent response
        let audioResult = null;
        try {
            audioResult = await murfTTS.generateAudioBase64(
                agentResponse,
                session.persona,
                session.murfVoice
            );
        } catch (ttsErr) {
            console.error('TTS failed for agent response:', ttsErr.message);
            // Continue without audio — text response still works
        }

        // 10. Save session
        await sessionManager.saveSession(sessionId, session);

        // 11. Return response with audio and updated history
        return res.json({
            status: 'success',
            response: agentResponse,
            audioUrl: audioResult?.audioDataUri || null,
            scamDetected: true,
            persona: session.persona,
            voiceUsed: session.murfVoice || null,
            messageCount: session.messageCount,
            extractedIntelligence: session.intelligence,
            conversationHistory: session.conversationHistory,
            analysis: session.detection ? {
                confidence: session.detection.confidence,
                scamType: session.detection.scamType,
                reasoning: session.detection.reasoning,
            } : null
        });

    } catch (error) {
        console.error('Voice honeypot error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
