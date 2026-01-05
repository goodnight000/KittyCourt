/**
 * Milestones Configuration
 *
 * 9 challenging milestones covering all 6 core features:
 * - Judging (2 milestones)
 * - Daily Meow (2 milestones)
 * - Appreciation (1 milestone)
 * - Memories (2 milestones)
 * - Challenges (1 milestone)
 * - Planning/Calendar (1 milestone)
 */

export const MILESTONES = [
  // JUDGING FEATURE
  {
    id: 'first_resolution',
    emoji: '🐾',
    titleKey: 'profilePage.milestones.firstResolution.title',
    descriptionKey: 'profilePage.milestones.firstResolution.description',
    requirement: { type: 'cases', target: 3 },
    xpReward: 100,
    feature: 'judging',
  },
  {
    id: 'conflict_conquerors',
    emoji: '⚖️',
    titleKey: 'profilePage.milestones.conflictConquerors.title',
    descriptionKey: 'profilePage.milestones.conflictConquerors.description',
    requirement: { type: 'cases', target: 25 },
    xpReward: 400,
    feature: 'judging',
  },

  // DAILY MEOW FEATURE
  {
    id: 'daily_devotion',
    emoji: '☀️',
    titleKey: 'profilePage.milestones.dailyDevotion.title',
    descriptionKey: 'profilePage.milestones.dailyDevotion.description',
    requirement: { type: 'questions', target: 30 },
    xpReward: 200,
    feature: 'daily_meow',
  },
  {
    id: 'storytellers',
    emoji: '📖',
    titleKey: 'profilePage.milestones.storytellers.title',
    descriptionKey: 'profilePage.milestones.storytellers.description',
    requirement: { type: 'questions', target: 100 },
    xpReward: 450,
    feature: 'daily_meow',
  },

  // APPRECIATION FEATURE
  {
    id: 'generous_hearts',
    emoji: '💕',
    titleKey: 'profilePage.milestones.generousHearts.title',
    descriptionKey: 'profilePage.milestones.generousHearts.description',
    requirement: { type: 'appreciations', target: 20 },
    xpReward: 200,
    feature: 'appreciation',
  },

  // MEMORIES FEATURE
  {
    id: 'memory_makers',
    emoji: '📸',
    titleKey: 'profilePage.milestones.memoryMakers.title',
    descriptionKey: 'profilePage.milestones.memoryMakers.description',
    requirement: { type: 'memories', target: 5 },
    xpReward: 150,
    feature: 'memories',
  },
  {
    id: 'memory_vault',
    emoji: '🖼️',
    titleKey: 'profilePage.milestones.memoryVault.title',
    descriptionKey: 'profilePage.milestones.memoryVault.description',
    requirement: { type: 'memories', target: 30 },
    xpReward: 350,
    feature: 'memories',
  },

  // CHALLENGES FEATURE
  {
    id: 'challenge_masters',
    emoji: '🏆',
    titleKey: 'profilePage.milestones.challengeMasters.title',
    descriptionKey: 'profilePage.milestones.challengeMasters.description',
    requirement: { type: 'challenges', target: 15 },
    xpReward: 350,
    feature: 'challenges',
  },

  // PLANNING/CALENDAR FEATURE
  {
    id: 'date_planners',
    emoji: '📅',
    titleKey: 'profilePage.milestones.datePlanners.title',
    descriptionKey: 'profilePage.milestones.datePlanners.description',
    requirement: { type: 'calendar_events', target: 10 },
    xpReward: 250,
    feature: 'planning',
  },
];

/**
 * Calculate milestone progress based on user stats
 * @param {Object} stats - User statistics (can be null/undefined)
 * @returns {Array} Milestones with progress data
 */
export function calculateMilestoneProgress(stats) {
  // Handle null/undefined stats gracefully
  const safeStats = stats || {};
  const {
    totalCases = 0,
    totalAppreciations = 0,
    questionsAnswered = 0,
    partnerQuestionsAnswered = 0,
    memoriesCount = 0,
    challengesCompleted = 0,
    calendarEventsCount = 0,
  } = safeStats;

  const totalQuestions = (questionsAnswered || 0) + (partnerQuestionsAnswered || 0);

  return MILESTONES.map((milestone) => {
    let current = 0;
    const { type, target } = milestone.requirement;

    switch (type) {
      case 'cases':
        current = totalCases || 0;
        break;
      case 'appreciations':
        current = totalAppreciations || 0;
        break;
      case 'questions':
        current = totalQuestions;
        break;
      case 'memories':
        current = memoriesCount || 0;
        break;
      case 'challenges':
        current = challengesCompleted || 0;
        break;
      case 'calendar_events':
        current = calendarEventsCount || 0;
        break;
      default:
        current = 0;
    }

    // Guard against division by zero and ensure valid numbers
    const safeTarget = target > 0 ? target : 1;
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const progress = Math.min(safeCurrent / safeTarget, 1);
    const isUnlocked = safeCurrent >= safeTarget;

    return {
      ...milestone,
      current: safeCurrent,
      target: safeTarget,
      progress,
      isUnlocked,
    };
  });
}

/**
 * Get total unlocked count
 * @param {Array} milestonesWithProgress
 * @returns {number}
 */
export function getUnlockedCount(milestonesWithProgress) {
  if (!Array.isArray(milestonesWithProgress)) return 0;
  return milestonesWithProgress.filter((m) => m?.isUnlocked).length;
}

/**
 * Get total possible XP from all milestones
 * @returns {number}
 */
export function getTotalPossibleXP() {
  return MILESTONES.reduce((sum, m) => sum + m.xpReward, 0);
}

/**
 * Get earned XP from unlocked milestones
 * @param {Array} milestonesWithProgress
 * @returns {number}
 */
export function getEarnedXP(milestonesWithProgress) {
  if (!Array.isArray(milestonesWithProgress)) return 0;
  return milestonesWithProgress
    .filter((m) => m?.isUnlocked)
    .reduce((sum, m) => sum + (m?.xpReward || 0), 0);
}
