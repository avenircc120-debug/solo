import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, X, Globe, Plus, Mic, AlignLeft, BrainCircuit,
  Eye, EyeOff, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useChat, type ChatMessage, type Widget, type WidgetField } from "@/hooks/use-chat";
import type { ChatContext } from "@/hooks/use-chat";

/* ─── Icône baleine SVG ────────────────────────────────────────── */
function WhaleIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="38" cy="42" rx="26" ry="20" fill="#4D7EFF" opacity="0.15" />
      <path
        d="M14 44c0-13.255 10.745-24 24-24s24 10.745 24 24c0 5-1.5 9.6-4 13.3l4 6.7H18l4-6.7A23.9 23.9 0 0 1 14 44Z"
        fill="#4D7EFF"
      />
      <circle cx="52" cy="36" r="3" fill="white" opacity="0.9" />
      <path d="M56 38c2-1 5-3 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M18 58c-3 2-7 3-9 1" stroke="#4D7EFF" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M62 58c3 2 7 3 9 1" stroke="#4D7EFF" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="40" cy="52" rx="10" ry="5" fill="white" opacity="0.12" />
    </svg>
  );
}

/* ─── Rendu markdown léger ─────────────────────────────────────── */
function MdText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return (
            <code key={i} className="px-1.5 py-0.5 rounded bg-blue-50 font-mono text-xs text-blue-600 border border-blue-100">
              {p.slice(1, -1)}
            </code>
          );
        if (p.startsWith("*") && p.endsWith("*"))
          return <em key={i} className="italic text-gray-500">{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

/* ─── Champ individuel d'un widget ─────────────────────────────── */
function WidgetFieldInput({
  field, value, onChange,
}: { field: WidgetField; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const isPassword = field.type === "password";
  const isTextarea = field.type === "textarea";
  const isSelect = field.type === "select";

  if (isTextarea) {
    return (
      <div className="space-y-1">
        <label className="text-xs text-gray-500">{field.label}</label>
        <Textarea
          placeholder={field.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 font-mono text-xs min-h-[80px] resize-y rounded-xl"
        />
      </div>
    );
  }
  if (isSelect && field.options) {
    return (
      <div className="space-y-1">
        <label className="text-xs text-gray-500">{field.label}</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="">-- Sélectionner --</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{field.label}</label>
      <div className="relative">
        <Input
          type={isPassword && !show ? "password" : "text"}
          placeholder={field.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 rounded-xl pr-9"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Widget interactif ─────────────────────────────────────────── */
function InlineWidget({
  widget, msgId, onSubmit, disabled,
}: { widget: Widget; msgId: string; onSubmit: (msgId: string, values: Record<string, string>, action: string) => void; disabled: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({});

  if (widget.submitted) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 border border-green-100">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{widget.result ?? "Action effectuée avec succès"}</span>
      </div>
    );
  }
  if (widget.type === "code_block") {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 border-b border-gray-200">
          <span className="text-xs text-gray-500 font-mono">{widget.language ?? "code"}</span>
        </div>
        <pre className="px-4 py-3 text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto">
          {widget.code}
        </pre>
      </div>
    );
  }

  const fields = widget.fields ?? [];

  return (
    <div className="mt-3 space-y-3 bg-gray-50 rounded-2xl p-4 border border-gray-200">
      {widget.label && (
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{widget.label}</p>
      )}
      {fields.map(f => (
        <WidgetFieldInput
          key={f.key}
          field={f}
          value={values[f.key] ?? ""}
          onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
        />
      ))}
      <Button
        size="sm"
        onClick={() => onSubmit(msgId, values, widget.action ?? "")}
        disabled={disabled}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
      >
        Valider
      </Button>
    </div>
  );
}

/* ─── Bulle de message ──────────────────────────────────────────── */
function MessageBubble({
  msg, onWidgetSubmit, loading,
}: { msg: ChatMessage; onWidgetSubmit: (msgId: string, values: Record<string, string>, action: string) => void; loading: boolean }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-4"
      >
        <div className="max-w-[75%] bg-blue-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
          {msg.text}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start mb-4"
    >
      <div className="max-w-[85%]">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <WhaleIcon size={18} />
          </div>
          <div className="bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-gray-800 leading-relaxed shadow-sm">
            <MdText text={msg.text} />
            {msg.widget && (
              <InlineWidget
                widget={msg.widget}
                msgId={msg.id}
                onSubmit={onWidgetSubmit}
                disabled={loading}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Indicateur de saisie ──────────────────────────────────────── */
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
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-400"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Composant principal ChatSection ───────────────────────────── */
export function ChatSection({ ctx }: { ctx: ChatContext }) {
  const { messages, loading, sendMessage, submitWidget } = useChat(ctx);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"none" | "reflection" | "search">("none");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    sendMessage(text);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, loading, sendMessage]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── En-tête style DeepSeek ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <AlignLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-800">Nouvelle discussion</span>
        <button className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* ── Zone messages ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {/* État vide */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-4 py-16"
          >
            <WhaleIcon size={64} />
            <p className="text-lg font-semibold text-gray-800 text-center">
              Comment puis-je vous aider&nbsp;?
            </p>
          </motion.div>
        )}

        {/* Messages */}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onWidgetSubmit={submitWidget}
            loading={loading}
          />
        ))}

        {/* Indicateur de saisie */}
        {loading && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* ── Zone de saisie style DeepSeek ─────────────────────────── */}
      <div className="border-t border-gray-100 bg-white px-4 pt-3 pb-4">
        {/* Input pill */}
        <div className="relative bg-gray-50 rounded-2xl border border-gray-200 shadow-sm">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Message ou maintenir pour parler…"
            disabled={loading}
            rows={1}
            className="w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none text-sm text-gray-800 placeholder:text-gray-400 px-4 pt-3 pb-10 min-h-[52px] max-h-[160px] leading-relaxed"
            style={{ scrollbarWidth: "none" }}
          />
          {/* Bouton envoyer en bas à droite de l'input */}
          <AnimatePresence>
            {input.trim() && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleSend}
                disabled={loading}
                className="absolute bottom-2.5 right-3 w-7 h-7 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors shadow-md"
              >
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  : <Send className="w-3.5 h-3.5 text-white" />
                }
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Boutons modes sous l'input */}
        <div className="flex items-center gap-2 mt-2.5">
          {/* Réflexion */}
          <button
            onClick={() => setMode(m => m === "reflection" ? "none" : "reflection")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              mode === "reflection"
                ? "border-blue-400 text-blue-600 bg-blue-50"
                : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            Réflexion
          </button>

          {/* Rechercher */}
          <button
            onClick={() => setMode(m => m === "search" ? "none" : "search")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              mode === "search"
                ? "border-blue-400 text-blue-600 bg-blue-50"
                : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Rechercher
          </button>

          <div className="flex-1" />

          {/* + */}
          <button className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors">
            <Plus className="w-4 h-4 text-gray-600" />
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
