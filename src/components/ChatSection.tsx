import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Bot, User, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useChat, type ChatMessage, type Widget, type WidgetField } from "@/hooks/use-chat";
import type { ChatContext } from "@/hooks/use-chat";

// ── Rendu texte avec markdown léger ──────────────────────────
function MdText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return <code key={i} className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-xs text-primary">{p.slice(1, -1)}</code>;
        if (p.startsWith("*") && p.endsWith("*"))
          return <em key={i} className="italic text-white/70">{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

// ── Champ individuel d'un widget ──────────────────────────────
function WidgetFieldInput({
  field,
  value,
  onChange,
}: {
  field: WidgetField;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const isPassword = field.type === "password";
  const isTextarea = field.type === "textarea";
  const isSelect = field.type === "select";

  if (isTextarea) {
    return (
      <div className="space-y-1">
        <label className="text-xs text-white/50">{field.label}</label>
        <Textarea
          placeholder={field.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/25 font-mono text-xs min-h-[80px] resize-y"
        />
      </div>
    );
  }

  if (isSelect && field.options) {
    return (
      <div className="space-y-1">
        <label className="text-xs text-white/50">{field.label}</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary/50"
        >
          <option value="">-- Sélectionner --</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">{field.label}</label>
      <div className="relative">
        <Input
          type={isPassword && !show ? "password" : "text"}
          placeholder={field.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/25 pr-9"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Widget interactif dans le chat ────────────────────────────
function InlineWidget({
  widget,
  msgId,
  onSubmit,
  disabled,
}: {
  widget: Widget;
  msgId: string;
  onSubmit: (msgId: string, values: Record<string, string>, action: string) => void;
  disabled: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  if (widget.submitted) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{widget.result}</span>
      </div>
    );
  }

  if (widget.type === "code_block") {
    return (
      <div className="mt-3 rounded-lg bg-black/40 border border-white/10 overflow-hidden">
        <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs text-white/30 font-mono">{widget.language ?? "text"}</span>
        </div>
        <pre className="p-3 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
          {widget.code}
        </pre>
      </div>
    );
  }

  const fields = widget.fields ?? [];
  const canSubmit = fields.every(f => !f.required || !!values[f.key]?.trim());

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
    >
      {widget.label && (
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">{widget.label}</p>
      )}

      {fields.map(field => (
        <WidgetFieldInput
          key={field.key}
          field={field}
          value={values[field.key] ?? ""}
          onChange={v => setValues(prev => ({ ...prev, [field.key]: v }))}
        />
      ))}

      <Button
        onClick={() => onSubmit(msgId, values, widget.action ?? "")}
        disabled={disabled || !canSubmit}
        size="sm"
        className="w-full bg-primary hover:bg-primary/80 text-white font-medium"
      >
        {disabled ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : null}
        Confirmer
      </Button>
    </motion.div>
  );
}

// ── Bulle de message ──────────────────────────────────────────
function MessageBubble({
  message,
  onSubmit,
  disabled,
}: {
  message: ChatMessage;
  onSubmit: (msgId: string, values: Record<string, string>, action: string) => void;
  disabled: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
        ${isUser ? "bg-primary/20" : "bg-white/5 border border-white/10"}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-primary" />
          : <Bot className="w-3.5 h-3.5 text-white/50" />}
      </div>

      {/* Bulle */}
      <div className={`max-w-[80%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? "bg-primary text-white rounded-tr-sm"
            : "bg-white/[0.06] border border-white/8 text-white/80 rounded-tl-sm"}`}>
          <MdText text={message.text} />
        </div>

        {/* Widget intégré dans la bulle assistant */}
        {!isUser && message.widget && (
          <div className="w-full max-w-sm">
            <InlineWidget
              widget={message.widget}
              msgId={message.id}
              onSubmit={onSubmit}
              disabled={disabled}
            />
          </div>
        )}

        <span className="text-[10px] text-white/20 px-1">
          {message.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

// ── Section chat principale ────────────────────────────────────
export function ChatSection({ ctx }: { ctx: ChatContext }) {
  const { messages, input, setInput, loading, sendMessage, submitWidget } = useChat(ctx);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Suggestions rapides
  const suggestions = ctx.service
    ? [
        "Crée une variable d'environnement",
        "Lis le fichier package.json",
        "Pousse un fichier de config",
        "Qu'est-ce qui manque dans ce projet ?",
      ]
    : ["Connecte mon GitHub", "Ajoute un token Vercel", "Comment ça marche ?"];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSubmit={submitWidget}
              disabled={loading}
            />
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-white/50" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/8">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary/60"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions rapides */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              disabled={loading}
              className="text-xs text-white/40 border border-white/10 rounded-full px-3 py-1.5 hover:border-primary/40 hover:text-primary/70 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Zone de saisie */}
      <div className="border-t border-white/8 px-4 py-3">
        <div className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Dites-moi ce que vous voulez configurer…"
            disabled={loading}
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/25 h-10"
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            size="icon"
            className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/80 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-center text-[10px] text-white/15 mt-1.5">
          Entrée pour envoyer · Gemini 2.0 Flash
        </p>
      </div>
    </div>
  );
}
