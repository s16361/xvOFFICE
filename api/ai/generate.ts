export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: "XV AI is not connected yet. Add OPENAI_API_KEY in Vercel → Project Settings → Environment Variables, then redeploy." });
  const { module, prompt } = req.body || {};
  if (!["writer", "sheets", "slides"].includes(module) || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Choose Writer, Sheets or Slides and enter a prompt." });
  }
  const instructions: Record<string, string> = {
    writer: "Create a polished, well-structured document based on the user's request. Return the document text only, with clear headings and paragraphs. Do not use markdown code fences.",
    slides: 'Create a useful presentation outline. Return ONLY valid JSON: an array of 5 to 10 short slide-title strings, with a logical beginning, middle and conclusion. No markdown fences.',
    sheets: 'Create a practical spreadsheet. Return ONLY valid JSON: a two-dimensional array of cell values, with a header row and useful example rows. No markdown fences.'
  };
  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: instructions[module] },
          { role: "user", content: prompt.trim().slice(0, 12000) }
        ]
      })
    });
    const payload: any = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status === 401 ? 502 : upstream.status).json({ error: payload?.error?.message || "The AI provider rejected the request. Check the API key and model." });
    const output = payload?.choices?.[0]?.message?.content;
    if (!output) return res.status(502).json({ error: "The AI provider returned an empty response." });
    return res.status(200).json({ output });
  } catch {
    return res.status(502).json({ error: "Could not reach the AI provider. Try again in a moment." });
  }
}
