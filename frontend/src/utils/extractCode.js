export function extractCode(raw) {
  if (!raw || typeof raw !== "string") return "";

  const fenced = raw.match(/```(?:html|jsx|javascript|react)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}
