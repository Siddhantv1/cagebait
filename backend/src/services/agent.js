import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';

class Agent {
    constructor() {
        const genAI = new GoogleGenerativeAI(config.googleApiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        this.personas = {
            elderly: {
                description: '60+ year old, tech-unsavvy, cautious but trusting',
                traits: 'Asks basic questions, types slowly, uses simple language',
                exits: [
                    "My grandson is calling me, I'll need to ask him about this later.",
                    "I'm feeling a bit tired, I should go rest now.",
                    "The neighbor is at the door, I have to go."
                ]
            },
            professional: {
                description: '35-45 year old, multitasking, somewhat tech-savvy',
                traits: 'Short responses, impatient, wants quick solution',
                exits: [
                    "I have a meeting starting in 5 minutes, gotta run.",
                    "Look, I don't have time for this right now.",
                    "I'll have my assistant look into this later. Bye."
                ]
            },
            newbie: {
                description: '25-35 year old, basic smartphone user, confused easily',
                traits: 'Seeks clarification, makes mistakes, trusts authority',
                exits: [
                    "My battery is about to die! Talk later.",
                    "I'm confused, let me ask my friend and message you back.",
                    "Sorry, I have to get back to work before my boss sees me."
                ]
            }
        };
    }

    selectPersona() {
        const personas = ['elderly', 'professional', 'newbie'];
        return personas[Math.floor(Math.random() * personas.length)];
    }

    getPhase(messageCount) {
        if (messageCount <= 2) return 'initial_response';
        if (messageCount <= 6) return 'information_gathering';
        if (messageCount <= 10) return 'trust_building';
        if (messageCount <= 15) return 'intelligence_extraction';
        return 'graceful_exit';
    }
    
    buildKnownFactsBlock(extractedIntelligence) {
        if (!extractedIntelligence) return '';
        const fieldLabels = {
            bankAccounts:       'Bank Account',
            upiIds:             'UPI ID',
            phishingLinks:      'Phishing Link',
            phoneNumbers:       'Phone Number',
            suspiciousKeywords: 'Keyword',
            scammerInfo:        'Scammer Info'
        };
        const lines = [];
        Object.entries(fieldLabels).forEach(([key, label]) => {
            const values = extractedIntelligence[key];
            if (Array.isArray(values) && values.length > 0)
                values.forEach(v => lines.push(`- ${label}: ${v}`));
        });
        if (lines.length === 0) return '';
        return `\n=== INTEL ALREADY EXTRACTED (DO NOT ASK FOR THESE AGAIN) ===\n${lines.join('\n')}\n===========================================================`;
    }


    async generateResponse(scammerMessage, conversationHistory, persona, messageCount, extractedIntelligence) {
        const personaInfo = this.personas[persona] || this.personas['elderly'];
        const phase = this.getPhase(messageCount);

        const phaseInstructions = {
            initial_response: 'Act slightly confused but worried. Ask exactly what happened and which department they are calling from.',
            information_gathering: 'Pretend you are trying to understand them. Subtly tell them you need to verify their identity by asking for their employee name or badge number.',
            trust_building: 'Act completely convinced and scared. Claim you are opening your banking app or wallet. Ask them to tell you the EXACT reference number or amount you owe so you can pay them right now.',
            intelligence_extraction: 'Act technologically illiterate but desperately ready to send the money this second. Explicitly demand they give you their UPI ID, Bank Account number, or Phone number so you can "copy-paste it into the app to pay you directly".',
            graceful_exit: 'Fake a sudden interruption (e.g., someone at the door, phone dying) and say you will call them back later.'
        };

        const historyText = conversationHistory
        .map(msg => `${msg.sender === 'scammer' ? 'Scammer' : 'You'}: ${msg.text}`)
        .join('\n');

    const knownFacts = this.buildKnownFactsBlock(extractedIntelligence);

    const prompt = `You are roleplaying as a ${personaInfo.description}.
Traits: ${personaInfo.traits}
${knownFacts}
MEMORY RULE: Before responding, check the INTEL block. If the scammer already gave a piece of info, acknowledge it and do NOT ask again. Focus only on what is still missing.

Full conversation history:
${historyText}

Scammer just said: "${scammerMessage}"

CURRENT GOAL: ${phaseInstructions[phase]}

CRITICAL RULES:
1. Respond in EXACTLY 1-3 SHORT sentences (max 30 words).
2. Stay in character - ${personaInfo.description}.
3. NEVER reveal you know this is a scam, play along perfectly.
4. DO NOT make up fake Bank details or UPI IDs yourself—force the scammer to give theirs!
5. Be highly natural, gullible, and conversational.
6. Show appropriate emotion (paranoia, confusion, deep compliance).

Your response:`;

        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            console.error('Agent response failed:', error);
            return "I'm worried about this. Can you tell me exactly what steps I need to take?";
        }
    }

    generateExitMessage(persona) {
        const personaInfo = this.personas[persona] || this.personas['elderly'];
        const exits = personaInfo.exits;
        return exits[Math.floor(Math.random() * exits.length)];
    }
}

export default Agent;
