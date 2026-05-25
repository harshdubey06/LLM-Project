# Gap Closure Approach: Qwen2.5-Coder 7B Form Builder

## Scope

This document maps the current project gaps to a concrete implementation approach for the assigned objective:

> Build a web application where a user describes a form in natural language and a locally hosted LLM generates a fully functional, styled form with field types, validation, live preview, and exportable React or HTML code.

The focus here is prompting Qwen2.5-Coder 7B effectively and designing the missing application flow. It intentionally avoids dependency installation instructions because this project will be run on another machine.

## Research Summary

Primary sources reviewed:

- Qwen/Qwen2.5-Coder-7B-Instruct model card: https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct
- Qwen2.5-Coder official overview: https://qwen2.org/qwen2-5-coder/
- Ollama qwen2.5-coder model page: https://ollama.com/library/qwen2.5-coder
- Qwen2.5-Coder technical report: https://arxiv.org/abs/2409.12186

Relevant findings:

- Qwen2.5-Coder is optimized for code generation, reasoning, and code repair, so it is a suitable local model for HTML/CSS/React form generation.
- The 7B instruct model is designed for chat-style usage with `system` and `user` roles. The Hugging Face model card demonstrates `apply_chat_template` using role-based messages.
- Ollama supports Qwen2.5-Coder through the `/api/chat` endpoint with role-based `messages`, and the model page lists `qwen2.5-coder:7b` as a supported model.
- The Ollama listing shows a 32K context window for `qwen2.5-coder:7b`, which is enough for a structured form schema, prompt contract, and generated output.
- Because this is a 7B local model, reliability should come from narrow prompts, deterministic settings, schema-first generation, validation, and retry/repair loops rather than one large free-form prompt.

## Current Project Gaps

### 1. Prompt UI is too shallow

Current state:

- `PromptPanel.jsx` has one textarea, output type selector, and layout selector.

Gap:

- The assignment requires collecting field names, input types, number of fields, validation rules per field, and layout preference.
- Only layout is explicitly collected today.

Required change:

- Add a conversational form interviewer as the primary flow.
- The model should ask the user about missing field details one step at a time.
- The app should not generate the final form until the user confirms with a phrase such as `ok final done`, `final`, `done`, or by pressing a "Finalize form" button.
- Keep the wizard as an optional manual override, not the only structured flow.

### 2. No structured form schema

Current state:

- Frontend sends one `requirement` string.
- Backend asks the model to generate code directly.

Gap:

- There is no intermediate representation of the form.
- This makes validation, editing, preview reliability, and regeneration weak.

Required change:

- Introduce a `FormSchema` JSON structure as the central contract.
- Generate and validate schema first, then generate code from the validated schema.

Recommended schema:

```json
{
  "title": "Registration Form",
  "description": "Collect applicant information",
  "layout": "two-column",
  "outputType": "html",
  "sections": [
    {
      "id": "personal",
      "title": "Personal Details",
      "fields": [
        {
          "id": "fullName",
          "label": "Full Name",
          "type": "text",
          "required": true,
          "placeholder": "Enter full name",
          "autocomplete": "name",
          "validation": {
            "minLength": 2,
            "maxLength": 80,
            "pattern": ""
          },
          "options": []
        }
      ]
    }
  ],
  "submitLabel": "Submit"
}
```

Supported field types:

- `text`
- `email`
- `password`
- `tel`
- `number`
- `date`
- `time`
- `textarea`
- `select`
- `radio`
- `checkbox`
- `file`

Supported validation keys:

- `required`
- `minLength`
- `maxLength`
- `min`
- `max`
- `pattern`
- `email`
- `acceptedFileTypes`
- `maxFileSizeMB`

### 3. Direct code generation is fragile

Current state:

- Backend prompt asks Qwen to directly return HTML or React code.

Gap:

- The model may ignore validation rules, invent unsupported behavior, return markdown fences, omit labels, include external resources, or produce invalid React.

Required change:

- Use a conversation-first pipeline:

1. Requirement interview: Qwen asks targeted questions about fields, types, validations, and layout.
2. Finalization trigger: user confirms that the collected data is complete.
3. Schema extraction: conversation transcript to strict JSON schema.
4. Schema validation and normalization: application code validates and repairs obvious issues.
5. Code generation: schema to HTML or React.

This makes the model solve smaller tasks and gives the app a reliable internal contract.

### 4. React preview is not actually supported

Current state:

- `LivePreview.jsx` always renders `code` through `iframe srcDoc`.
- This works for full HTML documents.
- A raw React component cannot run directly in `srcDoc`.

Gap:

- React output mode can show code in Monaco, but live preview is not functionally equivalent.

Required change:

- Use HTML as the preview format even when the export target is React.
- For React mode, ask the backend to produce:
  - `reactCode`: exportable React component.
  - `previewHtml`: equivalent self-contained HTML preview generated from the same schema.

Recommended response shape:

```json
{
  "success": true,
  "schema": {},
  "outputType": "react",
  "code": "export default function GeneratedForm() { ... }",
  "previewHtml": "<!DOCTYPE html>..."
}
```

### 5. Validation checks are too weak

Current state:

- Backend only checks that generated code contains `<form>`.

Gap:

- This does not verify field count, required labels, validation attributes, dangerous external scripts, or layout compliance.

Required change:

- Validate schema before code generation.
- Validate generated code after generation.

Minimum schema validation:

- Every field must have `id`, `label`, and `type`.
- Field type must be in the supported list.
- `select` and `radio` fields must have non-empty `options`.
- `required` must be boolean.
- `minLength`, `maxLength`, `min`, and `max` must be numeric when present.
- `pattern` must be a string when present.
- Field ids must be unique.

Minimum HTML validation:

- Contains exactly one `<form>`.
- Contains visible labels.
- No external `<script src>`, `<link href>`, external fonts, or remote assets.
- Includes a submit button.
- For every schema field, generated code contains matching `id` and `name`.

Minimum React validation:

- Contains a component function or export.
- Contains one `<form>`.
- Does not import external libraries.
- Includes a submit button.
- Avoids browser-only globals outside handlers.

### 6. No repair loop

Current state:

- If generated code fails validation, the backend returns an error.

Gap:

- Local 7B models can recover well if given a precise repair prompt.

Required change:

- Add one automatic repair attempt before failing.
- Send Qwen the original schema, bad code, and validation errors.
- Ask it to return only corrected code.

## Recommended Prompting Strategy for Qwen2.5-Coder 7B

### Use Ollama chat messages instead of one plain prompt

Current backend uses `/api/generate` with one prompt string.

Recommended backend change:

- Move to `/api/chat`.
- Send separate `system` and `user` messages.
- Keep `temperature` low.

Recommended options:

```json
{
  "temperature": 0.1,
  "top_p": 0.8,
  "repeat_penalty": 1.05
}
```

Reasoning:

- The model is an instruct/chat model.
- Role-separated prompts match the intended usage pattern.
- Low randomness improves repeatable, valid code output.

### Stage A: Conversational requirement interview

This is the first model interaction. It should collect requirements through conversation, not generate code.

The assistant should:

- Ask about fields, one group at a time.
- Ask for missing input types when unclear.
- Ask for required/optional status.
- Ask for validation rules.
- Ask for select/radio/checkbox options when needed.
- Ask for layout preference if not already selected.
- Maintain a concise running summary of collected form details.
- Stop asking questions only when the user confirms finalization.

The assistant should not:

- Generate HTML.
- Generate React.
- Return JSON schema.
- Move to code generation by itself.

System prompt:

```text
You are a form-requirement interviewer.
Your job is to collect enough information to build a complete web form.
Ask concise questions about missing field names, field types, validations, options, and layout.
Ask at most 3 questions per response.
Maintain a short "Current form draft" summary after your questions.
Do not generate code.
Do not output JSON.
Do not finalize until the user clearly confirms with words like "ok final done", "final", "done", or "generate now".
If the user confirms finalization, respond with exactly: READY_TO_FINALIZE
```

User prompt template for each turn:

```text
Conversation so far:
{{conversationMessages}}

Known UI preferences:
- layoutPreference: {{layoutPreference}}
- outputType: {{outputType}}

Latest user message:
"""
{{latestUserMessage}}
"""

Continue the requirement interview. If the user has clearly finalized, return exactly READY_TO_FINALIZE.
```

Recommended response handling:

- If the model returns `READY_TO_FINALIZE`, backend moves to schema extraction.
- Otherwise, frontend appends the assistant message to the chat and waits for the user.
- The frontend should also provide a visible "Finalize form" button so the flow is not dependent only on phrase detection.

Recommended conversation behavior:

```text
User: I need a job application form.
Assistant: Which fields should it include? For example: full name, email, phone, resume upload, portfolio URL, and availability date. Should any fields be required?

User: name email phone resume and experience
Assistant: I have 5 fields so far: name, email, phone, resume, and experience. Should experience be a number input, dropdown, or textarea? What file types should resume accept? Do you want a single-column, two-column, card-section, or multi-step layout?

User: experience is number, resume pdf only, two column, all required
Assistant: Current form draft: ...

User: ok final done
Assistant: READY_TO_FINALIZE
```

### Stage B: Conversation transcript to schema

System prompt:

```text
You are a precise form-requirement parser.
Convert the finalized conversation transcript into a strict JSON form schema.
Return only valid JSON.
Do not include markdown.
Do not include explanations.
Use only the allowed field types and validation keys.
If the user omits reasonable details, infer conservative defaults.
Never invent backend endpoints.
```

User prompt template:

```text
Allowed layouts:
- single-column
- two-column
- card-sections
- multi-step

Allowed field types:
- text, email, password, tel, number, date, time, textarea, select, radio, checkbox, file

Allowed validation keys:
- required, minLength, maxLength, min, max, pattern, email, acceptedFileTypes, maxFileSizeMB

Return JSON with this exact shape:
{
  "title": "string",
  "description": "string",
  "layout": "single-column | two-column | card-sections | multi-step",
  "sections": [
    {
      "id": "kebab-case-string",
      "title": "string",
      "fields": [
        {
          "id": "camelCaseString",
          "label": "string",
          "type": "allowed field type",
          "required": true,
          "placeholder": "string",
          "autocomplete": "string",
          "validation": {},
          "options": []
        }
      ]
    }
  ],
  "submitLabel": "string"
}

Finalized conversation transcript:
"""
{{conversationMessages}}
"""

Explicit layout preference from UI:
{{layoutPreference}}

Explicit field count from UI if provided:
{{fieldCount}}

Manual field overrides if provided:
{{manualFieldsJson}}
```

Important rules:

- Ask for JSON only.
- Do not ask the model to generate code in this stage.
- Keep enums explicit.
- Include the UI layout preference as a hard input.
- Include manual field overrides if the user used the wizard.

### Stage C: Schema to HTML

System prompt:

```text
You are an expert frontend engineer.
Generate one self-contained, accessible HTML document from the provided form schema.
Return only HTML.
Do not include markdown.
Do not include explanations.
Do not use external CSS, fonts, scripts, images, or CDNs.
```

User prompt template:

```text
Generate a complete HTML document for this form schema:

{{schemaJson}}

Hard requirements:
- Include <!DOCTYPE html>, html, head, body.
- Put all CSS in one style tag in head.
- Use semantic form elements.
- Every input/select/textarea must have a visible label with matching for/id.
- Use the exact fields from the schema. Do not add or remove fields.
- Apply validation attributes from the schema.
- Use correct input types.
- Use fieldsets and legends for sections.
- Implement the requested layout.
- For multi-step layout, include small vanilla JavaScript for Previous/Next navigation and final submit.
- Include one submit button.
- Do not include a form action unless explicitly present in the schema.
- Keep styling modern, responsive, and accessible.
```

### Stage D: Schema to React

System prompt:

```text
You are an expert React engineer.
Generate one exportable React component from the provided form schema.
Return only JSX/JavaScript code.
Do not include markdown.
Do not include explanations.
Do not import external libraries.
```

User prompt template:

```text
Generate a React component for this form schema:

{{schemaJson}}

Hard requirements:
- Export a default function named GeneratedForm.
- Use semantic form elements.
- Every control must have a visible label with matching htmlFor/id.
- Use the exact fields from the schema. Do not add or remove fields.
- Apply validation attributes from the schema.
- Use inline styles or locally defined style objects only.
- Do not use Tailwind classes in generated React unless the user explicitly asks for Tailwind output.
- Include controlled state only if needed for multi-step navigation or grouped checkbox handling.
- For multi-step layout, implement Previous/Next state locally with useState.
- Include one submit button.
- Do not call external APIs.
```

Important React decision:

- Generated React should be exportable code.
- Live preview should still use generated `previewHtml` from the same schema.
- This avoids needing runtime JSX transpilation in the preview iframe.

### Stage E: Repair prompt

System prompt:

```text
You repair generated form code.
Return only corrected code.
Do not include markdown.
Do not include explanations.
```

User prompt template:

```text
The generated code failed validation.

Form schema:
{{schemaJson}}

Validation errors:
{{errorsJson}}

Bad code:
{{code}}

Return corrected {{outputType}} code only.
Keep the same fields and validations from the schema.
```

## Recommended Application Design

### Frontend state model

Add state for:

```js
const [mode, setMode] = useState("chat"); // chat | wizard | schema
const [messages, setMessages] = useState([]);
const [requirement, setRequirement] = useState("");
const [fieldCount, setFieldCount] = useState("");
const [manualFields, setManualFields] = useState([]);
const [layoutPreference, setLayoutPreference] = useState("two-column");
const [outputType, setOutputType] = useState("html");
const [conversationStatus, setConversationStatus] = useState("collecting"); // collecting | ready | generating
const [schema, setSchema] = useState(null);
const [code, setCode] = useState("");
const [previewHtml, setPreviewHtml] = useState("");
```

### UI flow

Recommended UI:

1. Chat tab
   - Conversational message list.
   - User input box.
   - Layout selector.
   - Output type selector.
   - Send button.
   - Finalize form button.
   - The assistant asks questions until the user confirms the form is complete.
   - The app only calls schema/code generation after `READY_TO_FINALIZE` or after the user presses "Finalize form".

2. Wizard tab
   - Form title.
   - Number of fields.
   - Dynamic field rows.
   - Each row collects:
     - label,
     - type,
     - required,
     - placeholder,
     - validation preset,
     - min/max or minLength/maxLength,
     - regex pattern,
     - options for select/radio/checkbox.

3. Review schema panel
   - Show interpreted schema after finalizing the conversation.
   - Allow user to regenerate code from schema without re-parsing the natural language.

4. Output area
   - Live preview iframe uses `previewHtml`.
   - Monaco editor uses `code`.
   - Copy and download use `code`.

### Backend API design

Replace one direct generation endpoint with a schema-first response.

Recommended endpoints:

```http
POST /api/chat-requirements
POST /api/finalize-form
POST /api/generate-from-schema
```

`POST /api/chat-requirements` handles the interview phase only.

Request:

```json
{
  "messages": [
    { "role": "user", "content": "I need a job application form" }
  ],
  "layoutPreference": "two-column",
  "outputType": "html"
}
```

Response while still collecting:

```json
{
  "success": true,
  "status": "collecting",
  "message": "Which fields should it include? Should any fields be required?"
}
```

Response when finalized:

```json
{
  "success": true,
  "status": "ready_to_finalize"
}
```

`POST /api/finalize-form` converts the full conversation into schema and generated output.

Endpoint:

```http
POST /api/generate-form
```

The existing `POST /api/generate-form` can be kept for compatibility, but internally it should behave like `finalize-form`: parse the conversation or requirement into schema, validate it, generate code, then return preview/code.

Request:

```json
{
  "messages": [
    { "role": "user", "content": "I need a job application form" },
    { "role": "assistant", "content": "Which fields should it include?" },
    { "role": "user", "content": "name email phone resume, all required, ok final done" }
  ],
  "layoutPreference": "two-column",
  "outputType": "react",
  "fieldCount": 5,
  "manualFields": []
}
```

Response:

```json
{
  "success": true,
  "schema": {},
  "outputType": "react",
  "code": "export default function GeneratedForm() { ... }",
  "previewHtml": "<!DOCTYPE html>..."
}
```

### Backend module structure

Recommended files:

```text
backend/
  server.js
  ollamaClient.js
  prompts.js
  schemaValidator.js
  codeValidator.js
  formPipeline.js
```

Responsibilities:

- `ollamaClient.js`: call Ollama chat API.
- `prompts.js`: build interviewer, schema, HTML, React, and repair prompts.
- `schemaValidator.js`: validate and normalize form schema.
- `codeValidator.js`: validate generated HTML/React against schema.
- `formPipeline.js`: orchestrate interview, finalization, parse, validate, generate, repair, and return.
- `server.js`: HTTP request/response only.

## Implementation Steps

### Step 1: Add conversation-first requirement collection

- Add chat state to the frontend.
- Add a message list, input box, send button, and finalize button.
- Add `POST /api/chat-requirements`.
- Qwen should ask targeted follow-up questions and return `READY_TO_FINALIZE` only when the user confirms.
- Do not generate schema or code during this step.

### Step 2: Add schema contract

- Define supported field types, layouts, and validation keys.
- Add `schemaValidator.js`.
- Normalize missing values:
  - empty `sections` becomes one default section,
  - empty `submitLabel` becomes `Submit`,
  - missing layout falls back to UI-selected layout,
  - invalid field ids are generated from labels.

### Step 3: Switch Ollama client to chat

- Keep the existing model default as `qwen2.5-coder:7b`.
- Use `/api/chat`.
- Accept `messages` instead of one prompt string.
- Return `message.content`.

### Step 4: Add schema extraction prompt

- Use the finalized conversation transcript as input.
- Use Qwen only to return JSON.
- Parse JSON defensively.
- If JSON parse fails, attempt one cleanup/repair prompt.

### Step 5: Generate code from schema

- If `outputType === "html"`:
  - generate HTML once,
  - set both `code` and `previewHtml` to the HTML.

- If `outputType === "react"`:
  - generate React code,
  - generate HTML preview from the same schema,
  - set `code` to React and `previewHtml` to HTML.

### Step 6: Add repair loop

- Validate generated code.
- If validation fails, call repair prompt once.
- Validate again.
- If it still fails, return a clear error with validation details.

### Step 7: Upgrade frontend prompt interface

- Replace the single textarea-first flow with the chat-first flow.
- Add a wizard mode with dynamic fields.
- Add controls for:
  - field count,
  - field label,
  - input type,
  - required,
  - min/max,
  - minLength/maxLength,
  - regex,
  - options.

### Step 8: Add schema review

- Display the generated schema after parsing.
- Allow editing schema-derived fields before generating code.
- Add a "Regenerate code from schema" action.

### Step 9: Fix preview behavior

- Change `LivePreview` to receive `previewHtml`.
- Use `previewHtml` for iframe rendering.
- Do not render raw React code in iframe.

### Step 10: Improve UX feedback

- Show generation phase:
  - "Collecting requirements"
  - "Waiting for final confirmation"
  - "Building schema"
  - "Generating code"
  - "Validating output"
  - "Repairing output"
- Show copy success/failure state.
- Show model connection errors separately from validation errors.

## Prompt Quality Rules for This Project

Use these rules consistently:

- Prefer short, strict prompts over broad creative prompts.
- Give the model one job per call.
- During the interview phase, ask questions only; do not generate schema or code.
- Move to schema/code generation only after explicit user finalization or the finalize button.
- Use explicit enums for layouts, field types, and validation keys.
- Put hard requirements after the schema so they are close to the output task.
- Tell the model what not to include:
  - no markdown,
  - no explanations,
  - no external resources,
  - no fake backend endpoints.
- Use deterministic options.
- Validate every model output.
- Repair once before failing.
- Keep HTML preview and React export generated from the same schema.

## Acceptance Checklist

The project should be considered aligned with the assignment when:

- User can describe a form naturally.
- The assistant asks follow-up questions about fields, types, validations, options, and layout.
- The app waits until the user says something like `ok final done` or presses "Finalize form".
- User can use a wizard to specify field count, names, types, and validations.
- Backend creates a validated `FormSchema`.
- Qwen2.5-Coder 7B is prompted through role-based chat messages.
- Generated HTML preview works for both HTML and React output modes.
- React export produces a usable component.
- HTML export produces a complete self-contained document.
- Copy-to-clipboard works.
- Download/export works.
- Backend rejects or repairs invalid generated output.
- Generated forms include semantic labels, correct field types, and validation attributes.

## Highest-Priority Fixes

1. Add the conversation-first requirement interview.
2. Add the finalization trigger before schema/code generation.
3. Add the schema-first generation pipeline.
4. Fix React preview by generating separate `previewHtml`.
5. Add wizard fields for field count, field types, and validations.
6. Add validation and one repair pass.
7. Move Ollama calls from plain `/api/generate` prompts to role-based `/api/chat`.
