const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";

export async function generateWithOllama(prompt) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.9
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Ollama request failed with status ${response.status}`);
  }

  return extractCode(data.response || "");
}

function extractCode(raw) {
  if (!raw || typeof raw !== "string") return "";

  const fenced = raw.match(/```(?:html|jsx|javascript|react)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}
