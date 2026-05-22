export async function generateForm(payload) {
  const response = await postGenerateForm(payload);

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to generate valid form code.");
  }

  return data;
}

async function postGenerateForm(payload, attempt = 1) {
  try {
    return await fetch("/api/generate-form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (attempt === 1) {
      return postGenerateForm(payload, 2);
    }

    throw error;
  }
}
