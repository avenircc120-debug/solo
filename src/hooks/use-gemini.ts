import { useState, useEffect } from 'react';

export interface GeminiRequest {
  prompt: string;
  style: string;
  duration: string;
  language: string;
}

export function useGemini() {
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) setGeminiKey(savedKey);
  }, []);

  const saveKey = (key: string) => {
    localStorage.setItem('GEMINI_API_KEY', key);
    setGeminiKey(key);
  };

  const generateVideoScript = async ({ prompt, style, duration, language }: GeminiRequest) => {
    if (!geminiKey) {
      setError("Clé API Gemini manquante. Veuillez la configurer dans les paramètres.");
      return;
    }

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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: {
              temperature: 0.85,
              maxOutputTokens: 600,
            }
          })
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `Erreur ${response.status}`);
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
    geminiKey,
    saveKey,
    generateVideoScript,
    isGenerating,
    error,
    result
  };
}
