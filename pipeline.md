# Form Generator Pipeline

A web app where a user describes a form in plain English, and an open-source LLM returns ready-to-use HTML + CSS code for that form.

Internal tool — kept simple, no auth/security layer.

---

## 1. High-level flow

```
User enters requirement
        ↓
Frontend builds system prompt + user prompt
        ↓
Frontend → open-source LLM API (direct fetch)
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

| Provider       | Open-source models on free tier                                                            | Free tier limits                                                   | Speed        | Notes                                                                  |
|----------------|--------------------------------------------------------------------------------------------|--------------------------------------------------------------------|--------------|------------------------------------------------------------------------|
| **Cerebras**   | Llama 3.3 70B, Qwen3 32B, Qwen3 235B, GPT-OSS 120B, Llama 4 Scout                          | 30 RPM, 60K–100K TPM, **1M tokens/day**, 14.4K RPD, **8K ctx cap** | ~2000+ TPS   | Fastest inference of the free tier; no card; ctx cap fine for forms    |
| **OpenRouter** | Qwen3-Coder-480B (free), Llama 3.3 70B, DeepSeek-R1, Qwen 2.5 7B, Gemma 3 12B, Mistral 7B  | 20 RPM, ~50 req/day shared across all free models                  | Provider-dep | Best coding model on free tier (Qwen3-Coder-480B); strictest daily cap |

### Recommended choice

- **Primary provider:** **Cerebras** — `qwen-3-32b` or `llama-3.3-70b`
  - Largest free daily budget (1M tokens/day) → plenty of room for iteration.
  - 2000+ TPS keeps the UI snappy.
  - 8K context cap is a non-issue: form prompts + outputs fit easily.
- **Quality fallback:** **OpenRouter** — `qwen/qwen3-coder:free` (Qwen3-Coder-480B)
  - Strongest free coding model available; use when output quality matters more than speed/quota.

Both speak the OpenAI Chat Completions wire format, so we write the client once and just swap `baseURL` + model id. API key lives in a local `config.js` (gitignored); the frontend calls the provider directly with `fetch`.

---

## 4. Prompt design

### System prompt (template)

```
You are an expert front-end developer specializing in clean, accessible HTML and CSS forms.

When the user describes a form, output a SINGLE, self-contained HTML document that:
- Includes `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>`.
- Includes a `<style>` block in the `<head>` with all CSS inside it.
- Does not use external CSS, external fonts, external icons, or JavaScript unless explicitly requested.
- Uses semantic HTML5 form elements such as `<form>`, `<fieldset>`, `<legend>`, `<label>`, `<input>`, `<select>`, `<textarea>`, and `<button>`.
- Associates every form control with a visible `<label>` using matching `for` and `id` attributes.
- Adds appropriate attributes such as `type`, `id`, `name`, `required`, `placeholder`, `pattern`, `min`, `max`, `autocomplete`, and `aria-describedby` only when relevant.
- Uses correct input types such as `text`, `email`, `tel`, `number`, `date`, `time`, `radio`, `checkbox`, `file`, and `password` when appropriate.
- Is responsive and mobile-first, using a max-width container, sensible spacing, readable font sizes, and flexible layout.
- Uses a clean modern visual style with soft shadows, rounded corners, clear focus states, and accessible color contrast.
- Includes a submit button with `type="submit"`.
- Does not include fake backend URLs or non-working form actions unless the user explicitly requests them.

Output rules:
- Return ONLY the HTML code.
- Do not include markdown fences.
- Do not include explanations before or after the code.
- Do not include comments or commentary inside the file.
- If the user asks for JavaScript validation or dynamic behavior, add the JavaScript inside a `<script>` tag at the end of `<body>`.
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
| `max_tokens`    |as required| Plenty for a single form; well under Cerebras's 8K context cap.   |
| `top_p`         | 0.9       | Default-ish.                                                      |
| `stream`        | true      | Token streaming → UI feels instant.                               |

---

## 5. Response handling

LLMs sometimes ignore "no markdown" and wrap output in ` ```html ... ``` `. Sanitize before rendering:

```js
function extractHtml(raw) {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}
```

Then:
1. Show the cleaned code in the output panel (escape `<` `>` for display).
2. Set `iframe.srcdoc = cleanedHtml` for the live preview.
3. Copy button → `navigator.clipboard.writeText(cleanedHtml)`.
4. Download button → `new Blob([cleanedHtml], {type:'text/html'})` + `<a download="form.html">`.

---

## 6. Error / edge-case handling

| Case                          | Handling                                                                 |
|-------------------------------|--------------------------------------------------------------------------|
| Empty requirement             | Disable Generate button; show inline hint.                               |
| Provider 429 (rate-limited)   | Show "Daily limit reached on Cerebras — retrying on OpenRouter"; auto-failover Cerebras → OpenRouter. |
| Network error / timeout       | Retry once with exponential backoff (1s, 2s), then surface a clear error.|
| LLM returns non-HTML garbage  | Detect: if cleaned output has no `<form` tag, show a "Regenerate" CTA.   |

---

## 7. Repo structure (proposed)

```
/
├── index.html          # UI (textarea, buttons, code panel, preview iframe)
├── css/
│   └── styles.css      # App styling
├── js/
│   ├── app.js          # UI wiring, copy/download
│   ├── prompts.js      # System + user prompt builders
│   ├── llm-client.js   # fetch() → provider; handles streaming + failover
│   └── config.js       # API keys + chosen provider (gitignored)
├── pipeline.md         # This file.
└── README.md
```

---

## 8. Build order

1. Static UI skeleton (`index.html` + `styles.css`) with disabled Generate button.
2. `prompts.js` with the system/user templates above.
3. `llm-client.js` that calls **Cerebras** directly and streams the response.
4. Code panel + live preview iframe + copy/download.
5. Add OpenRouter failover path in `llm-client.js`.
6. Polish: provider selector, temperature slider, regenerate, "include JS validation" toggle.

---

## 9. Sources

- [DataCamp — Best LLM API Providers](https://www.datacamp.com/blog/best-llm-api-providers)
- [Cerebras free tier — 1M tokens/day, models & limits](https://tokenmix.ai/blog/cerebras-api-key-rate-limits-free-tier-2026)
- [Cerebras rate limits (official docs)](https://inference-docs.cerebras.ai/support/rate-limits)
- [OpenRouter free models (May 2026)](https://costgoat.com/pricing/openrouter-free-models)
- [OpenRouter free models collection](https://openrouter.ai/collections/free-models)
- [cheahjs/free-llm-api-resources (GitHub)](https://github.com/cheahjs/free-llm-api-resources)
- [Qwen3-Coder & DeepSeek coding benchmarks 2026](https://whatllm.org/best-llm-for-coding)
