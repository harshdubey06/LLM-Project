import http from "node:http";
import https from "node:https";

export const OLLAMA_CHAT_URL = process.env.OLLAMA_CHAT_URL || "http://localhost:11434/api/chat";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:14b";
export const OLLAMA_NUM_CTX = parsePositiveInteger(process.env.OLLAMA_NUM_CTX, 8192);

export async function chatWithOllama(messages, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(OLLAMA_CHAT_URL);
    const postData = JSON.stringify({
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
    });

    const lib = url.protocol === "https:" ? https : http;
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      },
      timeout: 900000 // 15 minutes timeout to handle slow generation/ingestion on CPU
    };

    const req = lib.request(reqOptions, (res) => {
      let responseBody = "";

      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        let data = {};
        try {
          if (responseBody) {
            data = JSON.parse(responseBody);
          }
        } catch (e) {
          // ignore parsing error here and check response ok
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(data.error || `Ollama request failed with status ${res.statusCode}`));
        } else {
          resolve(String(data.message?.content || "").trim());
        }
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("Connection timed out (no response from Ollama after 15 minutes)"));
    });

    req.on("error", (error) => {
      const rawMessage = [error?.message, error?.cause?.message].filter(Boolean).join(": ");
      reject(new Error(`Ollama request failed at ${OLLAMA_CHAT_URL} with ${OLLAMA_MODEL}: ${rawMessage || error}`));
    });

    req.write(postData);
    req.end();
  });
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
