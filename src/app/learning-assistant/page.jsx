import { Bot, Languages, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import AssistantChat from "@/components/ai/AssistantChat";

export const metadata = {
  title: "Learning Assistant | CipherBrief",
  description: "Learn cybersecurity concepts with local AI, flexible teaching modes, and English or Bangla explanations.",
};

export default function LearningAssistantPage() {
  return (
    <main>
      <SiteHeader />
      <section className="assistant-page">
        <div className="shell assistant-page-shell">
          <div className="assistant-page-heading">
            <span className="section-kicker">LEARN AT YOUR OWN PACE</span>
            <h1>A clearer way to learn cybersecurity.</h1>
            <p>Ask about concepts, commands, code, and security tools. Choose your depth and get explanations in English or Bangla.</p>
            <div className="assistant-page-points">
              <span><Bot size={15} /> Runs through your local Ollama model</span>
              <span><Languages size={15} /> English and Bangla teaching</span>
              <span><ShieldCheck size={15} /> Defensive, learning-first guidance</span>
            </div>
          </div>
          <AssistantChat />
        </div>
      </section>
    </main>
  );
}
