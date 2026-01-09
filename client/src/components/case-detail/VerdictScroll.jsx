import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Sparkles, TrendingUp, Heart, Lightbulb, MessageSquare } from 'lucide-react';

/**
 * Premium verdict scroll with golden frame and judge personality
 */
const VerdictScroll = ({
  verdict,
  partnerAName,
  partnerBName,
  caseId,
  t
}) => {
  if (!verdict) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1 }}
      className="relative"
    >
      {/* Decorative top flourish */}
      <div className="flex justify-center mb-[-12px] relative z-10">
        <div className="px-6 py-2 bg-gradient-to-b from-court-gold to-amber-500 rounded-t-xl shadow-lg shadow-amber-500/20">
          <Scale className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="glass-card relative overflow-hidden p-0 border-2 border-court-gold/30">
        {/* Luxurious header */}
        <div className="relative bg-gradient-to-br from-amber-50 via-court-cream to-amber-100/50 px-5 py-6">
          {/* Texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          {/* Golden corner decorations */}
          <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-court-gold/40 rounded-tl-lg" />
          <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-court-gold/40 rounded-tr-lg" />
          <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-court-gold/40 rounded-bl-lg" />
          <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-court-gold/40 rounded-br-lg" />

          <div className="relative flex items-center gap-4">
            {/* Judge portrait with elaborate frame */}
            <div className="relative">
              <div className="absolute inset-[-6px] rounded-2xl border-2 border-court-gold/30" />
              <div className="absolute inset-0 rounded-xl bg-court-gold/20 blur-lg" />
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-court-gold/50 shadow-lg">
                <img
                  src="/assets/avatars/judge_whiskers.png"
                  alt="Judge Whiskers"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-court-gold uppercase tracking-[0.3em]">
                {t?.('cases.detail.verdict.officialRuling') || 'Official Ruling'}
              </p>
              <p className="text-xl font-display font-bold text-neutral-800">
                {t?.('cases.detail.verdict.judgeName') || 'Judge Whiskers'}
              </p>
              <p className="text-xs text-neutral-500">
                {t?.('cases.detail.verdict.judgeTitle') || 'Chief Justice of Feline Affairs'}
              </p>
            </div>
          </div>
        </div>

        {/* Verdict content sections */}
        <div className="p-5 space-y-6">
          {/* The Summary */}
          {(verdict.theSummary || verdict.summary) && (
            <div className="relative">
              <div className="absolute -left-5 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-400 to-violet-200 rounded-full" />
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-bold text-violet-500">
                  {t?.('court.verdict.sections.summary.title') || 'The Summary'}
                </span>
              </div>
              <p className="text-neutral-700 leading-relaxed text-[15px]">
                {verdict.theSummary || verdict.summary}
              </p>
            </div>
          )}

          {/* The Purr - Validation */}
          {verdict.theRuling_ThePurr && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-md shadow-green-500/30">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-emerald-700">
                  {t?.('court.verdict.sections.purr.title') || 'What You Both Did Right'}
                </span>
              </div>

              <div className="grid gap-3">
                {/* Partner A validation */}
                <div className="relative pl-4 py-3 pr-4 rounded-xl bg-gradient-to-r from-emerald-50/80 to-green-50/50 border-l-4 border-emerald-400">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-rose-500">A</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">{partnerAName}</span>
                  </div>
                  <p className="text-neutral-700 text-sm">{verdict.theRuling_ThePurr.userA}</p>
                </div>

                {/* Partner B validation */}
                <div className="relative pl-4 py-3 pr-4 rounded-xl bg-gradient-to-r from-emerald-50/80 to-green-50/50 border-l-4 border-emerald-400">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-violet-500">B</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">{partnerBName}</span>
                  </div>
                  <p className="text-neutral-700 text-sm">{verdict.theRuling_ThePurr.userB}</p>
                </div>
              </div>
            </div>
          )}

          {/* The Hiss - Growth areas */}
          {verdict.theRuling_TheHiss?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-amber-700">
                  {t?.('court.verdict.sections.hiss.title') || 'Room to Grow'}
                </span>
              </div>

              <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/40">
                <div className="space-y-3">
                  {verdict.theRuling_TheHiss.map((hiss, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[11px] font-bold text-amber-600">{i + 1}</span>
                      </div>
                      <p className="text-neutral-700 text-sm leading-relaxed">{hiss}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* The Sentence - Repair exercise */}
          {verdict.theSentence && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-md shadow-rose-500/30">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-rose-700">
                  {t?.('court.verdict.sections.sentence.title') || 'Your Repair Exercise'}
                </span>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 via-pink-50/80 to-rose-100/50 p-5 border border-rose-200/50">
                {/* Decorative elements */}
                <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-rose-200/40 blur-2xl" />
                <div className="absolute top-0 left-1/3 h-20 w-20 rounded-full bg-pink-200/30 blur-xl" />

                <div className="relative">
                  <p className="font-display font-bold text-lg text-neutral-800 mb-2">
                    {verdict.theSentence.title}
                  </p>
                  <p className="text-neutral-700 leading-relaxed mb-4">
                    {verdict.theSentence.description}
                  </p>
                  {verdict.theSentence.rationale && (
                    <div className="pt-3 border-t border-rose-200/50">
                      <p className="text-neutral-500 text-sm italic flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        {verdict.theSentence.rationale}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Closing statement */}
          {verdict.closingStatement && (
            <div className="pt-4 border-t border-neutral-100">
              <div className="relative px-6 py-4">
                <div className="absolute left-0 top-0 text-5xl text-neutral-200 font-serif leading-none">"</div>
                <p className="text-neutral-600 text-center italic leading-relaxed px-4">
                  {verdict.closingStatement}
                </p>
                <div className="absolute right-0 bottom-0 text-5xl text-neutral-200 font-serif leading-none rotate-180">"</div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom seal */}
        <div className="flex justify-center py-4 bg-gradient-to-t from-amber-50/50 to-transparent">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <div className="h-px w-8 bg-neutral-200" />
            <span>Case #{caseId?.slice(-6) || '------'}</span>
            <div className="h-px w-8 bg-neutral-200" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VerdictScroll;
