import { useEffect, useState, useCallback } from 'react';
import useCourtStore, { COURT_PHASES } from '../store/useCourtStore';
import useAuthStore from '../store/useAuthStore';

/**
 * Court Timeout Hook
 * 
 * Manages the 60-minute timers for:
 * 1. Evidence submission deadline - if both users don't submit in 60 min, case is tossed
 * 2. Verdict auto-accept - if users don't accept/reject in 60 min, auto-accept triggers
 * 
 * Returns remaining time and provides countdown display.
 */

export default function useCourtTimeout() {
    const {
        phase,
        submissionDeadline,
        verdictDeadline,
        courtSession,
        activeCase,
        reset,
        acceptVerdict
    } = useCourtStore();

    const { user } = useAuthStore();

    // Time remaining state (updated every second)
    const [submissionTimeRemaining, setSubmissionTimeRemaining] = useState(null);
    const [verdictTimeRemaining, setVerdictTimeRemaining] = useState(null);

    // Handle submission timeout
    const handleSubmissionTimeout = useCallback(async () => {
        console.log('[CourtTimeout] Submission deadline reached - tossing case');

        // Update session status on server if we have one
        if (courtSession?.id) {
            try {
                const api = await import('../services/api').then(m => m.default);
                await api.post(`/court-sessions/${courtSession.id}/close`, {
                    reason: 'timeout'
                });
            } catch (error) {
                console.error('[CourtTimeout] Failed to close timed-out session:', error);
            }
        }

        // Transition to timed out state
        useCourtStore.setState({ phase: COURT_PHASES.TIMED_OUT });

        // Reset after showing message
        setTimeout(() => reset(), 3000);
    }, [courtSession?.id, reset]);

    // Handle verdict auto-accept
    const handleVerdictAutoAccept = useCallback(async () => {
        console.log('[CourtTimeout] Verdict auto-accept triggered');

        try {
            await acceptVerdict();
        } catch (error) {
            console.error('[CourtTimeout] Auto-accept failed:', error);
        }
    }, [acceptVerdict]);

    // Submission deadline timer
    useEffect(() => {
        if (!submissionDeadline || phase !== COURT_PHASES.SUBMITTING) {
            setSubmissionTimeRemaining(null);
            return;
        }

        const updateTime = () => {
            const remaining = submissionDeadline - Date.now();

            if (remaining <= 0) {
                setSubmissionTimeRemaining(0);
                handleSubmissionTimeout();
            } else {
                setSubmissionTimeRemaining(remaining);
            }
        };

        // Initial update
        updateTime();

        // Update every second
        const interval = setInterval(updateTime, 1000);

        return () => clearInterval(interval);
    }, [submissionDeadline, phase, handleSubmissionTimeout]);

    // Verdict deadline timer (only for the user who hasn't accepted yet)
    useEffect(() => {
        if (!verdictDeadline || phase !== COURT_PHASES.VERDICT) {
            setVerdictTimeRemaining(null);
            return;
        }

        // Check if current user already accepted
        const isCreator = courtSession?.created_by === user?.id;
        const hasAccepted = isCreator
            ? activeCase?.userAAccepted
            : activeCase?.userBAccepted;

        if (hasAccepted) {
            setVerdictTimeRemaining(null);
            return;
        }

        const updateTime = () => {
            const remaining = verdictDeadline - Date.now();

            if (remaining <= 0) {
                setVerdictTimeRemaining(0);
                handleVerdictAutoAccept();
            } else {
                setVerdictTimeRemaining(remaining);
            }
        };

        // Initial update
        updateTime();

        // Update every second
        const interval = setInterval(updateTime, 1000);

        return () => clearInterval(interval);
    }, [verdictDeadline, phase, user?.id, courtSession?.created_by, activeCase, handleVerdictAutoAccept]);

    // Format time for display (MM:SS or HH:MM:SS)
    const formatTime = useCallback((ms) => {
        if (ms === null || ms <= 0) return '00:00';

        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, []);

    // Get urgency level for styling
    const getUrgency = useCallback((ms) => {
        if (ms === null) return 'none';
        if (ms <= 5 * 60 * 1000) return 'critical'; // Last 5 min
        if (ms <= 15 * 60 * 1000) return 'warning'; // Last 15 min
        return 'normal';
    }, []);

    return {
        // Submission timer
        submissionTimeRemaining,
        submissionTimeFormatted: formatTime(submissionTimeRemaining),
        submissionUrgency: getUrgency(submissionTimeRemaining),
        hasSubmissionDeadline: submissionDeadline !== null && phase === COURT_PHASES.SUBMITTING,

        // Verdict timer
        verdictTimeRemaining,
        verdictTimeFormatted: formatTime(verdictTimeRemaining),
        verdictUrgency: getUrgency(verdictTimeRemaining),
        hasVerdictDeadline: verdictDeadline !== null && phase === COURT_PHASES.VERDICT,

        // Phase info
        isTimedOut: phase === COURT_PHASES.TIMED_OUT
    };
}
