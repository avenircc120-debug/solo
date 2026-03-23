import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ScanLine, Brain, ChevronRight,
  Loader2, CheckCircle2, Settings, Github,
  MessageSquare, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAutoConfig } from "@/hooks/use-auto-config";
import { ChatSection } from "@/components/ChatSection";

const STEPS = [
  { id: "idle",      label: "Token",   icon: Search },
  { id: "detected",  label: "Scan",    icon: ScanLine },
  { id: "planning",  label: "Analyse", icon: Brain },
  { id: "executing", label: "Chat",    icon: MessageSquare },
  { id: "done",      label: "Terminé", icon: CheckCircle2 },
];
const PHASE_INDEX: Record<string, number> = {
  idle: 0, detected: 1, scanning: 1,
  planning: 2, executing: 3, done: 4,
};

export function AutoConfigSection() {
  const {
    token, setToken,
    geminiKey, saveGeminiKey,
    service, detect,
    loading, repos,
    selectedRepo, setSelectedRepo,
    phase, scan, analyzeWithGemini, reset,
  } = useAutoConfig();

  const [showGeminiInput, setShowGeminiInput] = useState(!geminiKey);
  const [tempGeminiKey, setTempGeminiKey] = useState(geminiKey);

  const currentStep = PHASE_INDEX[phase] ?? 0;
  const chatActive = phase === "executing" || phase === "done" || phase === "planning";

  // Contexte passé au chat
  const chatCtx = { token, geminiKey, service: service ?? undefined, selectedRepo };

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── ZONE HAUTE : config compacte ─────────────────── */}
      <div className="px-4 pt-12 pb-6 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full space-y-6">

        {/* Titre */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-xs text-primary/70 uppercase tracking-widest border border-primary/20 rounded-full px-4 py-1">
            <Zap className="w-3 h-3" /> Configurateur IA Universel
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Donnez accès.<br />
            <span className="text-primary">Tout est configuré.</span>
          </h1>
          <p className="text-white/40 text-sm max-w-lg mx-auto">
            Collez le token de n'importe quel service. Gemini analyse et discute avec vous pour tout configurer.
          </p>
        </motion.div>

        {/* Clé Gemini */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-center">
          <button
            onClick={() => setShowGeminiInput(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <Settings className="w-3 h-3" />
            {geminiKey ? "Clé Gemini configurée ✓" : "Configurer la clé Gemini (requis)"}
          </button>
          <AnimatePresence>
            {showGeminiInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 max-w-sm mx-auto mt-2">
                  <Input
                    type="password"
                    placeholder="AIzaSy..."
                    value={tempGeminiKey}
                    onChange={e => setTempGeminiKey(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm"
                  />
                  <Button
                    onClick={() => { saveGeminiKey(tempGeminiKey); setShowGeminiInput(false); }}
                    size="sm"
                    className="bg-primary text-white hover:bg-primary/80 shrink-0"
                  >
                    OK
                  </Button>
                </div>
                <p className="text-xs text-white/20 text-center mt-1">
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                    aistudio.google.com → Get API key
                  </a>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Étapes */}
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const active = i === currentStep;
            const done = i < currentStep;
            return (
              <div key={step.id} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all duration-300
                  ${active ? "bg-primary text-white font-semibold" : done ? "bg-primary/20 text-primary" : "bg-white/5 text-white/25"}`}>
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className={`w-3 h-3 ${done ? "text-primary/50" : "text-white/10"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Panneau de config ── */}
        <motion.div layout className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden">

          {/* Étape 1 : Saisie du token */}
          {phase === "idle" && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-white/40">Collez votre token d'accès pour commencer</p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="ghp_ · sk- · AIzaSy · xai- · gsk_ · hf_ · eyJ · vc_…"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && token && detect()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11 flex-1 text-sm"
                />
                <Button onClick={detect} disabled={!token} className="h-11 px-5 bg-primary hover:bg-primary/80 text-white shrink-0">
                  <Search className="w-4 h-4 mr-2" /> Détecter
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                {["GitHub ghp_", "Vercel vc_", "Supabase eyJ", "OpenAI sk-", "Groq gsk_", "xAI xai-", "Gemini AIzaSy", "HF hf_"].map(s => (
                  <span key={s} className="text-[10px] text-white/20 border border-white/8 rounded-full px-2 py-0.5">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Étape 2 : Service détecté + scan */}
          {(phase === "detected" || phase === "planning") && service && service.key !== "unknown" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{service.icon}</span>
                  <div>
                    <p className="text-white font-medium text-sm">{service.name} détecté</p>
                    <p className="text-[11px] text-white/35">Prêt à scanner vos projets</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${service.color} border px-2.5 py-0.5 text-xs`}>{service.name}</Badge>
                  <button onClick={reset} className="text-white/25 hover:text-white/60 text-xs transition-colors">✕</button>
                </div>
              </div>

              {/* Sélection de dépôt */}
              {repos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-white/40">Choisissez un projet :</p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                    {repos.map(r => (
                      <button
                        key={r.full_name}
                        onClick={() => setSelectedRepo(r.full_name)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs text-left transition-all
                          ${selectedRepo === r.full_name
                            ? "border-primary bg-primary/10 text-white"
                            : "border-white/8 bg-white/4 text-white/50 hover:border-white/20 hover:text-white"}`}
                      >
                        <Github className="w-3 h-3 shrink-0" />
                        <span className="truncate">{r.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {repos.length === 0 ? (
                  <Button onClick={scan} disabled={loading} className="flex-1 h-10 bg-primary hover:bg-primary/80 text-white text-sm">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ScanLine className="w-4 h-4 mr-2" />}
                    Scanner les projets
                  </Button>
                ) : (
                  <Button
                    onClick={() => analyzeWithGemini(selectedRepo)}
                    disabled={loading || !selectedRepo || !geminiKey}
                    className="flex-1 h-10 bg-primary hover:bg-primary/80 text-white text-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                    Analyser et ouvrir le chat
                  </Button>
                )}
              </div>
              {!geminiKey && <p className="text-xs text-yellow-400/60 text-center">⚠ Clé Gemini requise</p>}
            </div>
          )}

          {/* En-tête compact quand le chat est ouvert */}
          {chatActive && service && (
            <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{service.icon}</span>
                <span className="text-sm text-white/70">{service.name}</span>
                {selectedRepo && (
                  <span className="text-xs text-white/30">· {selectedRepo.split("/")[1] ?? selectedRepo}</span>
                )}
              </div>
              <button onClick={reset} className="text-white/25 hover:text-white/50 text-xs transition-colors">
                Changer de token
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── ZONE BASSE : chat ─────────────────────────────── */}
      <AnimatePresence>
        {chatActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-6 min-h-[500px] flex flex-col"
          >
            <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              <ChatSection ctx={chatCtx} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
