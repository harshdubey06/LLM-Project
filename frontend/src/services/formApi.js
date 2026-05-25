export async function chatRequirements(payload) {
  return postJson("/api/chat-requirements", payload);
}

export async function finalizeForm(payload) {
  return postJson("/api/finalize-form", payload);
}

export async function generateFromSchema(payload) {
  return postJson("/api/generate-from-schema", payload);
}

export async function generateForm(payload) {
  return postJson("/api/generate-form", payload);
}

async function postJson(url, payload, attempt = 1) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      const details = Array.isArray(data.details) && data.details.length > 0 ? ` ${data.details.join(" ")}` : "";
      throw new Error(`${data.error || "Request failed."}${details}`);
    }

    return data;
  } catch (error) {
    if (attempt === 1 && error instanceof TypeError) {
      return postJson(url, payload, 2);
    }

    throw error;
  }
}
