import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';

class IntelligenceExtractor {
    constructor() {
        const genAI = new GoogleGenerativeAI(config.googleApiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" }, { apiVersion: 'v1beta' });
    }

    async extract(conversationMsgs) {
        if (!conversationMsgs || conversationMsgs.length === 0) {
            return this.getEmptyIntelligence();
        }

        const convoText = conversationMsgs
            .map(msg => `${msg.sender}: ${msg.text}`)
            .join('\n');

        const prompt = `You are a cybersecurity intelligence extractor.
Analyze this entire honeypot conversation. Extract any explicit personal or financial identifiers provided by the "scammer", even if spoken conversationally (e.g., "my account is four four three...").

Return ONLY a valid JSON object matching exactly this schema:
{
  "bankAccounts": ["account number strings"],
  "upiIds": ["upi id strings"],
  "phishingLinks": ["urls"],
  "phoneNumbers": ["phone numbers"],
  "suspiciousKeywords": ["crypto", "transfer", "fine", "penalty", etc],
  "scammerInfo": ["names", "companies", "employee IDs", "locations"]
}

Conversation:
${convoText}`;

        try {
            const result = await this.model.generateContent(prompt);
            const text = result.response.text();
            // Parse JSON (remove markdown bounds safely)
            const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(cleanText);

            // Normalize against empty schema boundaries
            return this.merge(this.getEmptyIntelligence(), parsed);
        } catch (error) {
            console.error('Intelligence Gemini extraction failed:', error);
            return this.getEmptyIntelligence();
        }
    }

    getEmptyIntelligence() {
        return {
            bankAccounts: [],
            upiIds: [],
            phishingLinks: [],
            phoneNumbers: [],
            suspiciousKeywords: [],
            scammerInfo: []
        };
    }

    merge(existing, newIntel) {
        if (!existing) existing = this.getEmptyIntelligence();
        if (!newIntel) newIntel = this.getEmptyIntelligence();

        return {
            bankAccounts: [...new Set([...(existing.bankAccounts || []), ...(newIntel.bankAccounts || [])])],
            upiIds: [...new Set([...(existing.upiIds || []), ...(newIntel.upiIds || [])])],
            phishingLinks: [...new Set([...(existing.phishingLinks || []), ...(newIntel.phishingLinks || [])])],
            phoneNumbers: [...new Set([...(existing.phoneNumbers || []), ...(newIntel.phoneNumbers || [])])],
            suspiciousKeywords: [...new Set([...(existing.suspiciousKeywords || []), ...(newIntel.suspiciousKeywords || [])])],
            scammerInfo: [...new Set([...(existing.scammerInfo || []), ...(newIntel.scammerInfo || [])])]
        };
    }
}

export default IntelligenceExtractor;
