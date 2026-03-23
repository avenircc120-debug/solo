import { useState } from "react";

// ── Détection de service par préfixe ──────────────────────────
export type ServiceKey =
  | "github" | "vercel" | "netlify"
  | "openai" | "groq" | "xai" | "gemini"
  | "huggingface" | "supabase" | "unknown";

export interface DetectedService {
  key: ServiceKey;
  name: string;
  color: string;
  icon: string;
}

export function detectService(token: string): DetectedService {
  const t = token.trim();
  if (t.startsWith("ghp_") || t.startsWith("github_pat_") || t.startsWith("gho_"))
    return { key: "github", name: "GitHub", color: "text-white bg-white/10 border-white/20", icon: "🐙" };
  if (t.startsWith("sk-") || t.startsWith("sk-proj-"))
    return { key: "openai", name: "OpenAI", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: "🤖" };
  if (t.startsWith("gsk_"))
    return { key: "groq", name: "Groq", color: "text-orange-400 bg-orange-500/10 border-orange-500/20", icon: "⚡" };
  if (t.startsWith("xai-"))
    return { key: "xai", name: "xAI (Grok)", color: "text-sky-400 bg-sky-500/10 border-sky-500/20", icon: "✦" };
  if (t.startsWith("hf_"))
    return { key: "huggingface", name: "HuggingFace", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: "🤗" };
  if (t.startsWith("AIzaSy"))
    return { key: "gemini", name: "Google Gemini", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: "✦" };
  if (t.startsWith("eyJ"))
    return { key: "supabase", name: "Supabase", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: "🔷" };
  if (t.length >= 20 && t.length <= 30)
    return { key: "vercel", name: "Vercel", color: "text-white bg-white/10 border-white/20", icon: "▲" };
  return { key: "unknown", name: "Inconnu", color: "text-white/40 bg-white/5 border-white/10", icon: "?" };
}

// ── Appel Gemini pour analyser et planifier ────────────────────
async function callGemini(geminiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

// ── Actions GitHub ─────────────────────────────────────────────
async function githubFetch(token: string, path: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

async function githubPut(token: string, path: string, body: object) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Actions Vercel ─────────────────────────────────────────────
async function vercelFetch(token: string, path: string) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Vercel ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Hook principal ─────────────────────────────────────────────
export interface LogEntry {
  type: "info" | "success" | "error" | "action" | "plan";
  message: string;
  detail?: string;
}

export function useAutoConfig() {
  const [token, setToken] = useState("");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("gemini_key") ?? "");
  const [service, setService] = useState<DetectedService | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [repos, setRepos] = useState<{ name: string; full_name: string; private: boolean }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [plan, setPlan] = useState("");
  const [phase, setPhase] = useState<"idle" | "detected" | "scanning" | "planning" | "executing" | "done">("idle");

  const saveGeminiKey = (key: string) => {
    setGeminiKey(key);
    localStorage.setItem("gemini_key", key);
  };

  const log = (entry: LogEntry) => setLogs(prev => [...prev, entry]);
  const clearLogs = () => setLogs([]);

  // 1. Détecter le service
  const detect = () => {
    const s = detectService(token);
    setService(s);
    setPhase("detected");
    clearLogs();
    setPlan("");
    setRepos([]);
    setSelectedRepo("");
    log({ type: "success", message: `Service détecté : ${s.name} ${s.icon}` });
  };

  // 2. Scanner le projet (GitHub : liste les repos / Vercel : liste les projets)
  const scan = async () => {
    if (!service || !token) return;
    setLoading(true);
    setPhase("scanning");
    log({ type: "info", message: "Scan en cours..." });

    try {
      if (service.key === "github") {
        const data = await githubFetch(token, "/user/repos?per_page=50&sort=updated");
        const list = data.map((r: { name: string; full_name: string; private: boolean }) => ({
          name: r.name,
          full_name: r.full_name,
          private: r.private,
        }));
        setRepos(list);
        log({ type: "success", message: `${list.length} dépôts trouvés`, detail: list.map((r: { name: string }) => r.name).join(", ") });
        setPhase("planning");
      } else if (service.key === "vercel") {
        const data = await vercelFetch(token, "/v9/projects?limit=20");
        const list = (data.projects ?? []).map((p: { name: string; id: string }) => ({
          name: p.name,
          full_name: p.id,
          private: false,
        }));
        setRepos(list);
        log({ type: "success", message: `${list.length} projets Vercel trouvés` });
        setPhase("planning");
      } else {
        log({ type: "info", message: "Analyse du token en cours avec Gemini..." });
        await analyzeWithGemini(null);
      }
    } catch (e: unknown) {
      log({ type: "error", message: "Erreur lors du scan", detail: String(e) });
    } finally {
      setLoading(false);
    }
  };

  // 3. Analyser avec Gemini et générer un plan
  const analyzeWithGemini = async (repoFullName: string | null) => {
    if (!geminiKey) {
      log({ type: "error", message: "Clé Gemini manquante. Ajoutez-la dans les paramètres." });
      return;
    }
    setLoading(true);
    setPhase("planning");
    log({ type: "info", message: "Gemini analyse le projet..." });

    try {
      let context = "";

      if (service?.key === "github" && repoFullName) {
        // Lire les fichiers clés du dépôt
        const files = await githubFetch(token, `/repos/${repoFullName}/contents`);
        const fileNames = files.map((f: { name: string }) => f.name).join(", ");
        log({ type: "info", message: `Fichiers détectés : ${fileNames}` });

        // Lire package.json / vercel.json / .env.example si présents
        const filesToRead = ["package.json", "vercel.json", ".env.example", "requirements.txt", "README.md"];
        const fileContents: Record<string, string> = {};
        for (const fname of filesToRead) {
          try {
            const f = await githubFetch(token, `/repos/${repoFullName}/contents/${fname}`);
            fileContents[fname] = atob(f.content.replace(/\n/g, ""));
          } catch {
            // fichier absent, on skip
          }
        }

        context = `
Dépôt GitHub analysé : ${repoFullName}
Fichiers racine : ${fileNames}

${Object.entries(fileContents).map(([name, content]) => `### ${name}\n\`\`\`\n${content.substring(0, 1500)}\n\`\`\``).join("\n\n")}
        `;
      } else if (service?.key === "vercel" && repoFullName) {
        const envData = await vercelFetch(token, `/v9/projects/${repoFullName}/env`);
        const envKeys = (envData.envs ?? []).map((e: { key: string }) => e.key).join(", ");
        context = `Projet Vercel : ${repoFullName}\nVariables d'environnement existantes : ${envKeys || "aucune"}`;
      } else {
        context = `Token de type ${service?.name}. Analyse les capacités et les configurations possibles.`;
      }

      const geminiPrompt = `Tu es un expert DevOps et architecte logiciel. Analyse ce projet et génère un plan de configuration précis.

${context}

Génère un plan structuré avec :
1. Ce que tu as détecté (stack, framework, dépendances)
2. Ce qui manque ou doit être configuré
3. Les actions concrètes à appliquer (fichiers à créer, env vars à ajouter, etc.)
4. Les commandes ou étapes à exécuter

Sois concis et actionnable. Réponds en français. Format markdown.`;

      const result = await callGemini(geminiKey, geminiPrompt);
      setPlan(result);
      log({ type: "plan", message: "Plan de configuration généré par Gemini" });
      setPhase("executing");
    } catch (e: unknown) {
      log({ type: "error", message: "Erreur Gemini", detail: String(e) });
    } finally {
      setLoading(false);
    }
  };

  // 4. Appliquer une action spécifique (écrire un fichier GitHub, etc.)
  const applyAction = async (action: string, params: Record<string, string>) => {
    setLoading(true);
    log({ type: "action", message: `Exécution : ${action}` });
    try {
      if (action === "github_push") {
        const { owner, repo, path, content } = params;
        let sha: string | undefined;
        try {
          const existing = await githubFetch(token, `/repos/${owner}/${repo}/contents/${path}`);
          sha = existing.sha;
        } catch { /* nouveau fichier */ }

        const body: Record<string, string> = {
          message: `Config auto via Studio AI`,
          content: btoa(unescape(encodeURIComponent(content))),
        };
        if (sha) body.sha = sha;
        await githubPut(token, `/repos/${owner}/${repo}/contents/${path}`, body);
        log({ type: "success", message: `Fichier poussé : ${path}` });
      } else if (action === "vercel_set_env") {
        const { projectId, key, value } = params;
        const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview", "development"] }),
        });
        if (!res.ok) throw new Error(await res.text());
        log({ type: "success", message: `Variable Vercel ajoutée : ${key}` });
      }
      setPhase("done");
    } catch (e: unknown) {
      log({ type: "error", message: `Échec de l'action ${action}`, detail: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setToken("");
    setService(null);
    setPhase("idle");
    clearLogs();
    setPlan("");
    setRepos([]);
    setSelectedRepo("");
  };

  return {
    token, setToken,
    geminiKey, saveGeminiKey,
    service, detect,
    loading, logs,
    repos, selectedRepo, setSelectedRepo,
    plan, phase,
    scan,
    analyzeWithGemini,
    applyAction,
    reset,
  };
}
