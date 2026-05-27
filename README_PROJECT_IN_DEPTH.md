# Project In-Depth: AI-Powered Form Builder Architecture

## 1. System Overview
**A 100% private, locally run, AI-Powered Form Builder** that takes natural language requests, refines them through a conversational agent, generates a validated JSON form schema, and compiles it into either modern responsive HTML or a fully-configured React+Vite workspace.

## 2. Dynamic Architecture & Data Flow

```text
[User Request (Chat/Wizard)]
            │
            ▼
┌────────────────────────────────┐
│   React Frontend (App.jsx)     │
└───────────┬────────────────────┘
            │ 
            │ (HTTP POST JSON payload)
            ▼
┌────────────────────────────────┐
│  Express Backend (server.js)   │
│  - Prompts Builder (prompts.js)│
└───────────┬────────────────────┘
            │
            │ (Local API: http://localhost:11434)
            ▼
┌────────────────────────────────┐
│     Ollama LLM Runtime         │
│     (qwen2.5-coder:14b)        │
└───────────┬────────────────────┘
            │
            │ (Plain text generated code)
            ▼
┌────────────────────────────────┐
│  Backend Cleanup & Validation  │
│  - Regex Code Extractor        │
│  - codeValidator.js            │
└───────────┬────────────────────┘
            │
            ├── [Invalid Code] ──► [Auto-Repair Loop (1 retry)]
            │
            ▼ [Valid Code]
┌────────────────────────────────┐
│   React Frontend (App.jsx)     │
│  - Monaco Editor Display       │
│  - Safe IFrame Live Preview    │
│  - JSZip React Vite Exporter   │
└────────────────────────────────┘
```

## 3. The Generation Pipeline (Under the Hood)
* **The Parser/Schema Builder:** The backend instructs the LLM to analyze the natural-language chat transcripts and format them into a strict, predefined JSON schema representation.
* **The Code Generators:** Once the schema is locked, the backend uses targeted system prompts to instruct the LLM to write clean HTML/CSS or structured React components strictly based on that schema.
* **The Validator & Auto-Repair Mechanism:** To prevent the LLM from hallucinating invalid markup, `codeValidator.js` reviews the LLM's output for accessibility (labels matching input IDs, valid HTML tags). If it fails, the backend automatically feeds the validation errors back to the LLM for a self-correcting "repair loop."

## 4. Intelligent Layout Systems
The AI-Powered Form Builder intelligently handles layout generation by applying specific CSS and structural rules based on the user's layout preference:

* **Single-Column Layout:** The classic, vertically stacked form layout where each label and input field sits on its own row. Clean and mobile-friendly.
* **Two-Column Layout:** A responsive grid-based layout. On desktop screens, related fields sit side-by-side to save vertical space. On mobile screens, the grid automatically collapses back into a single vertical column.
* **Card-Sections Layout:** A layout that visually groups related fields into distinct, separated blocks with borders and shading. Ideal for forms that need logical separation (e.g., "Personal Info" vs "Billing Info").
* **Multi-Step (Wizard) Layout:** A progressive disclosure layout. The form is broken down into sequential steps requiring client-side state (vanilla JS for HTML or `useState` for React) to manage "Next" and "Previous" navigation. This reduces cognitive load on very long forms.

## 5. In-Depth Look at the Three Operation Modes
* **Chat Mode (Conversational Interview):** The system maintains a conversational history, refining fields step-by-step. It asks follow-up questions for missing validations or types, using a trigger word (`READY_TO_FINALIZE`) to initiate schema parsing once the user is satisfied.
* **Wizard Mode:** A visual panel lets users manually construct a form schema with detailed field options, support for complex validation controls, and dynamic option grids for dropdown elements. 
* **Schema Mode (Direct JSON Code):** The raw configuration layer that serves as the single source of truth for the HTML/React generator. Users can modify the raw JSON directly to tweak the output.

## 6. Technical Details of the Export Mechanics
* **HTML Mode:** Compiles a standalone, self-contained HTML page containing all required styles, `<form>` elements, and responsive grids. 
* **React Mode:** Using `jszip` on the client side, it dynamically scaffolds a complete Vite project template. It bundles `package.json`, `vite.config.js`, `tailwind.config.js`, `main.jsx`, and drops the generated component perfectly into `src/components/GeneratedForm.jsx`.

## 7. Key Advantages of this Architecture
* **Local Privacy and Zero Cost:** Utilizes Ollama + Qwen 2.5-Coder 14B entirely locally, meaning no API costs and no sensitive data ever leaving the host machine.
* **Strict Validation Safety:** Solves the standard LLM problem of "hallucinated markup" by running a rigorous custom validator on the server before sending code to the frontend.
* **Highly Modular Design:** The clean separation of concerns (Frontend UI -> Express API Controller -> Local LLM Runner) makes the architecture extremely scalable and easy to extend.
