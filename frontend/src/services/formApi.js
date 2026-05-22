export async function generateForm(payload) {
  const response = await fetch("/api/generate-form", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to generate valid form code.");
  }

  return data;
}
