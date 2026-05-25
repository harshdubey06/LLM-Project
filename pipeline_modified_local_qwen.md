# AI-Powered Form Builder Pipeline

A frontend web application where a user describes a form in natural language, and a locally hosted open-source LLM generates ready-to-use, styled form code with suitable field types and validations.

This version uses **Qwen locally through Ollama**, not a paid or hosted API provider.

Internal/student project — kept simple, practical, and demo-friendly.

---

## 1. Project objective

Build a web application where the user can describe a form in plain English and the system generates a functional, styled form.

The generated form should include:

- Appropriate input field types such as text, email, date, select, checkbox, file, number, radio, password, and textarea.
- Validation rules such as required, min/max length, regex pattern, email format, number ranges, and file restrictions where applicable.
- Layout choices such as single-column, two-column, card-based sections, or multi-step form layout.
- A live preview of the generated form.
- Exportable code with copy-to-clipboard and download options.

---

## 2. Updated high-level flow

```text
User enters form requirement
        ↓
React frontend collects the requirement
        ↓
Frontend sends request to local backend
        ↓
Backend builds system prompt + user prompt
        ↓
Backend calls local Qwen model through Ollama
        ↓
Qwen returns HTML/CSS or React form code
        ↓
Backend cleans/validates the LLM response
        ↓
Frontend displays generated code in Monaco Editor
        ↓
Frontend renders live preview in iframe
        ↓
User can copy code or download the generated file
```

---

## 3. Core architecture decision



### approach

```text
Frontend → Local backend → Ollama → Local Qwen model
```

This is better for the project because:

- It satisfies the requirement of using a locally hosted open-source LLM.
- No API key or paid provider is required.
- The backend can safely manage prompts, model configuration, errors, response cleanup, and future extensions.
- The frontend remains clean and focused only on user interaction, preview, and export.

---

## 4. Recommended tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | Main UI framework |
| Styling | Tailwind CSS | Fast responsive styling |
| Code Preview | Monaco Editor | Professional code editor panel |
| Live Preview | Sandboxed iframe | Render generated HTML safely |
| Backend | Node.js + Express | API layer between frontend and Ollama |
| Local LLM Runtime | Ollama | Runs local open-source models |
| Local Model | Qwen Coder | Generates form code |

---

## 5. Recommended local model

Use Qwen through Ollama.

### Recommended starting model

```bash
ollama pull qwen2.5-coder:7b
```

Run/test it locally:

```bash
ollama run qwen2.5-coder:7b
```

### Why this model

- Good for code generation tasks.
- Practical for local development.
- Works well for HTML, CSS, JavaScript, and React generation.
- Easier to run locally compared to very large coder models.


---

## 6. UI components

| # | Component | Purpose |
|---|---|---|
| 1 | Requirement textarea | User describes the form in natural language |
| 2 | Optional wizard fields | Helps collect field names, field count, validations, and layout preference |
| 3 | Generate button | Sends the requirement to backend and shows loading state |
| 4 | Monaco code editor | Displays generated HTML or React code |
| 5 | Live preview iframe | Renders the generated form using `srcDoc` |
| 6 | Copy code button | Copies generated code to clipboard |
| 7 | Download button | Downloads generated code as `.html` or `.jsx` |
| 8 | Output mode selector | Allows user to choose plain HTML or React output |
| 9 | Regenerate button | Re-runs the same prompt if output quality is not acceptable |

Recommended first version:

- Start with one textarea.
- Generate self-contained HTML first.
- Add React output mode later.
- Add wizard-style input later if required.

---

## 7. Backend API design

### Endpoint

```http
POST /api/generate-form
```

### Request body

```json
{
  "requirement": "Create a registration form with name, email, password, date of birth and resume upload. Use a two-column layout and add proper validations.",
  "outputType": "html"
}
```

### Response body

```json
{
  "success": true,
  "code": "<!DOCTYPE html>...",
  "outputType": "html"
}
```

### Error response

```json
{
  "success": false,
  "error": "Unable to generate valid form code. Please try again."
}
```

---

## 8. Ollama integration

The backend should call Ollama locally.

### Ollama generate endpoint

```text
http://localhost:11434/api/generate
```

### Recommended backend call shape

```js
const response = await fetch("http://localhost:11434/api/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "qwen2.5-coder:7b",
    prompt: finalPrompt,
    stream: false,
    options: {
      temperature: 0.2,
      top_p: 0.9
    }
  })
});
```

For the first version, use `stream: false` because it is simpler to implement and debug. Streaming can be added later.

---

## 9. Prompt design

Prompting must be strict because the generated code will be directly previewed in the browser.

### System prompt for HTML output

```text
You are an expert frontend developer specializing in clean, accessible HTML and CSS forms.

When the user describes a form, output a SINGLE, self-contained HTML document that:
- Includes <!DOCTYPE html>, <html>, <head>, and <body>.
- Includes a <style> block in the <head> with all CSS inside it.
- Does not use external CSS, external fonts, external icons, or external JavaScript.
- Uses semantic HTML5 form elements such as <form>, <fieldset>, <legend>, <label>, <input>, <select>, <textarea>, and <button>.
- Associates every form control with a visible <label> using matching for and id attributes.
- Adds suitable attributes such as type, id, name, required, placeholder, pattern, min, max, minlength, maxlength, autocomplete, and aria-describedby only when relevant.
- Uses correct input types such as text, email, tel, number, date, time, radio, checkbox, file, and password when appropriate.
- Applies the validation rules mentioned by the user.
- Follows the requested layout: single-column, two-column, card sections, or multi-step, as applicable.
- Is responsive and mobile-first.
- Uses a clean modern visual style with spacing, readable font sizes, rounded corners, clear focus states, and accessible color contrast.
- Includes a submit button with type="submit".
- Does not include fake backend URLs or non-working form actions unless explicitly requested.

Output rules:
- Return ONLY the HTML code.
- Do not include markdown fences.
- Do not include explanations before or after the code.
- Do not include comments or commentary inside the code.
- If JavaScript is required, place it inside a <script> tag at the end of <body>.
```

### User prompt template

```text
Build a form for the following requirement:

"""
{{USER_REQUIREMENT}}
"""

Output type: {{OUTPUT_TYPE}}

Return only the code.
```

---

## 10. Generation parameters

| Parameter | Value | Reason |
|---|---:|---|
| `temperature` | `0.2` | More predictable, less random code |
| `top_p` | `0.9` | Balanced token sampling |
| `stream` | `false` initially | Easier first implementation |
| `max tokens` | Not fixed in Ollama generate call | Output size handled naturally by local model |

Later, streaming can be enabled to improve perceived speed.

---

## 11. Response handling

LLMs may still return markdown fences even after being instructed not to. Clean the output before rendering.

```js
function extractCode(raw) {
  if (!raw || typeof raw !== "string") return "";

  const fenced = raw.match(/```(?:html|jsx|javascript|react)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}
```

### Validation before preview

For HTML output:

```js
function isValidHtmlForm(code) {
  return code.includes("<form") && code.includes("</form>");
}
```

### Frontend rendering steps

1. Clean the LLM response.
2. Show cleaned code in Monaco Editor.
3. Set preview iframe value using:

```js
iframe.srcdoc = cleanedCode;
```

4. Copy code using:

```js
navigator.clipboard.writeText(cleanedCode);
```

5. Download code using:

```js
const blob = new Blob([cleanedCode], { type: "text/html" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "generated-form.html";
a.click();
URL.revokeObjectURL(url);
```

---

## 12. Error and edge-case handling

| Case | Handling |
|---|---|
| Empty requirement | Disable Generate button and show inline message |
| Ollama not running | Show: `Ollama is not running. Start it using ollama serve.` |
| Model not installed | Show: `Qwen model not found. Run ollama pull qwen2.5-coder:7b.` |
| Network error | Retry once, then show clear error |
| Invalid/non-form output | Show regenerate option and keep previous valid output if available |
| Very vague user prompt | Still generate a reasonable form using inferred fields |
| Markdown fence returned | Strip fence before displaying/previewing |
| HTML has no `<form>` tag | Reject output and ask user to regenerate |

---

## 13. Proposed repository structure

```text
/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── PromptPanel.jsx
│       │   ├── CodeEditor.jsx
│       │   ├── LivePreview.jsx
│       │   └── Toolbar.jsx
│       ├── services/
│       │   └── formApi.js
│       └── utils/
│           └── extractCode.js
│
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── prompts.js
│   └── ollamaClient.js
│
├── pipeline.md
└── README.md
```

---

## 14. Build order

### Phase 1 — Basic working version

1. Set up React + Vite frontend.
2. Set up Tailwind CSS.
3. Create UI with textarea, generate button, code panel, and preview iframe.
4. Set up Express backend.
5. Connect backend to local Ollama Qwen.
6. Generate self-contained HTML only.
7. Add response cleanup.
8. Add live preview.
9. Add copy and download buttons.

### Phase 2 — Improved UI

1. Replace simple code panel with Monaco Editor.
2. Add output mode selector: HTML / React.
3. Add layout preference dropdown.
4. Add optional wizard-style inputs for field count, field names, input types, and validation rules.
5. Add regenerate button.

### Phase 3 — Better generation quality

1. Add stricter prompt templates.
2. Add validation checks before preview.
3. Add fallback prompt if first output is invalid.
4. Add example prompts for users.
5. Add optional JavaScript validation toggle.

---

## 15. Frontend implementation notes

### Recommended UI layout

```text
--------------------------------------------------
| AI-Powered Form Builder                         |
--------------------------------------------------
| Left panel                  | Right panel       |
| Requirement textarea        | Live preview      |
| Layout selector             |                  |
| Output type selector        |                  |
| Generate button             |                  |
--------------------------------------------------
| Monaco Editor with generated code               |
| Copy button | Download button | Regenerate        |
--------------------------------------------------
```

### Preview iframe

Use sandboxing:

```html
<iframe sandbox="allow-forms allow-scripts" title="Generated form preview"></iframe>
```

For first version, generated HTML should avoid JavaScript unless explicitly requested.

---

## 16. Backend implementation notes

The backend should:

- Receive the frontend requirement.
- Validate the input is not empty.
- Build the final prompt.
- Call Ollama locally.
- Extract the model response.
- Clean markdown fences if present.
- Validate whether a form exists.
- Return clean code to frontend.

Do not store API keys because this version does not use hosted LLM APIs.

---

## 17. Local setup commands

### Install Ollama model

```bash
ollama pull qwen2.5-coder:7b
```

### Start Ollama

```bash
ollama serve
```

If Ollama is already running as a background service, this command may not be required.

### Backend setup

```bash
cd backend
npm install
npm run dev
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

---

## 18. Final project scope

The final deliverable should include:

- React frontend.
- Tailwind-based clean UI.
- Local Express backend.
- Ollama + Qwen integration.
- Natural-language form generation.
- Monaco code preview.
- Live form preview.
- Copy-to-clipboard option.
- Download generated form option.
- Basic error handling for Ollama/model failures.

---

## 19. Key change summary

The project no longer depends on:

- Cerebras
- OpenRouter
- Hosted API keys
- Direct frontend-to-LLM API calls

The project now depends on:

- Local Ollama runtime
- Local Qwen model
- Backend-mediated LLM calls

This keeps the application aligned with the requirement: **use a locally hosted open-source LLM to generate functional form code from natural language.**
