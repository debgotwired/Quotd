import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Mic,
  FileText,
  BarChart3,
  Zap,
  ArrowRight,
  Quote,
  Clock,
  Send,
} from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link href="/" className="text-lg tracking-tight font-semibold">
            Quotd
          </Link>
          <div className="flex items-center gap-8">
            <a
              href="#how-it-works"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:block"
            >
              How it works
            </a>
            <a
              href="#features"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:block"
            >
              Features
            </a>
            <Link
              href="/login"
              className="text-sm font-medium bg-gray-900 text-white px-5 py-2 rounded-full hover:bg-gray-800 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
        <div className="h-px bg-gray-100" />
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium tracking-widest uppercase text-gray-400 mb-6 animate-fade-in">
            Customer stories, automated
          </p>
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-serif font-normal tracking-tight leading-[1.1] text-balance animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            Turn conversations into
            <br />
            <span className="italic">case studies</span>
          </h1>
          <p
            className="mt-8 text-lg sm:text-xl text-gray-500 max-w-xl mx-auto leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "250ms" }}
          >
            Quotd conducts AI-powered voice interviews with your customers and
            transforms them into polished, publish-ready case studies.
          </p>
          <div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up"
            style={{ animationDelay: "400ms" }}
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-3.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors px-6 py-3.5"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="py-12 px-6 border-y border-gray-100">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 text-center">
          <div>
            <p className="text-3xl font-serif">12</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">
              Questions per interview
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200" />
          <div>
            <p className="text-3xl font-serif">~8 min</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">
              Average completion
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200" />
          <div>
            <p className="text-3xl font-serif">Voice-first</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">
              Natural conversation
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-20">
            <p className="text-sm font-medium tracking-widest uppercase text-gray-400 mb-4">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">
              Three steps. One case study.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group p-8 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                <Send className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-3">
                01
              </p>
              <h3 className="text-lg font-medium mb-2">Share a link</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Create an interview for your customer. They get a simple link —
                no signup, no app, no friction.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                <Mic className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-3">
                02
              </p>
              <h3 className="text-lg font-medium mb-2">They talk</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Our AI conducts a natural voice interview — asking smart
                follow-ups, extracting metrics, capturing their exact words.
              </p>
            </div>

            <div className="group p-8 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-6">
                <FileText className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-3">
                03
              </p>
              <h3 className="text-lg font-medium mb-2">You publish</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Get a complete case study draft with key metrics, direct quotes,
                and a structured narrative. Export as PDF, Word, or HTML.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-gray-100" />
      </div>

      {/* Features */}
      <section id="features" className="py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-20">
            <p className="text-sm font-medium tracking-widest uppercase text-gray-400 mb-4">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">
              Everything extracted. Nothing missed.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex gap-5 p-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1.5">Voice-first interviews</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Customers speak naturally. Real-time transcription with
                  Deepgram. Text fallback always available.
                </p>
              </div>
            </div>

            <div className="flex gap-5 p-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1.5">Adaptive AI questions</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Every question builds on the last answer. The AI pursues the
                  most compelling threads automatically.
                </p>
              </div>
            </div>

            <div className="flex gap-5 p-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1.5">Metric extraction</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Hard numbers pulled automatically — revenue impact, time
                  saved, efficiency gains — with before-and-after context.
                </p>
              </div>
            </div>

            <div className="flex gap-5 p-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                <Quote className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1.5">Quote capture</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  The most powerful moments from the conversation, tagged and
                  ready for your marketing team.
                </p>
              </div>
            </div>

            <div className="flex gap-5 p-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1.5">Draft generation</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  A structured, publish-ready case study in seconds. Challenge,
                  solution, impact — written from the customer&apos;s
                  perspective.
                </p>
              </div>
            </div>

            <div className="flex gap-5 p-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <h3 className="font-medium mb-1.5">Zero customer friction</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  No logins, no scheduling, no apps. One link, one
                  conversation, done in under 10 minutes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-gray-100" />
      </div>

      {/* CTA */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-serif tracking-tight mb-4">
            Your next case study is one
            <br />
            <span className="italic">conversation</span> away.
          </h2>
          <p className="text-gray-500 mb-10">
            Free to start. No credit card required.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-3.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Get started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">Quotd</p>
          <p className="text-xs text-gray-300">
            &copy; {new Date().getFullYear()} Quotd. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
