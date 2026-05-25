const allowedLayouts = ["single-column", "two-column", "card-sections", "multi-step"];
const allowedFieldTypes = [
  "text",
  "email",
  "password",
  "tel",
  "number",
  "date",
  "time",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "file"
];
const allowedValidationKeys = [
  "required",
  "minLength",
  "maxLength",
  "min",
  "max",
  "pattern",
  "email",
  "acceptedFileTypes",
  "maxFileSizeMB"
];

export function buildInterviewMessages({ messages, layoutPreference, outputType, latestUserMessage }) {
  return [
    {
      role: "system",
      content: `You are a form-requirement interviewer.
Your job is to collect enough information to build a complete web form.
Ask concise questions about missing field names, field types, validations, options, and layout.
Ask at most 3 questions per response.
Maintain a short "Current form draft" summary after your questions.
If the user provides multiple fields in one message, capture all fields in the current draft.
Ask grouped follow-up questions for missing types and validations.
Avoid one-question-per-field unless the user gave only one unclear field.
Do not use markdown syntax.
Do not use bold markers.
Do not prefix lines with "User:" or "Assistant:".
Write plain text only.
Do not generate code.
Do not output JSON.
Do not finalize until the user clearly confirms with words like "ok final done", "final", "done", or "generate now".
If the user confirms finalization, respond with exactly: READY_TO_FINALIZE`
    },
    {
      role: "user",
      content: `Conversation so far:
${formatConversation(messages)}

Known UI preferences:
- layoutPreference: ${layoutPreference}
- outputType: ${outputType}

Latest user message:
"""
${latestUserMessage}
"""

Continue the requirement interview. If the user has clearly finalized, return exactly READY_TO_FINALIZE.`
    }
  ];
}

export function buildSchemaMessages({ messages, layoutPreference, outputType, fieldCount, manualFields }) {
  return [
    {
      role: "system",
      content: `You are a precise form-requirement parser.
Convert the finalized conversation transcript into a strict JSON form schema.
Return only valid JSON.
Do not include markdown.
Do not include explanations.
Use only the allowed field types and validation keys.
If the user omits reasonable details, infer conservative defaults.
Never invent backend endpoints.
If the user gives a numeric range, preserve the exact min and max values.
Do not convert percentages or marks out of 100 into a 0-10 scale.
Do not invent minlength, maxlength, pattern, or range validations unless explicitly stated.
If the user says "both fields", apply the same validation to both referenced fields.
If the user asks for two-column layout, schema.layout must be "two-column".
If the user asks for two-column layout, do not infer multi-step.`
    },
    {
      role: "user",
      content: `Allowed layouts:
${allowedLayouts.map((layout) => `- ${layout}`).join("\n")}

Allowed field types:
${allowedFieldTypes.map((type) => `- ${type}`).join("\n")}

Allowed validation keys:
${allowedValidationKeys.map((key) => `- ${key}`).join("\n")}

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
${formatConversation(messages)}
"""

Explicit layout preference from UI:
${layoutPreference}

Explicit output type from UI:
${outputType}

Explicit field count from UI if provided:
${fieldCount || ""}

Manual field overrides if provided:
${JSON.stringify(manualFields || [])}

If manual field overrides are present, include those fields exactly unless the conversation clearly contradicts them.`
    }
  ];
}

export function buildHtmlMessages({ schema }) {
  return [
    {
      role: "system",
      content: `You are an expert frontend engineer.
Generate one self-contained, accessible HTML document from the provided form schema.
Return only HTML.
Do not include markdown.
Do not include explanations.
Do not use external CSS, fonts, scripts, images, or CDNs.`
    },
    {
      role: "user",
      content: `Generate a complete HTML document for this form schema:

${JSON.stringify(schema, null, 2)}

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
- If layout is two-column, use a CSS grid with two columns on desktop and one column on mobile.
- If layout is not multi-step, do not include Previous or Next buttons.
- If layout is not multi-step, do not include step JavaScript.
- For multi-step layout only, include small vanilla JavaScript for Previous/Next navigation and final submit.
- Include one submit button.
- Do not disable the submit button by default.
- Do not include a form action unless explicitly present in the schema.
- Keep styling modern, responsive, and accessible.`
    }
  ];
}

export function buildReactMessages({ schema }) {
  return [
    {
      role: "system",
      content: `You are an expert React engineer.
Generate one exportable React component from the provided form schema.
Return only JSX/JavaScript code.
Do not include markdown.
Do not include explanations.
Do not import external libraries.
Follow the examples' structure exactly: default function name, local style objects, no imports, semantic labels, exact validation props.`
    },
    {
      role: "user",
      content: `Generate a React component for this form schema:

${JSON.stringify(schema, null, 2)}

Few-shot example for two-column React output:

Schema:
{
  "title": "College Admission Form",
  "layout": "two-column",
  "sections": [
    {
      "id": "main",
      "title": "Candidate Details",
      "fields": [
        {
          "id": "candidateName",
          "label": "Candidate Name",
          "type": "text",
          "required": true,
          "placeholder": "",
          "autocomplete": "",
          "validation": {},
          "options": []
        },
        {
          "id": "twelfthMarks",
          "label": "12th Marks",
          "type": "number",
          "required": true,
          "placeholder": "",
          "autocomplete": "",
          "validation": {
            "min": 0,
            "max": 100
          },
          "options": []
        }
      ]
    }
  ],
  "submitLabel": "Submit"
}

Correct React output shape:
export default function GeneratedForm() {
  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f4f7fb",
      padding: "32px",
      fontFamily: "Arial, sans-serif",
      color: "#182033"
    },
    form: {
      maxWidth: "820px",
      margin: "0 auto",
      background: "#ffffff",
      border: "1px solid #d9e0ea",
      borderRadius: "8px",
      padding: "24px",
      boxShadow: "0 16px 45px rgba(25, 38, 70, 0.08)"
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "16px"
    },
    field: {
      display: "grid",
      gap: "6px"
    },
    label: {
      fontWeight: 700
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid #bec8d6",
      borderRadius: "8px",
      padding: "11px 12px"
    },
    actions: {
      gridColumn: "1 / -1",
      marginTop: "8px"
    },
    button: {
      border: 0,
      borderRadius: "8px",
      background: "#2563eb",
      color: "#ffffff",
      padding: "12px 16px",
      fontWeight: 700
    }
  };

  return (
    <main style={styles.page}>
      <form style={styles.form}>
        <h1>College Admission Form</h1>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Candidate Details</legend>
          <div style={styles.grid}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="candidateName">Candidate Name</label>
              <input style={styles.input} id="candidateName" name="candidateName" type="text" required />
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="twelfthMarks">12th Marks</label>
              <input style={styles.input} id="twelfthMarks" name="twelfthMarks" type="number" required min="0" max="100" />
            </div>
            <div style={styles.actions}>
              <button style={styles.button} type="submit">Submit</button>
            </div>
          </div>
        </fieldset>
      </form>
    </main>
  );
}

Few-shot example for select field:

Correct select output shape:
export default function GeneratedForm() {
  return (
    <form>
      <label htmlFor="course">Course</label>
      <select id="course" name="course" required>
        <option value="">Select Course</option>
        <option value="bsc">BSc</option>
        <option value="ba">BA</option>
      </select>
      <button type="submit">Submit</button>
    </form>
  );
}

Hard requirements:
- Export a default function named GeneratedForm.
- The first line of the returned code must be: export default function GeneratedForm() {
- Do not write import statements.
- Use semantic form elements.
- Every control must have a visible label with matching htmlFor/id.
- Use the exact fields from the schema. Do not add or remove fields.
- Apply validation attributes from the schema.
- Preserve exact numeric validation values from schema, such as min="0" and max="100".
- Use inline styles or locally defined style objects only.
- Do not use Tailwind classes in generated React unless the user explicitly asks for Tailwind output.
- Include controlled state only if needed for multi-step navigation or grouped checkbox handling.
- For two-column layout, include a local style object with gridTemplateColumns: "repeat(2, minmax(0, 1fr))".
- If layout is not multi-step, do not include Previous or Next buttons.
- If layout is not multi-step, do not include multi-step state.
- For multi-step layout only, implement Previous/Next state locally with useState.
- Include one submit button.
- Do not disable the submit button by default.
- Do not call external APIs.`
    }
  ];
}

export function buildRepairMessages({ schema, outputType, code, errors }) {
  return [
    {
      role: "system",
      content: `You repair generated form code.
Return only corrected code.
Do not include markdown.
Do not include explanations.`
    },
    {
      role: "user",
      content: `The generated code failed validation.

Form schema:
${JSON.stringify(schema, null, 2)}

Validation errors:
${JSON.stringify(errors, null, 2)}

Bad code:
${code}

Return corrected ${outputType} code only.
Keep the same fields and validations from the schema.
Fix only the listed validation errors.
Do not add new fields, new validations, new buttons, or new JavaScript behavior.
For two-column layout, use CSS grid with two columns on desktop and one column on mobile.
For non-multi-step layouts, do not include Previous or Next buttons.
Do not disable the submit button by default.`
    }
  ];
}

function formatConversation(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) return "(no previous messages)";

  return messages
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${String(message.content || "").trim()}`)
    .join("\n");
}
