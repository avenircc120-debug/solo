import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API Groq non configurée sur le serveur." });
  }

  const { model = "llama-3.3-70b-versatile", messages, temperature = 0.85, max_tokens = 600 } = req.body;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
    });

    if (!response.ok) {
      const errData = await response.json();
      return res.status(response.status).json({
        error: errData.error?.message ?? `Erreur ${response.status}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Erreur serveur" });
  }
}
