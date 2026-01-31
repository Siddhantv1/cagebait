import { parsePhoneNumber } from 'libphonenumber-js';

class IntelligenceExtractor {
    constructor() {
        this.patterns = {
            bankAccounts: /\b\d{9,18}\b/g,
            upiIds: /[\w\.-]+@[\w\.-]+/g,
            urls: /http[s]?:\/\/[^\s]+/g,
            phoneNumbers: /\+?91[-\s]?[6-9]\d{9}\b/g
        };

        this.scamKeywords = [
            'urgent', 'immediately', 'blocked', 'suspended',
            'verify', 'confirm', 'update', 'kyc', 'otp', 'cvv'
        ];
    }

    extract(message) {
        const intelligence = {
            bankAccounts: [],
            upiIds: [],
            phishingLinks: [],
            phoneNumbers: [],
            suspiciousKeywords: []
        };

        // Extract bank accounts
        const bankMatches = message.match(this.patterns.bankAccounts);
        if (bankMatches) {
            intelligence.bankAccounts = [...new Set(bankMatches)];
        }

        // Extract UPI IDs
        const upiMatches = message.match(this.patterns.upiIds);
        if (upiMatches) {
            intelligence.upiIds = [...new Set(upiMatches.filter(m => m.includes('@')))];
        }

        // Extract URLs
        const urlMatches = message.match(this.patterns.urls);
        if (urlMatches) {
            intelligence.phishingLinks = [...new Set(urlMatches)];
        }

        // Extract phone numbers
        const phoneMatches = message.match(this.patterns.phoneNumbers);
        if (phoneMatches) {
            intelligence.phoneNumbers = [...new Set(phoneMatches.map(p => {
                try {
                    const parsed = parsePhoneNumber(p, 'IN');
                    return parsed.format('E.164');
                } catch {
                    return p;
                }
            }))];
        }

        // Extract keywords
        const lowerMsg = message.toLowerCase();
        this.scamKeywords.forEach(keyword => {
            if (lowerMsg.includes(keyword)) {
                intelligence.suspiciousKeywords.push(keyword);
            }
        });
        intelligence.suspiciousKeywords = [...new Set(intelligence.suspiciousKeywords)];

        return intelligence;
    }

    merge(existing, newIntel) {
        return {
            bankAccounts: [...new Set([...existing.bankAccounts, ...newIntel.bankAccounts])],
            upiIds: [...new Set([...existing.upiIds, ...newIntel.upiIds])],
            phishingLinks: [...new Set([...existing.phishingLinks, ...newIntel.phishingLinks])],
            phoneNumbers: [...new Set([...existing.phoneNumbers, ...newIntel.phoneNumbers])],
            suspiciousKeywords: [...new Set([...existing.suspiciousKeywords, ...newIntel.suspiciousKeywords])]
        };
    }
}

export default IntelligenceExtractor;
