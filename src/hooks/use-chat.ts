import { useState, useCallback } from "react";
import { detectService, type DetectedService } from "./use-auto-config";

// ── Types de widgets générés dynamiquement dans le chat ─────────
export type WidgetType =
  | "token_input"     // champ mot de passe pour un token
  | "env_input"       // clé + valeur pour variable d'environnement
  | "file_input"      // chemin + contenu pour créer/éditer un fichier
  | "repo_select"     // sélection d'un dépôt GitHub
  | "text_input"      // champ texte simple
  | "confirm"         // bouton de confirmation
  | "code_block";     // bloc de code readonly (résultat)

export interface WidgetField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "password" | "textarea" | "select";
  options?: string[];
  required?: boolean;
}

export interface Widget {
  type: WidgetType;
  label?: string;
  fields?: WidgetField[];
  action?: string;          // action à exécuter au submit
  actionParams?: Record<string, string>; // paramètres pré-remplis
  code?: string;            // pour code_block
  language?: string;        // pour code_block
  submitted?: boolean;      // true une fois soumis
  result?: string;          // résultat après soumission
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  widget?: Widget;
  timestamp: Date;
}

// ── Contexte partagé avec le configurateur ────────────────────
export interface ChatContext {
  token?: string;
  geminiKey?: string;
  service?: DetectedService;
  selectedRepo?: string;
}

// ── Appel Gemini pour analyser le message et décider du widget ─
async function callGemini(geminiKey: string, systemPrompt: string, userMessage: string): Promise<{ text: string; widget?: Widget }> {
  const prompt = `${systemPrompt}

Message de l'utilisateur : "${userMessage}"

Réponds UNIQUEMENT avec du JSON valide (pas de markdown, pas de \`\`\`json), format exact :
{
  "text": "ta réponse en texte ici",
  "widget": null
}
ou si un widget est nécessaire :
{
  "text": "ta réponse ici",
  "widget": {
    "type": "env_input",
    "label": "Créer une variable d'environnement",
    "fields": [
      { "key": "varKey", "label": "Nom de la variable", "placeholder": "ex: GEMINI_API_KEY", "type": "text", "required": true },
      { "key": "varValue", "label": "Valeur", "placeholder": "Collez votre token ici", "type": "password", "required": true }
    ],
    "action": "create_env_var"
  }
}

Types de widgets disponibles :
- "token_input" : 1 champ password pour capturer un token (action: "save_token")
- "env_input" : 2 champs (nom + valeur) pour variable d'env (action: "create_env_var")  
- "file_input" : champ texte (chemin) + textarea (contenu) pour fichier (action: "push_file")
- "repo_select" : sélection de dépôt (action: "select_repo")
- "text_input" : champ texte générique
- "confirm" : bouton de confirmation (action selon contexte)
- null : aucun widget, réponse textuelle seule

Règles :
- Si l'utilisateur demande de créer/ajouter une variable d'environnement → widget "env_input"
- Si l'utilisateur demande de saisir/entrer un token → widget "token_input"
- Si l'utilisateur demande de créer/modifier un fichier → widget "file_input"
- Si l'utilisateur demande de choisir un dépôt → widget "repo_select"
- Pour toute autre demande → widget null, réponse textuelle
- Réponds toujours en français`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '{"text":"Erreur de réponse."}';

  try {
    return JSON.parse(raw);
  } catch {
    // Si le JSON est mal formé, on extrait juste le texte
    return { text: raw.replace(/[{}"]/g, "").trim() };
  }
}

// ── Actions exécutées lors de la soumission d'un widget ────────
async function executeWidgetAction(
  action: string,
  values: Record<string, string>,
  ctx: ChatContext
): Promise<string> {
  const token = ctx.token ?? "";

  switch (action) {
    case "save_token": {
      const detected = detectService(values.token ?? "");
      if (detected.key === "unknown") return `Service non reconnu pour ce token.`;
      return `Token ${detected.name} enregistré pour cette session.`;
    }

    case "create_env_var": {
      if (!token) return "Aucun token de service configuré. Collez votre token d'accès d'abord.";
      const { varKey, varValue } = values;
      if (!varKey || !varValue) return "Clé ou valeur manquante.";

      if (ctx.service?.key === "vercel") {
        const projectId = ctx.selectedRepo;
        if (!projectId) return "Sélectionnez d'abord un projet Vercel.";
        const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ key: varKey, value: varValue, type: "encrypted", target: ["production", "preview", "development"] }),
        });
        if (!res.ok) throw new Error(await res.text());
        return `Variable \`${varKey}\` créée avec succès sur Vercel (projet: ${projectId}).`;
      }

      if (ctx.service?.key === "github") {
        // Pour GitHub, on crée/update un fichier .env.example
        const repo = ctx.selectedRepo;
        if (!repo) return "Sélectionnez d'abord un dépôt GitHub.";
        const [owner, repoName] = repo.split("/");
        // Lire .env.example existant
        let existingContent = "";
        let sha: string | undefined;
        try {
          const f = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/.env.example`, {
            headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
          });
          if (f.ok) {
            const fd = await f.json();
            existingContent = atob(fd.content.replace(/\n/g, "")) + "\n";
            sha = fd.sha;
          }
        } catch { /* nouveau fichier */ }

        const newContent = existingContent + `${varKey}=\n`;
        const body: Record<string, string> = {
          message: `Add ${varKey} to .env.example via Studio AI`,
          content: btoa(unescape(encodeURIComponent(newContent))),
        };
        if (sha) body.sha = sha;

        const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/.env.example`, {
          method: "PUT",
          headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        return `Variable \`${varKey}\` ajoutée dans \`.env.example\` du dépôt ${repo}.`;
      }

      return `Variable \`${varKey}\` enregistrée localement pour cette session.`;
    }

    case "push_file": {
      if (!token || ctx.service?.key !== "github") return "Token GitHub requis.";
      const repo = ctx.selectedRepo;
      if (!repo) return "Sélectionnez d'abord un dépôt GitHub.";
      const [owner, repoName] = repo.split("/");
      const { filePath, fileContent } = values;
      let sha: string | undefined;
      try {
        const f = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`, {
          headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
        });
        if (f.ok) sha = (await f.json()).sha;
      } catch { /* nouveau fichier */ }

      const body: Record<string, string> = {
        message: `Update ${filePath} via Studio AI`,
        content: btoa(unescape(encodeURIComponent(fileContent))),
      };
      if (sha) body.sha = sha;

      const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`, {
        method: "PUT",
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return `Fichier \`${filePath}\` poussé avec succès sur GitHub (${repo}).`;
    }

    default:
      return `Action "${action}" reçue.`;
  }
}

// ── Hook principal ─────────────────────────────────────────────
export function useChat(ctx: ChatContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: ctx.service
        ? `Je suis connecté à votre compte **${ctx.service.name}**. Que voulez-vous configurer ? Dites-moi par exemple : *"crée une variable d'environnement"*, *"lis le fichier package.json"*, *"pousse un fichier de config"*…`
        : `Bienvenue ! Collez votre token d'accès (GitHub, Vercel, Supabase…) pour commencer. Ensuite, dites-moi ce que vous voulez configurer.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const addMessage = (msg: Omit<ChatMessage, "id" | "timestamp">) => {
    const newMsg: ChatMessage = { ...msg, id: crypto.randomUUID(), timestamp: new Date() };
    setMessages(prev => [...prev, newMsg]);
    return newMsg;
  };

  const updateLastAssistantWidget = (widgetUpdate: Partial<Widget>) => {
    setMessages(prev => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant" && copy[i].widget) {
          copy[i] = { ...copy[i], widget: { ...copy[i].widget!, ...widgetUpdate } };
          break;
        }
      }
      return copy;
    });
  };

  const systemPrompt = `Tu es un assistant IA de configuration de projets logiciels. 
Service connecté : ${ctx.service?.name ?? "aucun"}.
Dépôt/Projet sélectionné : ${ctx.selectedRepo ?? "aucun"}.
Token disponible : ${ctx.token ? "oui" : "non"}.
Ton rôle : comprendre les demandes de configuration et générer les bons widgets interactifs ou répondre textuellement.`;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    addMessage({ role: "user", text });
    setLoading(true);

    try {
      if (!ctx.geminiKey) {
        addMessage({
          role: "assistant",
          text: "Clé Gemini non configurée. Cliquez sur l'icône ⚙️ en haut pour l'ajouter.",
        });
        return;
      }

      const response = await callGemini(ctx.geminiKey, systemPrompt, text);
      addMessage({ role: "assistant", text: response.text, widget: response.widget ?? undefined });
    } catch (e) {
      addMessage({ role: "assistant", text: `Erreur : ${String(e)}` });
    } finally {
      setLoading(false);
    }
  }, [loading, ctx, systemPrompt]);

  const submitWidget = useCallback(async (msgId: string, values: Record<string, string>, action: string) => {
    setLoading(true);
    try {
      const result = await executeWidgetAction(action, values, ctx);
      // Marquer le widget comme soumis avec le résultat
      setMessages(prev => prev.map(m =>
        m.id === msgId && m.widget
          ? { ...m, widget: { ...m.widget, submitted: true, result } }
          : m
      ));
      addMessage({ role: "assistant", text: `✓ ${result}` });
    } catch (e) {
      addMessage({ role: "assistant", text: `Erreur : ${String(e)}` });
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  return { messages, input, setInput, loading, sendMessage, submitWidget, updateLastAssistantWidget };
}
