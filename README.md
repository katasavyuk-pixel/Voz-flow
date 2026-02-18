# 🎙️ SoyVOZ — Flow-Style Intelligent Dictation

> Stop typing. Start flowing. Transform your speech into perfect text.

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local

# 3. Start dev server
npm run dev
```

## ✨ Features

- **One-Tap Dictation**: Minimalist interface for instant voice capture.
- **AI Flow**: Automatically cleans filler words, fixes grammar, and polishes your speech.
- **Auto-Copy**: Resulting text is automatically copied to your clipboard.
- **Premium Aesthetic**: Modern dark theme with dynamic glowing waveforms.
- **Free Tier**: Uses Web Speech API for zero-cost transcription.

## 🛠️ Stack

- **Frontend**: Next.js 15
- **UI**: Tailwind CSS + shadcn/ui + Framer Motion
- **Auth/DB**: Supabase
- **AI**: Web Speech API + Groq (Llama 3)
