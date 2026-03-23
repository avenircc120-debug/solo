import { AutoConfigSection } from "@/components/AutoConfigSection";

export default function Home() {
  return (
    <div
      className="min-h-screen bg-background relative"
      style={{
        backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%, hsl(217 91% 18% / 0.5), transparent)`,
      }}
    >
      <AutoConfigSection />
    </div>
  );
}
