import config from '../config.js';

class MurfTTS {
    constructor() {
        this.apiKey = config.murfApiKey;
        this.region = config.murfRegion || 'in';
        this.baseUrl = `https://${this.region}.api.murf.ai/v1/speech/stream`;

        // Persona → Voice mapping using validated Falcon catalog voices
        // Pitch values adjust perceived age.
        this.personaVoices = {
            elderly: {
                voices: [
                    { voiceId: 'Samar', gender: 'male', description: 'Older Indian male', style: 'Conversational', pitch: -15 },
                    { voiceId: 'Anisha', gender: 'female', description: 'Older Indian female', style: 'Conversational', pitch: -15 }
                ]
            },
            professional: {
                voices: [
                    { voiceId: 'Samar', gender: 'male', description: 'Professional Indian male', style: 'Conversational', pitch: 0 },
                    { voiceId: 'Anisha', gender: 'female', description: 'Professional Indian female', style: 'Conversational', pitch: 0 }
                ]
            },
            newbie: {
                voices: [
                    { voiceId: 'Samar', gender: 'male', description: 'Young Indian male', style: 'Conversational', pitch: 20 },
                    { voiceId: 'Anisha', gender: 'female', description: 'Young Indian female', style: 'Conversational', pitch: 20 }
                ]
            }
        };
    }

    /**
     * Select a random voice for a given persona
     * @param {string} persona - 'elderly', 'professional', or 'newbie'
     * @returns {{ voiceId: string, gender: string, description: string }}
     */
    selectVoice(persona) {
        const pool = this.personaVoices[persona] || this.personaVoices['elderly'];
        const voices = pool.voices;
        return voices[Math.floor(Math.random() * voices.length)];
    }

    /**
     * Generate audio from text using Murf Falcon streaming API
     * Returns the audio as a Buffer (MP3)
     * @param {string} text - Text to convert to speech
     * @param {string} persona - 'elderly', 'professional', or 'newbie'
     * @param {object} [voiceOverride] - Optional pre-selected voice object
     * @returns {Promise<{ audioBuffer: Buffer, voiceUsed: object }>}
     */
    async generateAudio(text, persona, voiceOverride = null) {
        const voice = voiceOverride || this.selectVoice(persona);

        if (!this.apiKey) {
            throw new Error('MURF_API_KEY is not configured. Set it in backend/.env');
        }

        const requestBody = {
            text: text,
            voice_id: voice.voiceId,
            model: 'FALCON',
            style: voice.style || 'Conversational',
            pitch: voice.pitch || 0,
            locale: 'en-IN',
            format: 'MP3',
            sample_rate: 24000,
            channel_type: 'MONO'
        };

        console.log(`🔊 Murf TTS: Generating audio for persona="${persona}", voice="${voice.voiceId}"`);
        console.log(`   Text: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.apiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Murf API error ${response.status}: ${errorBody}`);
            }

            // Collect the streamed audio chunks into a single buffer
            const chunks = [];
            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            // Combine all chunks
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const audioBuffer = Buffer.concat(chunks, totalLength);

            console.log(`✅ Murf TTS: Generated ${audioBuffer.length} bytes of MP3 audio`);

            return {
                audioBuffer,
                voiceUsed: voice
            };
        } catch (error) {
            console.error('❌ Murf TTS generation failed:', error.message);
            throw error;
        }
    }

    /**
     * Generate audio and return as base64 data URI
     * @param {string} text
     * @param {string} persona
     * @param {object} [voiceOverride]
     * @returns {Promise<{ audioDataUri: string, voiceUsed: object }>}
     */
    async generateAudioBase64(text, persona, voiceOverride = null) {
        const { audioBuffer, voiceUsed } = await this.generateAudio(text, persona, voiceOverride);
        const base64 = audioBuffer.toString('base64');
        const audioDataUri = `data:audio/mpeg;base64,${base64}`;

        return {
            audioDataUri,
            voiceUsed
        };
    }
}

export default MurfTTS;
