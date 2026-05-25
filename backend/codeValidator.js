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

    if (!idPattern.test(text)) {
      errors.push(`Generated code is missing id/htmlFor for ${field.label}.`);
    }

    if (outputType === "html" && !namePattern.test(text)) {
      errors.push(`Generated HTML is missing name for ${field.label}.`);
    }
  }

  return errors;
}

function flattenFields(schema) {
  if (!schema || !Array.isArray(schema.sections)) return [];
  return schema.sections.flatMap((section) => (Array.isArray(section.fields) ? section.fields : []));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
