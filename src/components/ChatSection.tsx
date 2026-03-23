import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, X, Globe, Plus, Mic, AlignLeft, BrainCircuit,
  Eye, EyeOff, CheckCircle2, Key, Trash2, MessageSquare, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useChat, type ChatMessage, type Widget, type WidgetField } from "@/hooks/use-chat";
import type { ChatContext } from "@/hooks/use-chat";

/* ─── Types locaux ─────────────────────────────────────────────── */
interface AccessToken { id: string; name: string; value: string }
interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number }

/* ─── Baleine SVG ──────────────────────────────────────────────── */
function WhaleIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="38" cy="42" rx="26" ry="20" fill="#4D7EFF" opacity="0.15" />
      <path d="M14 44c0-13.255 10.745-24 24-24s24 10.745 24 24c0 5-1.5 9.6-4 13.3l4 6.7H18l4-6.7A23.9 23.9 0 0 1 14 44Z" fill="#4D7EFF" />
      <circle cx="52" cy="36" r="3" fill="white" opacity="0.9" />
      <path d="M56 38c2-1 5-3 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M18 58c-3 2-7 3-9 1" stroke="#4D7EFF" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M62 58c3 2 7 3 9 1" stroke="#4D7EFF" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="40" cy="52" rx="10" ry="5" fill="white" opacity="0.12" />
    </svg>
  );
}

/* ─── Markdown léger ───────────────────────────────────────────── */
function MdText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return <code key={i} className="px-1.5 py-0.5 rounded bg-blue-50 font-mono text-xs text-blue-600 border border-blue-100">{p.slice(1, -1)}</code>;
        if (p.startsWith("*") && p.endsWith("*"))
          return <em key={i} className="italic text-gray-500">{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

/* ─── Widget field ─────────────────────────────────────────────── */
function WidgetFieldInput({ field, value, onChange }: { field: WidgetField; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const isPassword = field.type === "password";
  const isTextarea = field.type === "textarea";
  const isSelect = field.type === "select";

  if (isTextarea) return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{field.label}</label>
      <Textarea placeholder={field.placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 font-mono text-xs min-h-[80px] resize-y rounded-xl" />
    </div>
  );
  if (isSelect && field.options) return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{field.label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-blue-400">
        <option value="">-- Sélectionner --</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{field.label}</label>
      <div className="relative">
        <Input type={isPassword && !show ? "password" : "text"} placeholder={field.placeholder}
          value={value} onChange={e => onChange(e.target.value)}
          className="bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 rounded-xl pr-9" />
        {isPassword && (
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Widget interactif ─────────────────────────────────────────── */
function InlineWidget({ widget, msgId, onSubmit, disabled }: { widget: Widget; msgId: string; onSubmit: (msgId: string, values: Record<string, string>, action: string) => void; disabled: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({});
  if (widget.submitted) return (
    <div className="mt-3 flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 border border-green-100">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /><span>{widget.result ?? "Action effectuée"}</span>
    </div>
  );
  if (widget.type === "code_block") return (
    <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      <div className="flex items-center px-3 py-1.5 bg-gray-100 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-mono">{widget.language ?? "code"}</span>
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto">{widget.code}</pre>
    </div>
  );
  const fields = widget.fields ?? [];
  return (
    <div className="mt-3 space-y-3 bg-gray-50 rounded-2xl p-4 border border-gray-200">
      {widget.label && <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{widget.label}</p>}
      {fields.map(f => (
        <WidgetFieldInput key={f.key} field={f} value={values[f.key] ?? ""} onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))} />
      ))}
      <Button size="sm" onClick={() => onSubmit(msgId, values, widget.action ?? "")} disabled={disabled}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl">Valider</Button>
    </div>
  );
}

/* ─── Bulle message ─────────────────────────────────────────────── */
function MessageBubble({ msg, onWidgetSubmit, loading }: { msg: ChatMessage; onWidgetSubmit: (msgId: string, values: Record<string, string>, action: string) => void; loading: boolean }) {
  const isUser = msg.role === "user";
  if (isUser) return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end mb-4">
      <div className="max-w-[75%] bg-blue-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">{msg.text}</div>
    </motion.div>
  );
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start mb-4">
      <div className="max-w-[85%]">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <WhaleIcon size={18} />
          </div>
          <div className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-gray-800 leading-relaxed shadow-sm">
            <MdText text={msg.text} />
            {msg.widget && <InlineWidget widget={msg.widget} msgId={msg.id} onSubmit={onWidgetSubmit} disabled={loading} />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Indicateur frappe ─────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
          <WhaleIcon size={18} />
        </div>
        <div className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
          <div className="flex gap-1 items-center h-4">
            {[0, 1, 2].map(i => (
              <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400"
                animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Panneau historique (gauche) ───────────────────────────────── */
function HistoryPanel({ conversations, onSelect, onDelete, onClose, activeId }: {
  conversations: Conversation[]; onSelect: (c: Conversation) => void;
  onDelete: (id: string) => void; onClose: () => void; activeId: string;
}) {
  return (
    <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="absolute inset-y-0 left-0 w-72 bg-white border-r border-gray-100 z-20 flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Historique</span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
            <MessageSquare className="w-8 h-8 opacity-40" />
            <p className="text-xs text-center">Aucune discussion<br />pour le moment</p>
          </div>
        )}
        {conversations.map(c => (
          <div key={c.id} onClick={() => { onSelect(c); onClose(); }}
            className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              c.id === activeId ? "bg-blue-50 border border-blue-100" : "hover:bg-gray-50 border border-transparent"}`}>
            <MessageSquare className={`w-4 h-4 shrink-0 ${c.id === activeId ? "text-blue-500" : "text-gray-400"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${c.id === activeId ? "text-blue-700" : "text-gray-700"}`}>{c.title}</p>
              <p className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); onDelete(c.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 transition-all">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Panneau jetons (bas) ──────────────────────────────────────── */
function TokensPanel({ tokens, onAdd, onDelete, onClose }: {
  tokens: AccessToken[]; onAdd: (name: string, value: string) => void;
  onDelete: (id: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);

  const handleAdd = () => {
    const n = name.trim(); const v = value.trim();
    if (!n || !v) return;
    onAdd(n, v); setName(""); setValue("");
  };

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl z-20 shadow-2xl border-t border-gray-100 max-h-[75%] flex flex-col">
      {/* Poignée */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-gray-200" />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-800">Jetons d'accès</span>
          {tokens.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{tokens.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Formulaire ajout */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-3">
          <p className="text-xs font-semibold text-blue-700">Ajouter un jeton</p>
          <div className="space-y-2">
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Nom (ex: GitHub, Gemini, OpenAI…)"
              className="bg-white border-blue-200 text-gray-800 placeholder:text-gray-400 rounded-xl text-sm" />
            <div className="relative">
              <Input type={showValue ? "text" : "password"} value={value} onChange={e => setValue(e.target.value)}
                placeholder="Valeur du jeton…"
                className="bg-white border-blue-200 text-gray-800 placeholder:text-gray-400 rounded-xl text-sm pr-10" />
              <button type="button" onClick={() => setShowValue(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button onClick={handleAdd} disabled={!name.trim() || !value.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Ajouter
          </Button>
        </div>

        {/* Liste des jetons */}
        {tokens.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Jetons enregistrés</p>
            {tokens.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Key className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{t.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono truncate">{"•".repeat(Math.min(t.value.length, 20))}</p>
                </div>
                <button onClick={() => onDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors group">
                  <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transition-colors" />
                </button>
              </div>
            ))}
          </div>
        )}

        {tokens.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-400">
            <Key className="w-8 h-8 opacity-30" />
            <p className="text-xs text-center">Aucun jeton ajouté.<br />Le chat utilisera les clés par défaut.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── localStorage helpers ──────────────────────────────────────── */
const LS_TOKENS = "solo_access_tokens";
const LS_CONVS = "solo_conversations";
function loadTokens(): AccessToken[] { try { return JSON.parse(localStorage.getItem(LS_TOKENS) ?? "[]"); } catch { return []; } }
function saveTokens(t: AccessToken[]) { localStorage.setItem(LS_TOKENS, JSON.stringify(t)); }
function loadConversations(): Conversation[] { try { return JSON.parse(localStorage.getItem(LS_CONVS) ?? "[]"); } catch { return []; } }
function saveConversations(c: Conversation[]) { localStorage.setItem(LS_CONVS, JSON.stringify(c)); }
function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

/* ─── ChatSection principal ─────────────────────────────────────── */
export function ChatSection({ ctx }: { ctx: ChatContext }) {
  /* Jetons */
  const [tokens, setTokens] = useState<AccessToken[]>(() => loadTokens());
  /* Conversations */
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConvId, setActiveConvId] = useState<string>(() => genId());
  /* UI panels */
  const [showHistory, setShowHistory] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  /* Mode */
  const [mode, setMode] = useState<"none" | "reflection" | "search">("none");
  /* Input */
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Enrichir le contexte avec les jetons */
  // Clé Gemini : env Vercel → ctx → token "Gemini/Google" dans le panneau +
  const ENV_GEMINI_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || undefined;
  const autoGeminiKey = ctx.geminiKey
    ?? ENV_GEMINI_KEY
    ?? tokens.find(t =>
        t.name.toLowerCase().includes("gemini") ||
        t.name.toLowerCase().includes("google")
      )?.value;

  const enrichedCtx: ChatContext = {
    ...ctx,
    ...(tokens.length > 0 ? { token: tokens[0].value } : {}),
    ...(autoGeminiKey ? { geminiKey: autoGeminiKey } : {}),
    tokens: tokens,
  };

  const { messages, loading, sendMessage, submitWidget } = useChat(enrichedCtx);

  /* Titre auto de la conversation */
  const convTitle = messages.length > 0
    ? (messages[0].text.slice(0, 40) + (messages[0].text.length > 40 ? "…" : ""))
    : "Nouvelle discussion";

  /* Sauvegarde conversation quand messages changent */
  useEffect(() => {
    if (messages.length === 0) return;
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== activeConvId);
      const conv: Conversation = { id: activeConvId, title: convTitle, messages, createdAt: Date.now() };
      const next = [conv, ...updated];
      saveConversations(next);
      return next;
    });
  }, [messages, activeConvId, convTitle]);

  /* Scroll bas */
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  /* Charger une conversation */
  const handleSelectConv = (conv: Conversation) => {
    setActiveConvId(conv.id);
  };

  /* Supprimer conversation */
  const handleDeleteConv = (id: string) => {
    setConversations(prev => { const next = prev.filter(c => c.id !== id); saveConversations(next); return next; });
    if (id === activeConvId) setActiveConvId(genId());
  };

  /* Gestion jetons */
  const handleAddToken = (name: string, value: string) => {
    const t: AccessToken = { id: genId(), name, value };
    setTokens(prev => { const next = [t, ...prev]; saveTokens(next); return next; });
  };
  const handleDeleteToken = (id: string) => {
    setTokens(prev => { const next = prev.filter(t => t.id !== id); saveTokens(next); return next; });
  };

  /* Envoyer */
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    sendMessage(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, loading, sendMessage]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">

      {/* ── Overlay fermeture panels ───────────────────────── */}
      {(showHistory || showTokens) && (
        <div className="absolute inset-0 bg-black/20 z-10"
          onClick={() => { setShowHistory(false); setShowTokens(false); }} />
      )}

      {/* ── Panneau historique ─────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <HistoryPanel conversations={conversations} onSelect={handleSelectConv}
            onDelete={handleDeleteConv} onClose={() => setShowHistory(false)} activeId={activeConvId} />
        )}
      </AnimatePresence>

      {/* ── Panneau jetons ─────────────────────────────────── */}
      <AnimatePresence>
        {showTokens && (
          <TokensPanel tokens={tokens} onAdd={handleAddToken}
            onDelete={handleDeleteToken} onClose={() => setShowTokens(false)} />
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-0">
        <button onClick={() => { setShowTokens(false); setShowHistory(v => !v); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <AlignLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-gray-800 max-w-[160px] truncate">{convTitle}</span>
          {tokens.length > 0 && (
            <span className="text-[9px] text-blue-500 font-medium">{tokens.length} jeton{tokens.length > 1 ? "s" : ""} actif{tokens.length > 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="w-8" />
      </div>

      {/* ── Messages ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {isEmpty && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-4 py-16 px-6">
            <WhaleIcon size={64} />
            <p className="text-lg font-semibold text-gray-800 text-center">
              Comment puis-je vous aider&nbsp;?
            </p>

            {tokens.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {tokens.map(t => (
                  <span key={t.id} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                    🔑 {t.name}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onWidgetSubmit={submitWidget} loading={loading} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone saisie ─────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-white px-4 pt-3 pb-4 z-0">
        <div className="relative bg-gray-50 rounded-2xl border border-gray-200 shadow-sm">
          <Textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey} placeholder="Message ou maintenir pour parler…"
            disabled={loading} rows={1}
            className="w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none text-sm text-gray-800 placeholder:text-gray-400 px-4 pt-3 pb-10 min-h-[52px] max-h-[160px] leading-relaxed"
            style={{ scrollbarWidth: "none" }} />
          <AnimatePresence>
            {input.trim() && (
              <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleSend} disabled={loading}
                className="absolute bottom-2.5 right-3 w-7 h-7 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors shadow-md">
                {loading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Boutons modes */}
        <div className="flex items-center gap-2 mt-2.5">
          <button onClick={() => setMode(m => m === "reflection" ? "none" : "reflection")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              mode === "reflection" ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"}`}>
            <BrainCircuit className="w-3.5 h-3.5" /> Réflexion
          </button>
          <button onClick={() => setMode(m => m === "search" ? "none" : "search")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              mode === "search" ? "border-blue-400 text-blue-600 bg-blue-50" : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"}`}>
            <Globe className="w-3.5 h-3.5" /> Rechercher
          </button>
          <div className="flex-1" />
          {/* + ouvre le panneau jetons */}
          <button onClick={() => { setShowHistory(false); setShowTokens(v => !v); }}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors relative ${
              tokens.length > 0 ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
            <Plus className={`w-4 h-4 ${tokens.length > 0 ? "text-blue-500" : "text-gray-600"}`} />
            {tokens.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {tokens.length}
              </span>
            )}
          </button>
          {/* Micro */}
          <button className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors">
            <Mic className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
