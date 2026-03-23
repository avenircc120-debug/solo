import { useState } from 'react';

export interface GeminiRequest {
  prompt: string;
  style: string;
  duration: string;
  language: string;
}

export function useGemini() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  const generateVideoScript = async ({ prompt, style, duration, language }: GeminiRequest) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    const systemPrompt = `Tu es un expert en création de scripts vidéo courts et percutants pour les réseaux sociaux.`;
    const userPrompt = `Crée un script vidéo court (${duration}) sur : "${prompt}"
Style : ${style}
Langue : ${language}
Format : EXACTEMENT 3 segments de texte à l'écran, séparés par "---".
Chaque segment : 1-2 phrases percutantes. NE METS AUCUN AUTRE TEXTE QUE LES SEGMENTS.`;

    try {
      const response = await fetch("/api/gemini", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 600,
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error ?? `Erreur ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      
      const segments = text.split('---').map((s: string) => s.trim()).filter(Boolean);
      
      if (segments.length === 0) {
        throw new Error("Le format du script généré est invalide.");
      }

      setResult(segments);
    } catch (err: any) {
      setError(err.message || "Une erreur inattendue est survenue");
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    geminiKey: '',
    saveKey: () => {},
    generateVideoScript,
    isGenerating,
    error,
    result
  };
}
