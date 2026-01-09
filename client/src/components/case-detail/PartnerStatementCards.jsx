import React from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

/**
 * Single partner statement card
 */
const PartnerCard = ({
  name,
  input,
  feelings,
  isPartnerA,
  avatarUrl,
  delay = 0,
  t
}) => {
  const theme = isPartnerA
    ? {
        blobColor: 'bg-rose-200/50',
        secondaryBlob: 'bg-pink-100/40',
        accentGradient: 'from-rose-400 via-pink-400 to-rose-300',
        avatarBg: 'from-rose-100 to-pink-100',
        avatarGlow: 'bg-rose-300/50',
        textColor: 'text-rose-400',
        nameColor: 'text-neutral-800',
        quoteColor: 'text-rose-200',
        feelingsColor: 'text-rose-500',
        feelingsLine: 'via-rose-200/60',
        position: 'left',
      }
    : {
        blobColor: 'bg-violet-200/50',
        secondaryBlob: 'bg-purple-100/40',
        accentGradient: 'from-violet-400 via-purple-400 to-violet-300',
        avatarBg: 'from-violet-100 to-purple-100',
        avatarGlow: 'bg-violet-300/50',
        textColor: 'text-violet-400',
        nameColor: 'text-neutral-800',
        quoteColor: 'text-violet-200',
        feelingsColor: 'text-violet-500',
        feelingsLine: 'via-violet-200/60',
        position: 'right',
      };

  const slideDirection = isPartnerA ? -30 : 30;
  const marginClass = isPartnerA ? 'ml-0 mr-6' : 'ml-6 mr-0';
  const accentPosition = isPartnerA ? 'left-0 rounded-l-3xl' : 'right-0 rounded-r-3xl';

  return (
    <motion.div
      initial={{ opacity: 0, x: slideDirection }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`relative ${marginClass} ${!isPartnerA ? 'z-10' : ''}`}
    >
      <div className="glass-card relative overflow-hidden p-5">
        {/* Signature color blob */}
        <div className={`absolute ${isPartnerA ? '-top-16 -right-16' : '-top-16 -left-16'} h-40 w-40 rounded-full ${theme.blobColor} blur-3xl`} />
        <div className={`absolute bottom-0 ${isPartnerA ? 'left-1/4' : 'right-1/4'} h-20 w-20 rounded-full ${theme.secondaryBlob} blur-2xl`} />

        {/* Accent ribbon */}
        <div className={`absolute ${accentPosition} top-0 bottom-0 w-1.5 bg-gradient-to-b ${theme.accentGradient}`} />

        <div className={`relative ${isPartnerA ? 'pl-3' : 'pr-3'}`}>
          {/* Header with avatar */}
          <div className={`flex items-center gap-3 mb-4 ${!isPartnerA ? 'flex-row-reverse' : ''}`}>
            <div className="relative">
              <div className={`absolute inset-0 rounded-full ${theme.avatarGlow} blur-md scale-125`} />
              <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${theme.avatarBg} border-2 border-white shadow-md overflow-hidden flex items-center justify-center`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className={`text-sm font-bold ${theme.textColor}`}>
                    {name?.charAt(0) || (isPartnerA ? 'A' : 'B')}
                  </span>
                )}
              </div>
            </div>
            <div className={!isPartnerA ? 'text-right' : ''}>
              <p className={`font-bold ${theme.nameColor}`}>{name}</p>
              <p className={`text-[10px] ${theme.textColor} uppercase tracking-wide`}>
                {t?.('cases.detail.partnerStatements.theirPerspective') || 'Their perspective'}
              </p>
            </div>
          </div>

          {/* Statement with styled quote */}
          <div className={`relative ${!isPartnerA ? 'text-right' : ''}`}>
            {isPartnerA && (
              <span className={`absolute -left-1 -top-2 text-4xl ${theme.quoteColor} font-serif`}>"</span>
            )}
            <p className={`text-neutral-700 leading-relaxed ${isPartnerA ? 'pl-4 pr-2' : 'pl-2 pr-4'}`}>
              {input || t?.('cases.detail.partnerStatements.noInput') || 'No statement provided'}
            </p>
            {!isPartnerA && (
              <span className={`absolute -right-1 -bottom-4 text-4xl ${theme.quoteColor} font-serif`}>"</span>
            )}
          </div>

          {/* Feelings tag */}
          {feelings && (
            <div className="mt-4 flex items-center gap-2">
              <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${theme.feelingsLine} to-transparent`} />
              <Heart className={`w-3 h-3 ${theme.feelingsColor}`} />
              <span className={`text-xs ${theme.feelingsColor} italic px-1`}>{feelings}</span>
              <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${theme.feelingsLine} to-transparent`} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Partner Statement Cards - Asymmetric duo layout
 * Cards are offset and overlap slightly, creating intimacy
 */
const PartnerStatementCards = ({
  partnerA,
  partnerB,
  userAInput,
  userBInput,
  userAFeelings,
  userBFeelings,
  t,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.85 }}
      className="space-y-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        <Heart className="w-4 h-4 text-amber-500" />
        <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-[0.25em]">
          {t?.('cases.detail.partnerStatements.title') || 'What They Said'}
        </span>
        <div className="flex-1 h-px bg-amber-200/60" />
      </div>

      {/* Asymmetric overlapping cards */}
      <div className="relative space-y-[-8px]">
        <PartnerCard
          name={partnerA?.display_name || t?.('cases.detail.partnerStatements.partnerA') || 'Partner A'}
          input={userAInput}
          feelings={userAFeelings}
          avatarUrl={partnerA?.avatar_url}
          isPartnerA={true}
          delay={0.9}
          t={t}
        />
        <PartnerCard
          name={partnerB?.display_name || t?.('cases.detail.partnerStatements.partnerB') || 'Partner B'}
          input={userBInput}
          feelings={userBFeelings}
          avatarUrl={partnerB?.avatar_url}
          isPartnerA={false}
          delay={1.0}
          t={t}
        />
      </div>
    </motion.div>
  );
};

export default PartnerStatementCards;
