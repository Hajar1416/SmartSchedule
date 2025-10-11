#!/usr/bin/env node

// Simple standalone script to validate a GROQ_API_KEY
// Usage:
//   1) With env var:   GROQ_API_KEY=sk_xxx node groq-key-test.js
//   2) With arg:       node groq-key-test.js sk_xxx

const KEY = process.env.GROQ_API_KEY || process.argv[2]

if (!KEY) {
  console.error('Error: Provide GROQ_API_KEY via env or as the first argument.')
  process.exit(1)
}

const endpoint = 'https://api.groq.com/openai/v1/models'

;(async () => {
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Accept': 'application/json'
      }
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`GROQ key test failed. HTTP ${res.status} ${res.statusText}`)
      console.error(text)
      if (res.status === 401 || res.status === 403) {
        console.error('Auth error: Your key may be invalid or lacks permissions.')
      }
      process.exit(1)
    }

    const data = await res.json()
    const models = Array.isArray(data?.data) ? data.data.map(m => m.id) : []
    console.log('GROQ key is valid ✅')
    if (models.length > 0) {
      console.log('Models (sample):', models.slice(0, 5).join(', '))
    }
    process.exit(0)
  } catch (err) {
    console.error('GROQ key test failed with exception:', err?.message || err)
    process.exit(1)
  }
})()


