# Form Generator Pipeline

A web app where a user describes a form in plain English, and an open-source LLM returns ready-to-use HTML + CSS code for that form.

---

## 1. High-level flow

```
User enters requirement
        ↓
Frontend builds system prompt + user prompt
        ↓
Frontend → (proxy) → open-source LLM API
        ↓
LLM returns HTML/CSS code
        ↓
Strip / parse the response → display code + live preview
        ↓
User can copy code or download the .html file
```

---

## 2. UI components (single page)

| # | Component             | Purpose                                                                 |
|---|-----------------------|-------------------------------------------------------------------------|
| 1 | Requirement textarea  | User types the form description (fields, validation, style hints, etc.)|
| 2 | Generate button       | Triggers the LLM call; shows a loading state                            |
| 3 | Code output panel     | Read-only `<pre><code>` block with syntax highlighting (Prism / highlight.js) |
| 4 | Live preview iframe   | Renders the generated HTML sandboxed in a `srcdoc` iframe               |
| 5 | Copy code button      | Copies the generated HTML+CSS to clipboard                              |
| 6 | Download HTML button  | Wraps the output in a Blob and triggers a download as `form.html`       |

Optional polish: provider/model selector, temperature slider, regenerate, "include JS validation" toggle.

---

## 3. LLM provider research — open-source models with free API keys

Strictly free, no paid credit card required, open-source weights (Llama / Qwen / DeepSeek / Mistral / Gemma / GPT-OSS family).

| Provider              | Open-source models on free tier                                                    | Free tier limits                                                  | Speed       | Notes                                                              |
|-----------------------|------------------------------------------------------------------------------------|-------------------------------------------------------------------|-------------|--------------------------------------------------------------------|
| **Cerebras**          | Llama 3.3 70B, Qwen3 32B, Qwen3 235B, GPT-OSS 120B, Llama 4 Scout                  | 30 RPM, 60K–100K TPM, **1M tokens/day**, 14.4K RPD, **8K ctx cap**| ~2000+ TPS  | Fastest inference of the free tier; no card; ctx cap fine for forms|
| **Groq**              | Llama 3.3 70B, Llama 3.1 8B, DeepSeek-R1-Distill, Qwen QwQ, Gemma 2 9B, Llama 4 Maverick | 30 RPM, 6K TPM, **1K req/day** per model                          | ~315 TPS    | Very fast; daily cap is the binding constraint                     |
| **OpenRouter**        | Qwen3-Coder-480B (free), Llama 3.3 70B, DeepSeek-R1, Qwen 2.5 7B, Gemma 3 12B, Mistral 7B | 20 RPM, ~50 req/day shared across all free models                 | Provider-dep| Best coding model on free tier (Qwen3-Coder-480B); strictest daily cap |
| **Hugging Face**      | Most Llama / Qwen / Mistral / Gemma checkpoints                                    | ~few hundred req/hour, ~$0.10/mo quota                            | Varies      | Cold starts; useful as a third fallback                            |
| **Google AI Studio**  | Gemma 3 (open weights)                                                              | 1500 req/day                                                      | Fast        | Mostly known for Gemini (closed); Gemma path is OS-compliant       |
| **Together AI**       | Llama, Qwen, DeepSeek, Mistral, Gemma                                              | $5 trial credit then paid                                         | Fast        | Drops off "strictly free" after credit                             |
| **Fireworks AI**      | DeepSeek, Llama, Qwen                                                              | Paid-first; no durable free tier                                  | Fast        | Skip for this project                                              |

### Recommended choice

- **Primary provider:** **Cerebras** — `qwen-3-32b` or `llama-3.3-70b`
  - Largest free daily budget (1M tokens/day) → plenty of room for iteration.
  - 2000+ TPS keeps the UI snappy.
  - 8K context cap is a non-issue: form prompts + outputs fit easily.
- **Quality fallback:** **OpenRouter** — `qwen/qwen3-coder:free` (Qwen3-Coder-480B)
  - Strongest free coding model available; use when output quality matters more than speed/quota.
- **Speed fallback:** **Groq** — `llama-3.3-70b-versatile`
  - Different infra from Cerebras, so failover is meaningful when one provider is down.

All three speak the OpenAI Chat Completions wire format, so we write the client once and just swap `baseURL` + model id.

---

## 4. Architecture: where does the API call happen?

**Security note:** Groq's docs explicitly warn: *"Never embed keys in frontend code or expose them in browser bundles. If you need client-side usage, route through a trusted backend proxy."* The same applies to Cerebras and OpenRouter. A key shipped in JS is a key anyone with DevTools can lift and burn through our daily quota.

Two viable paths:

### Path A — Static frontend + tiny serverless proxy (recommended)

```
[Browser]  ──fetch──▶  [/api/generate on Vercel/Cloudflare/Netlify]  ──▶  [LLM provider]
                              ▲ holds API key in env var
```

- Frontend stays pure HTML/CSS/JS (matches the repo's current direction).
- Proxy is ~30 lines (Cloudflare Worker / Vercel Edge Function / Netlify Function).
- Proxy can also enforce: rate limiting per IP, max prompt length, and provider failover.

### Path B — "Bring your own key" (no backend)

- User pastes their own API key into a settings field; key is kept in `localStorage` and sent directly from the browser.
- Zero hosting cost, zero exposure of *our* key, but UX friction (every user needs an account at Cerebras/Groq/OpenRouter).
- Good escape hatch / demo mode.

Decision: ship Path A for the deployed version; expose Path B as an "Advanced → use your own key" toggle.

---

## 5. Prompt design

### System prompt (template)

```
You are an expert front-end developer specializing in clean, accessible HTML and CSS forms.

When the user describes a form, output a SINGLE, self-contained HTML document that:
- Includes a <style> block in the <head> (no external CSS, no JS unless explicitly requested).
- Uses semantic HTML5 form elements (<form>, <label>, <input>, <select>, <textarea>, <button>).
- Associates every input with a <label> via the `for` attribute.
- Adds appropriate `type`, `name`, `required`, `pattern`, `min`, `max`, `placeholder` attributes.
- Is responsive (mobile-first; max-width container, sensible padding, readable font sizes).
- Uses a clean modern visual style: soft shadows, rounded corners, clear focus states, accessible color contrast.
- Includes a submit button with `type="submit"`.

Output rules:
- Return ONLY the HTML code. No prose, no markdown fences, no explanations.
- Do not include <!DOCTYPE> comments or commentary inside the file.
- If the user asks for JS validation, add it inside a <script> at the end of <body>.
```

### User prompt (template)

```
Build a form for the following requirement:

"""
{{USER_REQUIREMENT}}
"""

Return only the HTML code.
```

### Generation parameters

| Param           | Value     | Reason                                                            |
|-----------------|-----------|-------------------------------------------------------------------|
| `temperature`   | 0.2–0.4   | We want predictable, well-formed HTML, not creative variance.     |
| `max_tokens`    | 2048      | Plenty for a single form; well under Cerebras's 8K context cap.   |
| `top_p`         | 0.9       | Default-ish.                                                      |
| `stream`        | true      | Token streaming → UI feels instant.                               |

---

## 6. Response handling

LLMs sometimes ignore "no markdown" and wrap output in ` ```html ... ``` `. Sanitize before rendering:

```js
function extractHtml(raw) {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}
```

Then:
1. Show the cleaned code in the output panel (escape `<` `>` for display).
2. Set `iframe.srcdoc = cleanedHtml` for the live preview (sandboxed: `sandbox="allow-forms"`).
3. Copy button → `navigator.clipboard.writeText(cleanedHtml)`.
4. Download button → `new Blob([cleanedHtml], {type:'text/html'})` + `<a download="form.html">`.

---

## 7. Error / edge-case handling

| Case                          | Handling                                                                 |
|-------------------------------|--------------------------------------------------------------------------|
| Empty requirement             | Disable Generate button; show inline hint.                               |
| Provider 429 (rate-limited)   | Show "Daily limit reached on Provider A — retrying on Provider B"; auto-failover Cerebras → Groq → OpenRouter. |
| Network error / timeout       | Retry once with exponential backoff (1s, 2s), then surface a clear error.|
| LLM returns non-HTML garbage  | Detect: if cleaned output has no `<form` tag, show a "Regenerate" CTA.   |
| User pastes a prompt-injection | System prompt is fixed; user text is wrapped in triple quotes; we never `eval` or render user text directly outside the iframe. |

---

## 8. Repo structure (proposed)

```
/
├── index.html          # UI (textarea, buttons, code panel, preview iframe)
├── css/
│   └── styles.css      # App styling
├── js/
│   ├── app.js          # UI wiring, copy/download
│   ├── prompts.js      # System + user prompt builders
│   └── llm-client.js   # fetch() → /api/generate; handles streaming + failover
├── api/
│   └── generate.js     # Serverless proxy (Vercel/Cloudflare). Reads CEREBRAS_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY from env.
├── pipeline.md         # This file.
└── README.md
```

---

## 9. Build order

1. Static UI skeleton (`index.html` + `styles.css`) with disabled Generate button.
2. `prompts.js` with the system/user templates above.
3. `llm-client.js` that calls **Cerebras** directly first (dev mode, key in `.env`-style local config) and streams the response.
4. Code panel + live preview iframe + copy/download.
5. Move the API call behind `/api/generate` serverless proxy; remove key from frontend bundle.
6. Add Groq + OpenRouter failover paths inside the proxy.
7. Polish: provider selector, temperature slider, regenerate, "include JS validation" toggle.

---

## 10. Sources

- [DataCamp — Best LLM API Providers](https://www.datacamp.com/blog/best-llm-api-providers)
- [Cerebras free tier — 1M tokens/day, models & limits](https://tokenmix.ai/blog/cerebras-api-key-rate-limits-free-tier-2026)
- [Cerebras rate limits (official docs)](https://inference-docs.cerebras.ai/support/rate-limits)
- [Groq free tier — 30 RPM, 6K TPM, daily caps](https://tokenmix.ai/blog/groq-free-tier-limits-2026)
- [Groq rate limits (official docs)](https://console.groq.com/docs/rate-limits)
- [Groq security — do not expose keys in browser](https://console.groq.com/docs/production-readiness/security-onboarding)
- [OpenRouter free models (May 2026)](https://costgoat.com/pricing/openrouter-free-models)
- [OpenRouter free models collection](https://openrouter.ai/collections/free-models)
- [cheahjs/free-llm-api-resources (GitHub)](https://github.com/cheahjs/free-llm-api-resources)
- [Hugging Face Inference free tier](https://free-llm.com/provider/huggingface-inference)
- [Qwen3-Coder & DeepSeek coding benchmarks 2026](https://whatllm.org/best-llm-for-coding)
