export function validateGeneratedCode(code, outputType, schema) {
  const errors = [];
  const text = String(code || "").trim();

  if (!text) {
    return ["Generated code is empty."];
  }

  if (!/<form[\s>]/i.test(text)) {
    errors.push("Generated code must include a form element.");
  }

  if (!/<button[^>]*type=["']submit["']/i.test(text)) {
    errors.push("Generated code must include a submit button.");
  }

  if (outputType === "html") {
    if (!/<!doctype html>/i.test(text)) errors.push("HTML output must include <!DOCTYPE html>.");
    if (!/<\/form>/i.test(text)) errors.push("HTML output must close the form element.");
    if (/<script[^>]+src=/i.test(text)) errors.push("HTML output must not include external scripts.");
    if (/<link[^>]+href=/i.test(text)) errors.push("HTML output must not include external stylesheets.");
    if (/https?:\/\//i.test(text)) errors.push("HTML output must not include remote resources.");
    if (/<button[^>]*type=["']submit["'][^>]*\sdisabled\b/i.test(text)) {
      errors.push("Submit button must not be disabled by default.");
    }
  }

  if (outputType === "react") {
    if (!/export\s+default\s+function\s+GeneratedForm/i.test(text)) {
      errors.push("React output must export a default function named GeneratedForm.");
    }

    if (/^import\s/m.test(text)) {
      errors.push("React output must not import external libraries.");
    }
  }

  for (const field of flattenFields(schema)) {
    const idPattern = new RegExp(`\\b(id|htmlFor)=["']${escapeRegExp(field.id)}["']`, "i");
    const namePattern = new RegExp(`\\bname=["']${escapeRegExp(field.id)}["']`, "i");
    const labelPattern =
      outputType === "react"
        ? new RegExp(`\\bhtmlFor=["']${escapeRegExp(field.id)}["']`, "i")
        : new RegExp(`\\bfor=["']${escapeRegExp(field.id)}["']`, "i");

    if (!idPattern.test(text)) {
      errors.push(`Generated code is missing id/htmlFor for ${field.label}.`);
    }

    if (!labelPattern.test(text)) {
      errors.push(`Generated code is missing a label bound to ${field.label}.`);
    }

    if (outputType === "html" && !namePattern.test(text)) {
      errors.push(`Generated HTML is missing name for ${field.label}.`);
    }

    validateFieldAttributes({ text, outputType, field, errors });
  }

  validateLayout({ text, outputType, schema, errors });

  return errors;
}

function validateFieldAttributes({ text, outputType, field, errors }) {
  const validation = field.validation || {};

  if (field.required && !hasAttributeForField(text, outputType, field.id, "required")) {
    errors.push(`${field.label} must include required validation.`);
  }

  const lengthMinAttribute = outputType === "react" ? "minLength" : "minlength";
  const lengthMaxAttribute = outputType === "react" ? "maxLength" : "maxlength";
  const exactAttributes = [
    ["min", validation.min],
    ["max", validation.max],
    [lengthMinAttribute, validation.minLength],
    [lengthMaxAttribute, validation.maxLength],
    ["pattern", validation.pattern],
    ["accept", validation.acceptedFileTypes]
  ];

  for (const [attribute, value] of exactAttributes) {
    if (value === undefined || value === "") continue;
    if (!hasAttributeForField(text, outputType, field.id, attribute, value)) {
      errors.push(`${field.label} must include ${attribute}="${value}".`);
    }
  }
}

function validateLayout({ text, outputType, schema, errors }) {
  const layout = schema?.layout;
  const lower = text.toLowerCase();

  if (layout !== "multi-step") {
    if (/>[\s\n]*(previous|prev)[\s\n]*</i.test(text) || />[\s\n]*next[\s\n]*</i.test(text)) {
      errors.push("Only multi-step layout may include Previous or Next buttons.");
    }

    if (/\b(nextStep|prevStep|currentStep|setStep|activeStep)\b/i.test(text)) {
      errors.push("Only multi-step layout may include step navigation logic.");
    }
  }

  if (layout === "two-column") {
    const hasGrid = /grid-template-columns\s*:\s*repeat\s*\(\s*2/i.test(text) || /grid-template-columns\s*:\s*[^;]*1fr[^;]*1fr/i.test(text);
    const hasFlexTwoColumn = /display\s*:\s*flex/i.test(text) && /flex-wrap\s*:\s*wrap/i.test(text);
    const hasTwoColumnClass = /two-column|form-grid|grid/i.test(text);

    if (!hasGrid && !hasFlexTwoColumn) {
      errors.push("Two-column layout must include desktop two-column CSS grid or equivalent flex layout.");
    }

    if (!hasTwoColumnClass && outputType === "html") {
      errors.push("Two-column layout must apply a clear grid/two-column wrapper to the fields.");
    }
  }

  if (layout === "single-column" && /grid-template-columns\s*:\s*repeat\s*\(\s*2/i.test(lower)) {
    errors.push("Single-column layout must not use a two-column field grid.");
  }
}

function hasAttributeForField(text, outputType, id, attribute, expectedValue) {
  const tag = findTagForField(text, outputType, id);
  if (!tag) return false;

  const escapedAttribute = escapeRegExp(attribute);
  if (expectedValue === undefined) {
    return new RegExp(`\\b${escapedAttribute}(\\s|=|>|})`, "i").test(tag);
  }

  const escapedValue = escapeRegExp(String(expectedValue));
  return new RegExp(`\\b${escapedAttribute}=["'{]?${escapedValue}["'}]?`, "i").test(tag);
}

function findTagForField(text, outputType, id) {
  const attrName = outputType === "react" ? "(?:id)" : "id";
  const pattern = new RegExp(`<[^>]+\\b${attrName}=["']${escapeRegExp(id)}["'][^>]*>`, "i");
  return text.match(pattern)?.[0] || "";
}

function flattenFields(schema) {
  if (!schema || !Array.isArray(schema.sections)) return [];
  return schema.sections.flatMap((section) => (Array.isArray(section.fields) ? section.fields : []));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
