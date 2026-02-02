import config from '../config.js';

class ScamDetector {
    constructor() {
        this.apiKey = config.googleApiKey;
        this.modelName = "gemini-2.5-flash";
        this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent`;

        // Separate single-word and multi-word keywords for optimal lookup
        this.singleWordKeywords = new Set();
        this.multiWordKeywords = new Set();

        // Scam words Corpus
        const allKeywords = [
            "urgent", "immediately", "asap", "act now", "final notice", "last chance", "limited time",
            "time-sensitive", "expires today", "within 24 hours", "respond now",
            "support team", "customer care", "security team", "bank official", "compliance team",
            "income tax", "IT department", "RBI", "government", "police", "legal department",
            "court notice", "enforcement", "official notice",
            "account suspended", "account blocked", "account frozen", "account compromised",
            "unauthorized login", "suspicious activity", "security alert", "verify your account",
            "reactivate account", "limited access", "restricted access",
            "verify details", "confirm identity", "update KYC", "re-verify", "submit documents",
            "share OTP", "one time password", "PIN", "CVV", "login details", "credentials",
            "reset password", "authentication failed",
            "refund", "cashback", "reward", "bonus", "prize", "lottery", "lucky draw",
            "free money", "claim now", "won", "selected", "winner", "payout",
            "tax refund", "pending payment", "unclaimed amount",
            "pay now", "make payment", "processing fee", "service charge", "verification fee",
            "penalty", "fine", "overdue", "outstanding amount", "settlement",
            "UPI", "QR code", "wire transfer", "crypto", "wallet", "deposit",
            "guaranteed returns", "risk-free", "double your money", "high ROI",
            "passive income", "trading signal", "insider tip", "pump", "pre-sale",
            "airdrop", "mint now", "limited allocation", "staking rewards",
            "congratulations", "dear customer", "valued user", "important update",
            "we noticed", "we detected", "your cooperation", "avoid suspension",
            "avoid legal action", "to prevent loss",
            "trusted partner", "verified partner", "reference number", "case ID",
            "ticket number", "incident report", "compliance required",
            "click here", "tap here", "open link", "download now", "install app",
            "verify now", "confirm now", "secure link", "shortened link",
            "missed delivery", "customs fee", "package on hold", "delivery failed",
            "job offer", "work from home", "part-time job", "easy money", "registration fee",
            "legal action", "arrest warrant", "court case", "blacklist", "account termination",
            "service deactivated", "SIM blocked", "number suspended",
            "claim", "verify", "update", "confirm", "unlock", "activate", "restore",
            "secure", "validate", "authorize", "approve",
            "server error", "system flagged", "security patch", "API failure",
            "breach detected", "malware detected", "firewall alert"
        ];

        // Split keywords for optimized lookup
        for (const keyword of allKeywords) {
            if (keyword.includes(' ')) {
                this.multiWordKeywords.add(keyword);
            } else {
                this.singleWordKeywords.add(keyword);
            }
        }

        this.totalKeywordCount = allKeywords.length;
    }

    // Optimized keyword check - O(m + k) complexity
    checkKeywords(message) {
        const lowerMsg = message.toLowerCase();
        const matches = [];
        let matchCount = 0;

        // Tokenize message once for single-word keywords
        const wordMatches = lowerMsg.match(/\b\w+\b/g) || [];
        const wordSet = new Set(wordMatches);

        // Check single-word keywords - O(k) with O(1) lookups
        for (const keyword of this.singleWordKeywords) {
            if (wordSet.has(keyword)) {
                matches.push(keyword);
                matchCount++;
            }
        }

        // Check multi-word phrases - O(p × m) where p = phrase count
        for (const keyword of this.multiWordKeywords) {
            if (lowerMsg.includes(keyword)) {
                matches.push(keyword);
                matchCount++;
            }
        }

        return {
            score: matchCount > 0 ? matchCount / this.totalKeywordCount : 0,
            matchedKeywords: matches,
            matchCount: matchCount
        };
    }

    // Use Gemini to analyze
    async analyzeWithGemini(message) {
        const prompt = `Analyze this message for scam patterns: "${message}"

Respond with JSON only (no markdown):
{
  "is_scam": true or false,
  "confidence": 0.0 to 1.0,
  "scam_type": "bank_fraud" or "phishing" or "lottery_scam" or "tech_support" or "investment_scam" or "delivery_scam" or "job_scam" or "unknown",
  "reasoning": "brief explanation"
}`;

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();

            // Validation
            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
                throw new Error('No content generated by Gemini');
            }

            const text = data.candidates[0].content.parts[0].text;
            console.log('Gemini raw response:', text);

            // Parse JSON (remove markdown if present)
            const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (error) {
            console.error('Gemini analysis failed:', error);
            return {
                is_scam: true, // Default to scam on error for safety
                confidence: 0.5,
                scam_type: 'unknown',
                reasoning: `Analysis failed: ${error.message}`
            };
        }
    }

    async detect(message) {
        // Edge case: empty or whitespace-only message
        if (!message || !message.trim()) {
            return {
                isScam: false,
                confidence: 0,
                scamType: 'unknown',
                reasoning: 'Empty message',
                keywordMatches: [],
                keywordScore: 0,
                matchCount: 0
            };
        }

        // Layer 1: Keywords (fast pre-filter)
        const keywordResult = this.checkKeywords(message);

        // Layer 2: Gemini analysis
        const geminiResult = await this.analyzeWithGemini(message);

        return {
            isScam: geminiResult.is_scam,
            confidence: geminiResult.confidence,
            scamType: geminiResult.scam_type,
            reasoning: geminiResult.reasoning,
            keywordMatches: keywordResult.matchedKeywords,
            keywordScore: keywordResult.score,
            matchCount: keywordResult.matchCount
        };
    }
}

export default ScamDetector;

