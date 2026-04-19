import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { OperatorSection } from "@/components/landing/OperatorSection";
import { ConsumerSection } from "@/components/landing/ConsumerSection";
import { PricingSection } from "@/components/landing/PricingSection";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <HeroSection />
      <HowItWorksSection />
      <OperatorSection />
      <ConsumerSection />
      <PricingSection />
      <footer className="border-t border-zinc-200 bg-white px-6 py-8 text-center text-sm text-zinc-500">
        <p>
          &copy; {new Date().getFullYear()} Cardápio Rápido. Todos os direitos
          reservados.
        </p>
      </footer>
    </main>
  );
}
