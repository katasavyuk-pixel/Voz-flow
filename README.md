# 🎙️ Voz Flow — Flow-Style Intelligent Dictation

<!-- BEGIN:ecosystem-review -->
## Ubicación en el ecosistema — revisión 2026-10-07

**Función:** Dictado, transcripción y aplicación Electron.

**Área:** Herramientas personales y experimentos. **Alias local/documental:** Voz Flow.
**Clasificación documental:** Código existente; uso actual por verificar. Esta clasificación no certifica despliegue, uso real ni disponibilidad.

La coincidencia del canal voz no implica producto duplicado.

**Siguiente acción:** Documentar web y Electron; mantener separado del agente de voz de Maître.

[Mapa único de los 31 repositorios](https://github.com/katasavyuk-pixel/BusinessOS/blob/main/super-brain/MAPA-ECOSISTEMA.md).
La revisión contrastó la rama `master` en [`ea878535`](https://github.com/katasavyuk-pixel/Voz-flow/commit/ea8785350031723cd2c773b8c088eed0104d4939) (2026-03-04), archivos y PR abiertos; no ejecutó la aplicación ni comprobó el Mac/VPS.

**Precedencia:** instrucciones del repo → fuentes dueñas enlazadas → estado con evidencia y fecha. Las fechas y planes de las secciones antiguas no reactivan prioridades ni prueban producción.
<!-- END:ecosystem-review -->

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
