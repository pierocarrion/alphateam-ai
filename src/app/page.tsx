import Link from "next/link";
import { Mira } from "@/shared/ui";
import { WaitlistForm } from "@/features/marketing/components/WaitlistForm";

export const metadata = {
  title: "AlphaLead AI — Stop team procrastination before it spreads",
  description:
    "AlphaLead AI is an AI teammate that detects procrastination in team chat, shrinks tasks into 2-minute starts, and gives leaders private insights — without shame.",
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AlphaLead AI",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  description:
    "AI teammate that detects procrastination in team chat, shrinks tasks into 2-minute starts, and gives leaders private insights — without shame.",
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
    {
      "@type": "Offer",
      price: "15",
      priceCurrency: "USD",
      name: "Team",
      description: "per user / month",
    },
  ],
  publisher: { "@type": "Organization", name: "AlphaLead AI" },
};

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-2.5">
          <Mira size={32} mood="happy" />
          <span className="font-display text-xl text-ink">AlphaLead</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="#pricing" className="hidden text-sm font-semibold text-ink-2 hover:text-ink sm:block">
            Pricing
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-surface px-5 py-2.5 text-sm font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)] transition hover:bg-surface-2"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center px-6 pt-10 pb-20 text-center lg:px-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface px-4 py-1.5 text-xs font-bold text-ink-2">
          <span className="h-2 w-2 rounded-full bg-sage" />
          Built for teams that want to move
        </div>
        <h1 className="mt-6 max-w-3xl font-display text-[42px] leading-[1.05] text-ink sm:text-[56px] lg:text-[68px]">
          Your team loses 2+ hours a day to procrastination. Mira gets it back.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
          AlphaLead AI listens to your team chat, turns vague tasks into tiny first steps, and helps
          leaders spot overload before it burns the team out.
        </p>
        <div className="mt-8 flex w-full justify-center">
          <WaitlistForm buttonText="Get early access" />
        </div>
        <p className="mt-4 text-xs text-ink-3">
          14-day free trial · No credit card required
        </p>

        {/* Preview card */}
        <div className="mt-14 w-full max-w-4xl rounded-[32px] border border-line-2 bg-surface p-6 shadow-2xl sm:p-10">
          <div className="flex flex-col gap-6 text-left sm:flex-row sm:items-start">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Mira noticed</p>
              <p className="mt-2 text-[17px] text-ink-2">
                &ldquo;Could you pull together a rough draft of the Q3 launch deck?&rdquo;
              </p>
              <div className="mt-4 rounded-2xl border border-accent bg-accent-soft p-4">
                <p className="text-sm font-bold text-accent">Your first step, already tiny</p>
                <p className="mt-1 text-[15px] text-ink">
                  Open the deck and type one messy sentence. That&apos;s the whole job.
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-line bg-bg p-6 text-center">
              <Mira size={72} mood="calm" />
              <p className="mt-4 font-display text-xl text-ink">2-minute ritual</p>
              <p className="mt-1 text-sm text-ink-2">Starting is the hardest part. Mira sits with you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem stats */}
      <section className="border-y border-line bg-bg-2 px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-[28px] text-ink sm:text-[36px]">
            Procrastination is a team sport — and it&apos;s expensive
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <StatCard value="131" label="minutes lost per employee per day" />
            <StatCard value="$10K" label="average annual cost per employee" />
            <StatCard value="35%" label="more missed deadlines in procrastinating teams" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-[28px] text-ink sm:text-[36px]">
            How Mira runs your team&apos;s momentum
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Detects tasks in chat"
              desc="Mira listens to Slack/team chat, spots hidden tasks, and turns them into tiny first steps."
            />
            <FeatureCard
              title="2-minute rituals"
              desc="No more staring at a blank page. Mira guides each person through the emotional threshold of starting."
            />
            <FeatureCard
              title="Private leader dashboard"
              desc="Only leaders see team load, deadlines at risk, and burnout signals — never public shaming."
            />
            <FeatureCard
              title="Pair-start"
              desc="When someone is stuck, Mira matches them with a teammate to start together."
            />
            <FeatureCard
              title="Check engine alerts"
              desc="Tareas estancadas detectadas automáticamente. El líder recibe una alerta privada y una sugerencia de acción."
            />
            <FeatureCard
              title="Daily check-in"
              desc="Cada mañana Mira pregunta cómo se siente el equipo y ajusta las prioridades del día."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line bg-bg-2 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-display text-[28px] text-ink sm:text-[36px]">
            Simple pricing for real teams
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <PricingCard
              name="Free"
              price="$0"
              period="forever"
              features={["1 workspace", "Up to 5 users", "Basic chat detection", "3 rituals/week"]}
              cta="Start free"
              href="/login"
            />
            <PricingCard
              name="Team"
              price="$15"
              period="per user / month"
              features={[
                "Unlimited users",
                "Crew & pair-start",
                "Private leader dashboard",
                "Daily check-ins",
                "Check engine alerts",
              ]}
              cta="Join waitlist"
              highlighted
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center lg:px-12">
        <h2 className="font-display text-[32px] leading-tight text-ink sm:text-[44px]">
          Stop the delay before it spreads.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-ink-2">
          Join the teams using Mira to recover focus, protect energy, and ship on time.
        </p>
        <div className="mx-auto mt-8 flex max-w-md justify-center">
          <WaitlistForm buttonText="Get early access" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-3 lg:px-12">
        © {new Date().getFullYear()} AlphaLead AI. Built with AI agents on Google Cloud.
      </footer>
    </main>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[24px] border border-line bg-surface p-6 text-center">
      <div className="font-display text-[40px] text-accent">{value}</div>
      <p className="mt-2 text-sm leading-snug text-ink-2">{label}</p>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[24px] border border-line bg-surface p-6 transition hover:bg-surface-2">
      <h3 className="font-display text-xl text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{desc}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  href,
  highlighted = false,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href?: string;
  highlighted?: boolean;
}) {
  const Wrapper = href ? Link : "div";
  return (
    <Wrapper
      href={href || "#"}
      className={`rounded-[28px] border p-8 ${
        highlighted
          ? "border-accent bg-accent-soft"
          : "border-line bg-surface"
      }`}
    >
      <h3 className="font-display text-2xl text-ink">{name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-[48px] text-ink">{price}</span>
        <span className="text-ink-3">/{period}</span>
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-[15px] text-ink-2">
            <span className="text-sage">✓</span>
            {f}
          </li>
        ))}
      </ul>
      {href ? (
        <div className="mt-8 block rounded-full bg-surface px-6 py-3 text-center font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]">
          {cta}
        </div>
      ) : (
        <div className="mt-8">
          <WaitlistForm buttonText={cta} />
        </div>
      )}
    </Wrapper>
  );
}
