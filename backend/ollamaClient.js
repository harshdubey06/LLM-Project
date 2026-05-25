export const OLLAMA_CHAT_URL = process.env.OLLAMA_CHAT_URL || "http://localhost:11434/api/chat";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:14b";
export const OLLAMA_NUM_CTX = parsePositiveInteger(process.env.OLLAMA_NUM_CTX, 8192);

export async function chatWithOllama(messages, options = {}) {
  let response;

  try {
    response = await fetch(OLLAMA_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          num_ctx: OLLAMA_NUM_CTX,
          temperature: 0.1,
          top_p: 0.8,
          repeat_penalty: 1.05,
          ...options
        }
      })
    });
  } catch (error) {
    const rawMessage = [error?.message, error?.cause?.message].filter(Boolean).join(": ");
    throw new Error(`Ollama request failed at ${OLLAMA_CHAT_URL} with ${OLLAMA_MODEL}: ${rawMessage || error}`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Ollama request failed with status ${response.status}`);
  }

  return String(data.message?.content || "").trim();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function extractCode(raw) {
  if (!raw || typeof raw !== "string") return "";

  const fenced = raw.match(/```(?:html|jsx|javascript|react|json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}
