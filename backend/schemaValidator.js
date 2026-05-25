const allowedLayouts = new Set(["single-column", "two-column", "card-sections", "multi-step"]);
const allowedFieldTypes = new Set([
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
]);

export function parseJsonObject(raw) {
  const text = String(raw || "").trim();
  const jsonText = text.startsWith("{") ? text : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);

  if (!jsonText || !jsonText.startsWith("{")) {
    throw new Error("The model did not return a JSON object.");
  }

  return JSON.parse(jsonText);
}

export function normalizeAndValidateSchema(input, layoutPreference = "two-column") {
  const errors = [];
  const schema = input && typeof input === "object" ? structuredClone(input) : {};

  schema.title = cleanText(schema.title) || "Generated Form";
  schema.description = cleanText(schema.description);
  schema.layout = allowedLayouts.has(schema.layout) ? schema.layout : layoutPreference;
  schema.submitLabel = cleanText(schema.submitLabel) || "Submit";

  if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
    schema.sections = [{ id: "main", title: "Form Details", fields: [] }];
  }

  const usedFieldIds = new Set();

  schema.sections = schema.sections.map((section, sectionIndex) => {
    const normalizedSection = {
      id: toKebabCase(section?.id || section?.title || `section-${sectionIndex + 1}`),
      title: cleanText(section?.title) || `Section ${sectionIndex + 1}`,
      fields: Array.isArray(section?.fields) ? section.fields : []
    };

    normalizedSection.fields = normalizedSection.fields.map((field, fieldIndex) => {
      const label = cleanText(field?.label) || `Field ${fieldIndex + 1}`;
      let id = toCamelCase(field?.id || label);

      while (usedFieldIds.has(id)) {
        id = `${id}${fieldIndex + 1}`;
      }

      usedFieldIds.add(id);

      const type = allowedFieldTypes.has(field?.type) ? field.type : inferType(label);
      const validation = normalizeValidation(field?.validation);
      const required = typeof field?.required === "boolean" ? field.required : Boolean(validation.required);

      if (!allowedFieldTypes.has(type)) {
        errors.push(`${label} has an unsupported field type.`);
      }

      const options = Array.isArray(field?.options) ? field.options.map(cleanOption).filter(Boolean) : [];
      if ((type === "select" || type === "radio") && options.length === 0) {
        errors.push(`${label} must include options.`);
      }

      return {
        id,
        label,
        type,
        required,
        placeholder: cleanText(field?.placeholder),
        autocomplete: cleanText(field?.autocomplete),
        validation,
        options
      };
    });

    return normalizedSection;
  });

  const fieldCount = schema.sections.reduce((sum, section) => sum + section.fields.length, 0);
  if (fieldCount === 0) {
    errors.push("The schema must include at least one field.");
  }

  return {
    schema,
    errors
  };
}

function normalizeValidation(validation) {
  const source = validation && typeof validation === "object" ? validation : {};
  const normalized = {};

  for (const key of ["required", "email"]) {
    if (typeof source[key] === "boolean") normalized[key] = source[key];
  }

  for (const key of ["minLength", "maxLength", "min", "max", "maxFileSizeMB"]) {
    if (source[key] !== undefined && source[key] !== "") {
      const value = Number(source[key]);
      if (Number.isFinite(value)) normalized[key] = value;
    }
  }

  for (const key of ["pattern", "acceptedFileTypes"]) {
    const value = cleanText(source[key]);
    if (value) normalized[key] = value;
  }

  return normalized;
}

function inferType(label) {
  const value = label.toLowerCase();
  if (value.includes("email")) return "email";
  if (value.includes("password")) return "password";
  if (value.includes("phone") || value.includes("mobile")) return "tel";
  if (value.includes("date") || value.includes("dob")) return "date";
  if (value.includes("resume") || value.includes("file") || value.includes("upload")) return "file";
  if (value.includes("age") || value.includes("number") || value.includes("experience")) return "number";
  if (value.includes("message") || value.includes("description") || value.includes("address")) return "textarea";
  return "text";
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanOption(option) {
  if (typeof option === "string") return option.trim();
  if (option && typeof option === "object") return cleanText(option.label || option.value);
  return "";
}

function toKebabCase(value) {
  return (
    cleanText(value)
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function toCamelCase(value) {
  const words = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "field";

  return words
    .map((word, index) => (index === 0 ? word : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join("");
}
