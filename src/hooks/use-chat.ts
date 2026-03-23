import { useState, useCallback, useMemo } from "react";
import { detectService, type DetectedService } from "./use-auto-config";

// ── Types ───────────────────────────────────────────────────────
export type WidgetType =
  | "token_input"
  | "env_input"
  | "file_input"
  | "repo_select"
  | "text_input"
  | "confirm"
  | "code_block"
  | "api_action";   // ← nouvelle: appel API générique confirmé

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
  action?: string;
  actionParams?: Record<string, string>;
  code?: string;
  language?: string;
  submitted?: boolean;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  widget?: Widget;
  timestamp: Date;
}

export interface AccessToken {
  id: string;
  name: string;
  value: string;
}

export interface ChatContext {
  token?: string;
  geminiKey?: string;
  service?: DetectedService;
  selectedRepo?: string;
  tokens?: AccessToken[];
}

// ── Détection de service par nom ou valeur du token ─────────────
function detectServiceFromToken(name: string, value: string): string {
  const n = name.toLowerCase();
  const v = value.toLowerCase();
  if (n.includes("github") || v.startsWith("ghp_") || v.startsWith("github_pat_")) return "github";
  if (n.includes("supabase")) return "supabase";
  if (n.includes("vercel")) return "vercel";
  if (n.includes("netlify")) return "netlify";
  if (n.includes("openai") || v.startsWith("sk-")) return "openai";
  if (n.includes("anthropic") || v.startsWith("sk-ant-")) return "anthropic";
  if (n.includes("gemini") || n.includes("google")) return "gemini";
  if (n.includes("stripe") || v.startsWith("sk_")) return "stripe";
  if (n.includes("notion")) return "notion";
  if (n.includes("slack")) return "slack";
  if (n.includes("discord")) return "discord";
  if (n.includes("twitter") || n.includes("x.com")) return "twitter";
  if (n.includes("firebase")) return "firebase";
  if (n.includes("mongodb") || n.includes("atlas")) return "mongodb";
  if (n.includes("planetscale")) return "planetscale";
  if (n.includes("railway")) return "railway";
  if (n.includes("render")) return "render";
  if (n.includes("aws")) return "aws";
  if (n.includes("cloudflare")) return "cloudflare";
  if (n.includes("linear")) return "linear";
  if (n.includes("jira") || n.includes("atlassian")) return "jira";
  return "api";
}

// ── Capacités par service ───────────────────────────────────────
const SERVICE_CAPABILITIES: Record<string, string> = {
  github: "créer/lire/modifier/supprimer des fichiers, créer des dépôts, gérer branches, issues, PRs, secrets, GitHub Actions, webhooks, déployer via Pages",
  supabase: "exécuter du SQL, gérer des tables, créer/supprimer des projets, gérer les utilisateurs auth, le stockage, les Edge Functions, les webhooks, les politiques RLS",
  vercel: "déployer des projets, gérer les variables d'environnement, les domaines, les déploiements, les équipes, les projets, les logs",
  netlify: "déployer des sites, gérer les variables d'environnement, les domaines, les builds, les fonctions, les formulaires",
  openai: "générer du texte, des images, des embeddings, fine-tuning, gérer les modèles et les fichiers",
  anthropic: "générer du texte avec Claude, gérer les messages",
  gemini: "générer du texte, des images avec Gemini",
  stripe: "créer des produits, des prix, des abonnements, des clients, des factures, consulter les paiements",
  notion: "créer/modifier des pages, des bases de données, des blocs, gérer les membres",
  slack: "envoyer des messages, créer des canaux, gérer les utilisateurs, les webhooks",
  discord: "envoyer des messages, gérer des serveurs, des canaux, des rôles",
  twitter: "publier des tweets, gérer le profil, les followers",
  firebase: "gérer Firestore, Auth, Storage, Functions, Hosting",
  mongodb: "requêtes CRUD sur les collections Atlas",
  railway: "déployer des services, gérer les variables, les volumes",
  cloudflare: "gérer DNS, Workers, Pages, R2",
  linear: "créer/modifier des issues, des projets, des équipes",
  aws: "gérer S3, Lambda, EC2, RDS, et autres services AWS",
  api: "faire des appels HTTP personnalisés avec ce token",
};

// ── Appel GitHub API ────────────────────────────────────────────
async function githubRequest(token: string, path: string, method = "GET", body?: object) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `GitHub ${res.status}`);
  }
  return res.status === 204 ? {} : res.json();
}

// ── Appel Supabase Management API ──────────────────────────────
async function supabaseRequest(token: string, path: string, method = "GET", body?: object) {
  const res = await fetch(`https://api.supabase.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Supabase ${res.status}`);
  }
  return res.json();
}

// ── Appel Vercel API ────────────────────────────────────────────
async function vercelRequest(token: string, path: string, method = "GET", body?: object) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Vercel ${res.status}`);
  }
  return res.json();
}

// ── Appel Netlify API ───────────────────────────────────────────
async function netlifyRequest(token: string, path: string, method = "GET", body?: object) {
  const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Netlify ${res.status}`);
  }
  return res.json();
}

// ── Exécution des actions ───────────────────────────────────────
async function executeWidgetAction(
  action: string,
  values: Record<string, string>,
  ctx: ChatContext
): Promise<string> {
  const tokens = ctx.tokens ?? [];

  // Trouver le bon token par service ou prendre le premier
  function getToken(preferredService: string): string {
    const found = tokens.find(t => detectServiceFromToken(t.name, t.value) === preferredService);
    return found?.value ?? ctx.token ?? tokens[0]?.value ?? "";
  }

  // ─── GitHub ────────────────────────────────────────────────
  if (action === "github_push_file") {
    const token = getToken("github");
    if (!token) throw new Error("Token GitHub introuvable. Ajoutez-le via le bouton +");
    const { repo, path, content, message } = values;
    if (!repo || !path || !content) throw new Error("repo, path et content sont requis");
    // Obtenir SHA si fichier existe
    let sha: string | undefined;
    try {
      const existing = await githubRequest(token, `/repos/${repo}/contents/${path}`);
      sha = (existing as { sha?: string }).sha;
    } catch { /* nouveau fichier */ }

    const body: Record<string, string> = {
      message: message ?? `Update ${path} via Solo AI`,
      content: btoa(unescape(encodeURIComponent(content))),
    };
    if (sha) body.sha = sha;
    await githubRequest(token, `/repos/${repo}/contents/${path}`, "PUT", body);
    return `✅ Fichier \`${path}\` mis à jour dans \`${repo}\``;
  }

  if (action === "github_read_file") {
    const token = getToken("github");
    if (!token) throw new Error("Token GitHub introuvable");
    const { repo, path } = values;
    const data = await githubRequest(token, `/repos/${repo}/contents/${path}`) as { content: string };
    return atob(data.content.replace(/\n/g, ""));
  }

  if (action === "github_create_repo") {
    const token = getToken("github");
    if (!token) throw new Error("Token GitHub introuvable");
    const { name, description, privateRepo } = values;
    const data = await githubRequest(token, "/user/repos", "POST", {
      name, description: description ?? "",
      private: privateRepo === "true",
      auto_init: true,
    }) as { full_name: string; html_url: string };
    return `✅ Dépôt \`${data.full_name}\` créé : ${data.html_url}`;
  }

  if (action === "github_list_repos") {
    const token = getToken("github");
    if (!token) throw new Error("Token GitHub introuvable");
    const repos = await githubRequest(token, "/user/repos?per_page=20&sort=updated") as { full_name: string }[];
    return `Vos dépôts :\n${repos.map(r => `• ${r.full_name}`).join("\n")}`;
  }

  if (action === "github_create_issue") {
    const token = getToken("github");
    if (!token) throw new Error("Token GitHub introuvable");
    const { repo, title, body } = values;
    const data = await githubRequest(token, `/repos/${repo}/issues`, "POST", { title, body: body ?? "" }) as { number: number; html_url: string };
    return `✅ Issue #${data.number} créée : ${data.html_url}`;
  }

  if (action === "github_create_branch") {
    const token = getToken("github");
    if (!token) throw new Error("Token GitHub introuvable");
    const { repo, branch, from } = values;
    const ref = await githubRequest(token, `/repos/${repo}/git/refs/heads/${from ?? "main"}`) as { object: { sha: string } };
    await githubRequest(token, `/repos/${repo}/git/refs`, "POST", {
      ref: `refs/heads/${branch}`,
      sha: ref.object.sha,
    });
    return `✅ Branche \`${branch}\` créée depuis \`${from ?? "main"}\` dans \`${repo}\``;
  }

  if (action === "github_set_secret") {
    const token = getToken("github");
    if (!token) throw new Error("Token GitHub introuvable");
    const { repo, secretName } = values;
    // Note: GitHub Secrets nécessite libsodium pour le chiffrement
    // On informe l'utilisateur
    return `ℹ️ Pour créer le secret \`${secretName}\` dans \`${repo}\`, allez sur GitHub → Settings → Secrets and variables → Actions → New repository secret`;
  }

  // ─── Supabase ──────────────────────────────────────────────
  if (action === "supabase_list_projects") {
    const token = getToken("supabase");
    if (!token) throw new Error("Token Supabase introuvable");
    const projects = await supabaseRequest(token, "/v1/projects") as { name: string; id: string; region: string }[];
    return `Vos projets Supabase :\n${projects.map(p => `• ${p.name} (${p.id}) — ${p.region}`).join("\n")}`;
  }

  if (action === "supabase_run_sql") {
    const token = getToken("supabase");
    if (!token) throw new Error("Token Supabase introuvable");
    const { projectRef, query } = values;
    if (!projectRef || !query) throw new Error("projectRef et query sont requis");
    const result = await supabaseRequest(token, `/v1/projects/${projectRef}/database/query`, "POST", { query });
    return `✅ Requête exécutée :\n${JSON.stringify(result, null, 2)}`;
  }

  if (action === "supabase_create_table") {
    const token = getToken("supabase");
    if (!token) throw new Error("Token Supabase introuvable");
    const { projectRef, tableName, columns } = values;
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns ?? "id uuid primary key default gen_random_uuid(), created_at timestamp with time zone default now()"});`;
    await supabaseRequest(token, `/v1/projects/${projectRef}/database/query`, "POST", { query: sql });
    return `✅ Table \`${tableName}\` créée dans le projet \`${projectRef}\``;
  }

  if (action === "supabase_create_project") {
    const token = getToken("supabase");
    if (!token) throw new Error("Token Supabase introuvable");
    const { name, organizationId, dbPassword, region } = values;
    const data = await supabaseRequest(token, "/v1/projects", "POST", {
      name, organization_id: organizationId,
      db_pass: dbPassword, region: region ?? "us-east-1",
    }) as { id: string; name: string };
    return `✅ Projet Supabase \`${data.name}\` créé (ID: ${data.id})`;
  }

  // ─── Vercel ────────────────────────────────────────────────
  if (action === "vercel_list_projects") {
    const token = getToken("vercel");
    if (!token) throw new Error("Token Vercel introuvable");
    const data = await vercelRequest(token, "/v9/projects") as { projects: { name: string; id: string }[] };
    return `Vos projets Vercel :\n${data.projects.map(p => `• ${p.name} (${p.id})`).join("\n")}`;
  }

  if (action === "vercel_create_env") {
    const token = getToken("vercel");
    if (!token) throw new Error("Token Vercel introuvable");
    const { projectId, key, value, target } = values;
    await vercelRequest(token, `/v10/projects/${projectId}/env`, "POST", {
      key, value,
      type: "encrypted",
      target: (target ?? "production,preview,development").split(","),
    });
    return `✅ Variable \`${key}\` créée dans le projet Vercel \`${projectId}\``;
  }

  if (action === "vercel_list_deployments") {
    const token = getToken("vercel");
    if (!token) throw new Error("Token Vercel introuvable");
    const { projectId } = values;
    const data = await vercelRequest(token, `/v6/deployments?projectId=${projectId}&limit=5`) as { deployments: { url: string; state: string; createdAt: number }[] };
    return `Derniers déploiements :\n${data.deployments.map(d => `• ${d.url} — ${d.state}`).join("\n")}`;
  }

  if (action === "vercel_delete_env") {
    const token = getToken("vercel");
    if (!token) throw new Error("Token Vercel introuvable");
    const { projectId, envId } = values;
    await vercelRequest(token, `/v10/projects/${projectId}/env/${envId}`, "DELETE");
    return `✅ Variable d'environnement supprimée`;
  }

  // ─── Netlify ───────────────────────────────────────────────
  if (action === "netlify_list_sites") {
    const token = getToken("netlify");
    if (!token) throw new Error("Token Netlify introuvable");
    const sites = await netlifyRequest(token, "/sites") as { name: string; id: string; url: string }[];
    return `Vos sites Netlify :\n${sites.map(s => `• ${s.name} — ${s.url}`).join("\n")}`;
  }

  if (action === "netlify_create_env") {
    const token = getToken("netlify");
    if (!token) throw new Error("Token Netlify introuvable");
    const { siteId, key, value } = values;
    await netlifyRequest(token, `/sites/${siteId}/env`, "POST", { [key]: value });
    return `✅ Variable \`${key}\` créée sur Netlify (site: ${siteId})`;
  }

  if (action === "netlify_get_env") {
    const token = getToken("netlify");
    if (!token) throw new Error("Token Netlify introuvable");
    const { siteId } = values;
    const envVars = await netlifyRequest(token, `/sites/${siteId}/env`);
    const keys = Object.keys(envVars as object);
    return `Variables d'environnement du site :\n${keys.map(k => `• ${k}`).join("\n")}`;
  }

  // ─── Appel HTTP générique ──────────────────────────────────
  if (action === "http_request") {
    const { url, method, headers: rawHeaders, body: rawBody, tokenName } = values;
    if (!url) throw new Error("URL requise");

    // Trouver le token à utiliser
    const tokenToUse = tokenName
      ? tokens.find(t => t.name.toLowerCase() === tokenName.toLowerCase())?.value ?? ctx.token ?? ""
      : ctx.token ?? tokens[0]?.value ?? "";

    const parsedHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (rawHeaders) {
      try {
        const h = JSON.parse(rawHeaders);
        Object.assign(parsedHeaders, h);
      } catch { /* ignore */ }
    }
    // Substituer le token dans les headers
    for (const k of Object.keys(parsedHeaders)) {
      parsedHeaders[k] = parsedHeaders[k].replace("{{TOKEN}}", tokenToUse);
    }

    const res = await fetch(url, {
      method: method ?? "GET",
      headers: parsedHeaders,
      body: rawBody ? rawBody.replace("{{TOKEN}}", tokenToUse) : undefined,
    });
    const text = await res.text();
    let pretty = text;
    try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }
    return `Réponse ${res.status}:\n${pretty.slice(0, 1000)}${pretty.length > 1000 ? "\n…(tronqué)" : ""}`;
  }

  // ─── Anciennes actions (rétrocompatibilité) ────────────────
  if (action === "push_file") {
    return executeWidgetAction("github_push_file", values, ctx);
  }

  if (action === "save_token") {
    return "Token enregistré pour cette session.";
  }

  if (action === "create_env_var") {
    // Auto-détecte le service
    if (values.service === "vercel") return executeWidgetAction("vercel_create_env", values, ctx);
    if (values.service === "netlify") return executeWidgetAction("netlify_create_env", values, ctx);
    return executeWidgetAction("github_push_file", {
      repo: values.repo ?? ctx.selectedRepo ?? "",
      path: ".env.example",
      content: `${values.varKey}=\n`,
      message: `Add ${values.varKey} to .env.example`,
    }, ctx);
  }

  return `Action "${action}" exécutée.`;
}

// ── Appel IA via Groq (proxy serveur) ──────────────────────────
async function callGroq(
  systemPrompt: string,
  history: { role: "user" | "model"; text: string }[],
  userMessage: string
): Promise<{ text: string; widget?: Widget }> {

  const jsonInstructions = `
INSTRUCTIONS CRITIQUES :
1. Réponds UNIQUEMENT avec du JSON valide (zéro markdown, zéro \`\`\`json)
2. Format requis :
{
  "text": "ta réponse en français ici",
  "widget": null
}
OU avec widget :
{
  "text": "explication de ce que tu vas faire",
  "widget": {
    "type": "api_action",
    "label": "Description de l'action",
    "action": "github_push_file",
    "fields": [
      { "key": "repo", "label": "Dépôt (owner/repo)", "type": "text", "placeholder": "user/mon-projet" },
      { "key": "path", "label": "Chemin du fichier", "type": "text", "placeholder": "src/App.tsx" },
      { "key": "content", "label": "Contenu", "type": "textarea", "placeholder": "..." },
      { "key": "message", "label": "Message de commit", "type": "text", "placeholder": "feat: ..." }
    ],
    "actionParams": {
      "repo": "user/mon-projet",
      "path": "src/components/Button.tsx",
      "content": "import React from 'react';\n\nexport function Button() { return <button>Click</button>; }",
      "message": "feat: add Button component"
    }
  }
}`;

  const messages = [
    { role: "system", content: systemPrompt + "\n" + jsonInstructions },
    ...history.map(h => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.text,
    })),
    { role: "user", content: userMessage },
  ];

  const res = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, temperature: 0.3, max_tokens: 4000 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Erreur IA ${res.status}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '{"text":"Erreur de réponse."}';

  const clean = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(clean);
    return parsed;
  } catch {
    return { text: clean.replace(/[{}"\\]/g, "").trim() || raw };
  }
}

// ── Hook principal ──────────────────────────────────────────────
export function useChat(ctx: ChatContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const addMessage = useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
    const full: ChatMessage = {
      ...msg,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, full]);
    return full;
  }, []);

  const updateLastAssistantWidget = useCallback((widget: Widget) => {
    setMessages(prev => {
      const idx = [...prev].reverse().findIndex(m => m.role === "assistant");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      const updated = [...prev];
      updated[realIdx] = { ...updated[realIdx], widget };
      return updated;
    });
  }, []);

  // ── Prompt système enrichi ───────────────────────────────────
  const systemPrompt = useMemo(() => {
    const tokens = ctx.tokens ?? [];
    const tokenList = tokens.length > 0
      ? tokens.map(t => {
          const svc = detectServiceFromToken(t.name, t.value);
          const caps = SERVICE_CAPABILITIES[svc] ?? "appels API génériques";
          return `• ${t.name} (${svc}) → peut : ${caps}`;
        }).join("\n")
      : "Aucun token configuré (l'utilisateur peut en ajouter via le bouton +)";

    const hasGithub = tokens.some(t => detectServiceFromToken(t.name, t.value) === "github");
    const hasSupabase = tokens.some(t => detectServiceFromToken(t.name, t.value) === "supabase");
    const hasVercel = tokens.some(t => detectServiceFromToken(t.name, t.value) === "vercel");
    const hasNetlify = tokens.some(t => detectServiceFromToken(t.name, t.value) === "netlify");

    return `Tu es un assistant IA universel ultra-puissant capable d'interagir directement avec n'importe quelle API et service.

TOKENS D'ACCÈS DISPONIBLES :
${tokenList}

TU PEUX EFFECTUER DES ACTIONS RÉELLES sur ces services. Ne te contente pas de donner des instructions — FAIS-LE VRAIMENT en générant les bons widgets d'action.

ACTIONS DISPONIBLES PAR SERVICE :

${hasGithub ? `GITHUB (actions disponibles) :
- github_push_file : créer ou modifier un fichier dans un repo (fields: repo, path, content, message)
- github_read_file : lire le contenu d'un fichier (fields: repo, path)
- github_create_repo : créer un nouveau dépôt (fields: name, description, privateRepo)
- github_list_repos : lister les dépôts de l'utilisateur (aucun field requis)
- github_create_issue : créer une issue (fields: repo, title, body)
- github_create_branch : créer une branche (fields: repo, branch, from)
` : ""}
${hasSupabase ? `SUPABASE (actions disponibles) :
- supabase_list_projects : lister les projets (aucun field requis)
- supabase_run_sql : exécuter du SQL (fields: projectRef, query)
- supabase_create_table : créer une table (fields: projectRef, tableName, columns)
- supabase_create_project : créer un projet (fields: name, organizationId, dbPassword, region)
` : ""}
${hasVercel ? `VERCEL (actions disponibles) :
- vercel_list_projects : lister les projets (aucun field requis)
- vercel_create_env : créer une variable d'env (fields: projectId, key, value, target)
- vercel_list_deployments : lister les déploiements (fields: projectId)
- vercel_delete_env : supprimer une variable (fields: projectId, envId)
` : ""}
${hasNetlify ? `NETLIFY (actions disponibles) :
- netlify_list_sites : lister les sites (aucun field requis)
- netlify_create_env : créer une variable d'env (fields: siteId, key, value)
- netlify_get_env : voir les variables d'env (fields: siteId)
` : ""}
TOUJOURS DISPONIBLE :
- http_request : appel HTTP générique vers n'importe quelle API (fields: url, method, headers, body, tokenName)

RÈGLES CRITIQUES — EXÉCUTION AUTOMATIQUE :
⚡ IMPORTANT : Le système exécute automatiquement l'action si TOUS les champs de "actionParams" sont remplis.
⚡ Tu DOIS toujours remplir TOUS les champs dans "actionParams" avec les vraies valeurs — JAMAIS laisser un champ vide si tu peux le déduire.
⚡ Si l'utilisateur mentionne un repo (ex: "avenircc120-debug/jeremy"), tu DOIS le mettre dans actionParams.repo.
⚡ Si tu génères du code, tu DOIS le mettre entier dans actionParams.content.
⚡ Si l'utilisateur dit "modifie le nom de l'app", tu lis d'abord le fichier existant puis génères le contenu COMPLET modifié.

RÈGLES DE GÉNÉRATION DE WIDGETS :
1. Quand l'utilisateur demande de faire quelque chose → génère IMMÉDIATEMENT le widget "api_action" avec l'action correcte
2. Remplis TOUS les champs dans "actionParams" — repo, path, content, message — avec les vraies valeurs
3. Ne laisse JAMAIS un champ vide si tu connais la valeur ou peux la déduire du contexte
4. Si tu ne connais pas un champ → pose UNE question précise avant de générer le widget
5. Pour les modifications de fichiers : génère le contenu COMPLET du fichier dans actionParams.content
6. Pour les actions sans token disponible → explique comment ajouter le token via le panneau jetons
7. Réponds TOUJOURS en français
8. GÉNÈRE DU VRAI CODE, pas des placeholders`;
  }, [ctx.tokens, ctx.service, ctx.selectedRepo]);

  // ── Envoi de message ────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    addMessage({ role: "user", text });
    setLoading(true);

    try {
      // Historique pour le contexte
      const history = messages.slice(-10).map(m => ({
        role: m.role === "user" ? "user" as const : "model" as const,
        text: m.text,
      }));

      const response = await callGroq(systemPrompt, history, text);

      // ── Auto-exécution si tous les champs actionParams sont remplis ──
      const w = response.widget;
      if (w && w.action && w.actionParams) {
        const fields = w.fields ?? [];
        const params = w.actionParams;
        const allFilled = fields.length === 0 || fields.every(f => params[f.key] && String(params[f.key]).trim() !== "");

        if (allFilled) {
          // Afficher le message "en cours"
          addMessage({ role: "assistant", text: response.text, widget: { ...w, submitted: false } });
          try {
            const result = await executeWidgetAction(w.action, params, ctx);
            // Marquer le widget comme complété avec le résultat
            setMessages(prev => {
              const idx = [...prev].reverse().findIndex(m => m.role === "assistant" && m.widget);
              if (idx === -1) return prev;
              const realIdx = prev.length - 1 - idx;
              const updated = [...prev];
              updated[realIdx] = { ...updated[realIdx], widget: { ...w, submitted: true, result } };
              return updated;
            });
            addMessage({ role: "assistant", text: result });
          } catch (e) {
            addMessage({ role: "assistant", text: `❌ Erreur lors de l'exécution : ${String(e)}` });
          }
          return;
        }
      }

      addMessage({
        role: "assistant",
        text: response.text,
        widget: response.widget ?? undefined,
      });
    } catch (e) {
      addMessage({ role: "assistant", text: `❌ Erreur : ${String(e)}` });
    } finally {
      setLoading(false);
    }
  }, [loading, ctx, systemPrompt, messages, addMessage]);

  // ── Soumission widget ───────────────────────────────────────
  const submitWidget = useCallback(async (msgId: string, values: Record<string, string>, action: string) => {
    setLoading(true);
    try {
      const result = await executeWidgetAction(action, values, ctx);
      setMessages(prev => prev.map(m =>
        m.id === msgId && m.widget
          ? { ...m, widget: { ...m.widget, submitted: true, result } }
          : m
      ));
      addMessage({ role: "assistant", text: result });
    } catch (e) {
      addMessage({ role: "assistant", text: `❌ Erreur : ${String(e)}` });
    } finally {
      setLoading(false);
    }
  }, [ctx, addMessage]);

  return { messages, input, setInput, loading, sendMessage, submitWidget, updateLastAssistantWidget };
}
