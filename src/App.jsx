import { useState } from 'react'

function App() {
    const [apiKey, setApiKey] = useState('test-secret-key')
    const [sessionId, setSessionId] = useState('test-session-' + Date.now())
    const [message, setMessage] = useState('Your bank account will be blocked. Verify immediately.')
    const [loading, setLoading] = useState(false)
    const [response, setResponse] = useState(null)
    const [error, setError] = useState(null)
    const [history, setHistory] = useState([])

    const sendMessage = async () => {
        setLoading(true)
        setError(null)

        const payload = {
            sessionId,
            message: {
                sender: 'scammer',
                text: message
            },
            conversationHistory: history
        }

        try {
            const res = await fetch('http://localhost:8000/api/honeypot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                },
                body: JSON.stringify(payload)
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'API request failed')
            }

            setResponse(data)

            // Add to history
            setHistory(prev => [
                ...prev,
                { sender: 'scammer', text: message },
                { sender: 'agent', text: data.response }
            ])

            // Clear message for next input
            setMessage('')

        } catch (err) {
            setError(err.message)
            setResponse(null)
        } finally {
            setLoading(false)
        }
    }

    const resetSession = () => {
        setSessionId('test-session-' + Date.now())
        setHistory([])
        setResponse(null)
        setError(null)
        setMessage('Your bank account will be blocked. Verify immediately.')
    }

    return (
        <div className="container">
            <h1>🍯 Honeypot API Tester</h1>

            <div className="panel">
                <h2>Configuration</h2>
                <div className="row">
                    <div className="input-group">
                        <label>API Key</label>
                        <input
                            type="text"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="x-api-key header value"
                        />
                    </div>
                    <div className="input-group">
                        <label>Session ID</label>
                        <input
                            type="text"
                            value={sessionId}
                            onChange={(e) => setSessionId(e.target.value)}
                            placeholder="Unique session identifier"
                        />
                    </div>
                </div>
            </div>

            <div className="panel">
                <h2>Send Scam Message</h2>
                <div className="input-group">
                    <label>Message (as scammer)</label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a scam message to test..."
                    />
                </div>
                <div className="row">
                    <button onClick={sendMessage} disabled={loading || !message.trim()}>
                        {loading ? 'Sending...' : '📤 Send Message'}
                    </button>
                    <button onClick={resetSession} style={{ background: '#333', color: '#fff' }}>
                        🔄 Reset Session
                    </button>
                </div>
            </div>

            {history.length > 0 && (
                <div className="panel">
                    <h2>Conversation History</h2>
                    <div className="history">
                        {history.map((msg, i) => (
                            <div key={i} className={`history-item ${msg.sender}`}>
                                <div className="sender">{msg.sender === 'scammer' ? '🦹 Scammer' : '🤖 Agent'}</div>
                                <div>{msg.text}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="panel">
                <h2>API Response</h2>
                {error ? (
                    <div className="response error">{error}</div>
                ) : response ? (
                    <div className="response success">{JSON.stringify(response, null, 2)}</div>
                ) : (
                    <div className="status">Send a message to see the API response</div>
                )}
            </div>
        </div>
    )
}

export default App
