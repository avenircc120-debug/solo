export function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-background/80 backdrop-blur-md py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center space-x-2 mb-4 md:mb-0">
          <span className="font-display font-bold text-lg text-white/80">STUDIO AI</span>
          <span className="text-white/30 text-sm">© {new Date().getFullYear()}</span>
        </div>
        <div className="text-sm text-white/40 flex items-center">
          Propulsé par <span className="text-white/80 font-medium ml-1">Google Gemini 2.0 Flash</span>
        </div>
      </div>
    </footer>
  );
}
