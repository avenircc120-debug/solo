import { useState, useEffect } from 'react';

export type ServiceType = 'github' | 'openai' | 'groq' | 'xai' | 'gemini' | 'huggingface' | 'supabase' | 'unknown';

export interface DetectedToken {
  service: ServiceType;
  name: string;
  token: string;
}

export function useTokenManager() {
  const [token, setToken] = useState<string>('');
  const [detected, setDetected] = useState<DetectedToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('STUDIO_AI_TOKEN');
    if (saved) {
      setToken(saved);
      detect(saved);
    }
  }, []);

  const detect = (rawToken: string) => {
    const t = rawToken.trim();
    let service: ServiceType = 'unknown';
    let name = 'Service non reconnu';

    if (t.startsWith('ghp_') || t.startsWith('github_pat_')) { service = 'github'; name = 'GitHub'; }
    else if (t.startsWith('sk-proj-') || t.startsWith('sk-')) { service = 'openai'; name = 'OpenAI'; }
    else if (t.startsWith('gsk_')) { service = 'groq'; name = 'Groq'; }
    else if (t.startsWith('xai-')) { service = 'xai'; name = 'xAI'; }
    else if (t.startsWith('hf_')) { service = 'huggingface'; name = 'HuggingFace'; }
    else if (t.startsWith('AIzaSy')) { service = 'gemini'; name = 'Google Gemini'; }
    else if (t.startsWith('eyJ')) { service = 'supabase'; name = 'Supabase JWT'; }

    setDetected({ service, name, token: t });
    sessionStorage.setItem('STUDIO_AI_TOKEN', t);
    setActionResult(null);
    setActionError(null);
  };

  const handleSetToken = (val: string) => {
    setToken(val);
    if (!val) {
      sessionStorage.removeItem('STUDIO_AI_TOKEN');
      setDetected(null);
      setActionResult(null);
      setActionError(null);
    }
  };

  const executeAction = async (action: string, params: any = {}) => {
    if (!detected) return;
    setLoading(true);
    setActionError(null);
    setActionResult(null);

    try {
      let res;
      let data;

      switch (action) {
        case 'github_read':
          res = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/contents/${params.path}`, {
            headers: { Authorization: `Bearer ${detected.token}`, Accept: 'application/vnd.github.v3+json' }
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Erreur GitHub');
          setActionResult(data.content ? atob(data.content) : data);
          break;

        case 'github_push':
          res = await fetch(`https://api.github.com/repos/${params.owner}/${params.repo}/contents/${params.path}`, {
            method: 'PUT',
            headers: { 
              Authorization: `Bearer ${detected.token}`, 
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: "Update via Studio AI",
              content: btoa(params.content || ''),
              sha: params.sha || undefined
            })
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Erreur GitHub');
          setActionResult({ success: true, url: data.content?.html_url });
          break;

        case 'list_models_openai':
          res = await fetch(`https://api.openai.com/v1/models`, {
            headers: { Authorization: `Bearer ${detected.token}` }
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Erreur OpenAI');
          setActionResult(data.data.map((m: any) => m.id));
          break;

        case 'list_models_groq':
          res = await fetch(`https://api.groq.com/openai/v1/models`, {
            headers: { Authorization: `Bearer ${detected.token}` }
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Erreur Groq');
          setActionResult(data.data.map((m: any) => m.id));
          break;

        case 'list_models_xai':
          res = await fetch(`https://api.x.ai/v1/models`, {
            headers: { Authorization: `Bearer ${detected.token}` }
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Erreur xAI');
          setActionResult(data.data.map((m: any) => m.id));
          break;

        case 'list_models_gemini':
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${detected.token}`);
          data = await res.json();
          if (!res.ok) throw new Error(data.error?.message || 'Erreur Gemini');
          setActionResult(data.models.map((m: any) => m.name));
          break;

        case 'hf_whoami':
          res = await fetch(`https://huggingface.co/api/whoami-v2`, {
            headers: { Authorization: `Bearer ${detected.token}` }
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erreur HuggingFace');
          setActionResult({ name: data.name, email: data.email, type: data.type });
          break;

        case 'decode_jwt':
          try {
            const payload = detected.token.split('.')[1];
            setActionResult(JSON.parse(atob(payload)));
          } catch (e) {
            throw new Error("Le JWT ne peut pas être décodé.");
          }
          break;

        default:
          throw new Error("Action non supportée.");
      }
    } catch (err: any) {
      setActionError(err.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return {
    token,
    setToken: handleSetToken,
    detect,
    detected,
    loading,
    actionResult,
    actionError,
    executeAction
  };
}
