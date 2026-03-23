import { useState } from "react";
import { Link } from "wouter";
import { Settings, Play, Key, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NavbarProps {
  geminiKey: string;
  onSaveKey: (key: string) => void;
}

export function Navbar({ geminiKey, onSaveKey }: NavbarProps) {
  const [tempKey, setTempKey] = useState(geminiKey);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onSaveKey(tempKey);
    setOpen(false);
  };

  return (
    <nav className="fixed top-0 w-full z-50 glass-panel border-b-0 rounded-none bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center shadow-lg shadow-primary/20">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              STUDIO AI
            </span>
          </div>

          <div className="hidden md:flex space-x-8">
            <a href="#video-ia" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
              Vidéo IA
            </a>
            <a href="#token-manager" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
              Tokens
            </a>
          </div>

          <div className="flex items-center">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-white/5 rounded-full">
                  <Settings className="w-5 h-5 text-white/80" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md glass-panel border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2 text-xl font-display">
                    <Key className="w-5 h-5 text-primary" />
                    <span>Configuration API</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="gemini-key" className="text-white/80">Google Gemini API Key</Label>
                    <Input 
                      id="gemini-key"
                      type="password"
                      placeholder="AIzaSy..."
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                      className="glass-input text-white"
                    />
                    <p className="text-xs text-white/40">Cette clé est stockée localement dans votre navigateur.</p>
                  </div>
                  <Button 
                    onClick={handleSave}
                    className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 shadow-lg shadow-primary/25"
                  >
                    Enregistrer <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </nav>
  );
}
