import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { X, Plus, Check, AlertTriangle, Lock, Handshake } from 'lucide-react';
import { useI18n } from '../../i18n';
import { validateDate } from '../../utils/helpers';
import EmojiIcon from '../shared/EmojiIcon';
import StandardButton from '../shared/StandardButton';
import ButtonLoader from '../shared/ButtonLoader';

const EVENT_TYPES = [
    { id: 'birthday', labelKey: 'calendar.eventTypes.birthday', emoji: '🎂', color: 'pink' },
    { id: 'anniversary', labelKey: 'calendar.eventTypes.anniversary', emoji: '💕', color: 'red' },
    { id: 'holiday', labelKey: 'calendar.eventTypes.holiday', emoji: '🎉', color: 'amber' },
    { id: 'date_night', labelKey: 'calendar.eventTypes.dateNight', emoji: '🌙', color: 'violet' },
    { id: 'milestone', labelKey: 'calendar.eventTypes.milestone', emoji: '🏆', color: 'emerald' },
    { id: 'custom', labelKey: 'calendar.eventTypes.custom', emoji: '📅', color: 'blue' },
];

const EMOJI_OPTIONS = ['🎂', '💕', '🎉', '🌙', '📅', '🎁', '💐', '🍰', '🎬', '🍽️', '📸', '🌸'];

const MAX_TITLE_LENGTH = 100;

/**
 * EventForm Component
 * Modal form for creating/editing calendar events
 */
const EventForm = ({ selectedDate, onAdd, onClose, isSubmitting = false }) => {
    const { t } = useI18n();
    const [title, setTitle] = useState('');
    const [type, setType] = useState('custom');
    const [emoji, setEmoji] = useState('📅');
    const [isSecret, setIsSecret] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [notes, setNotes] = useState('');
    const [dateError, setDateError] = useState(null);
    const accentStyles = isSecret
        ? {
            text: 'text-[#1c1c84]',
            bg: 'bg-[#1c1c84]/10',
            ring: 'ring-[#1c1c84]/30',
            border: 'border-[#1c1c84]/20',
            focusRing: 'focus:ring-[#1c1c84]/20',
            focusBorder: 'focus:border-[#1c1c84]/30'
        }
        : {
            text: 'text-pink-700',
            bg: 'bg-pink-50',
            ring: 'ring-pink-300',
            border: 'border-pink-200/60',
            focusRing: 'focus:ring-pink-200',
            focusBorder: 'focus:border-pink-300'
        };

    // Handle date initialization - use local date to avoid timezone shift
    const getInitialDate = () => {
        if (selectedDate) {
            // If selectedDate is already a Date object
            if (selectedDate instanceof Date && !isNaN(selectedDate)) {
                // Use local date format to avoid timezone issues
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            // If it's a string, return it as-is if it's in YYYY-MM-DD format
            if (typeof selectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
                return selectedDate;
            }
            // If it's a different string format, try to parse it
            if (typeof selectedDate === 'string') {
                const parsed = new Date(selectedDate);
                if (!isNaN(parsed)) {
                    const year = parsed.getFullYear();
                    const month = String(parsed.getMonth() + 1).padStart(2, '0');
                    const day = String(parsed.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }
        }
        // Default to today using local date
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState(getInitialDate);

    const translateValidationError = (validation) => {
        if (!validation?.error) return null;
        if (validation.errorCode) return t(`validation.${validation.errorCode}`, validation.meta);
        return validation.error;
    };

    const handleDateChange = (value) => {
        setDate(value);
        if (value) {
            // For calendar events, allow future dates
            const validation = validateDate(value, { allowFuture: true });
            setDateError(validation.isValid ? null : translateValidationError(validation));
        } else {
            setDateError(null);
        }
    };

    const handleSubmit = () => {
        if (isSubmitting) return;
        if (!title.trim()) return;
        if (dateError) return; // Don't submit if date is invalid
        const trimmedNotes = notes.trim();
        const payload = {
            title: title.trim(),
            date,
            type,
            emoji,
            isRecurring,
            isSecret
        };
        if (trimmedNotes) {
            payload.notes = trimmedNotes;
        }
        onAdd(payload);
    };

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
            onClick={onClose}
        >
            <Motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl max-h-[75vh] overflow-y-auto overflow-x-hidden"
            >
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-neutral-800 text-lg">{t('calendar.addEvent.title')}</h3>
                    <button onClick={onClose} className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                {/* Sharing */}
                <div className="space-y-2">
                    <p className="text-xs font-bold text-neutral-500">{t('calendar.addEvent.visibilityLabel')}</p>
                    <div className="rounded-2xl bg-neutral-50 border-2 border-neutral-100 p-1 flex gap-1">
                        <button
                            type="button"
                            onClick={() => setIsSecret(false)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${!isSecret
                                ? 'bg-white shadow-sm text-pink-700 border border-pink-100'
                                : 'text-neutral-500 hover:bg-white/60'
                                }`}
                        >
                            <Handshake className="w-4 h-4" />
                            {t('calendar.visibility.shared')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsSecret(true)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${isSecret
                                ? 'bg-white shadow-sm text-[#1c1c84] border border-[#1c1c84]/15'
                                : 'text-neutral-500 hover:bg-white/60'
                                }`}
                        >
                            <Lock className="w-4 h-4" />
                            {t('calendar.visibility.secret')}
                        </button>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                        {isSecret ? t('calendar.addEvent.secretHint') : t('calendar.addEvent.sharedHint')}
                    </p>
                </div>

                {/* Event Type */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">{t('calendar.addEvent.typeLabel')}</label>
                    <div className="flex flex-wrap gap-2">
                        {EVENT_TYPES.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => {
                                    setType(option.id);
                                    setEmoji(option.emoji);
                                }}
                                className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all ${type === option.id
                                    ? `${accentStyles.bg} ring-2 ${accentStyles.ring} ${accentStyles.text}`
                                    : 'bg-neutral-50 text-neutral-600'
                                    }`}
                            >
                                <EmojiIcon emoji={option.emoji} className={`w-4 h-4 ${accentStyles.text}`} />
                                {t(option.labelKey)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Title */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('calendar.addEvent.titleLabel')}</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                            const newValue = e.target.value;
                            if (newValue.length <= MAX_TITLE_LENGTH) {
                                setTitle(newValue);
                            }
                        }}
                        placeholder={t('calendar.addEvent.titlePlaceholder')}
                        maxLength={MAX_TITLE_LENGTH}
                        className={`w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 ${accentStyles.focusRing} ${accentStyles.focusBorder} focus:outline-none text-sm`}
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                        {title.length}/{MAX_TITLE_LENGTH}
                    </p>
                </div>

                {/* Date */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('calendar.addEvent.dateLabel')}</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className={`block w-full min-w-0 max-w-full bg-neutral-50 border-2 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:outline-none text-sm ${dateError
                            ? 'border-red-300 focus:ring-red-200 focus:border-red-300'
                            : `border-neutral-100 ${accentStyles.focusRing} ${accentStyles.focusBorder}`
                            }`}
                    />
                    {dateError && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {dateError}
                        </p>
                    )}
                </div>

                {/* Emoji */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">{t('calendar.addEvent.emojiLabel')}</label>
                    <div className="flex flex-wrap gap-2">
                        {EMOJI_OPTIONS.map((e) => (
                            <button
                                key={e}
                                onClick={() => setEmoji(e)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${emoji === e ? `${accentStyles.bg} ring-2 ${accentStyles.ring}` : 'bg-neutral-50'
                                    }`}
                            >
                                <EmojiIcon emoji={e} className={`w-5 h-5 ${accentStyles.text}`} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recurring */}
                <button
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${isRecurring ? 'bg-pink-50 ring-2 ring-pink-300' : 'bg-neutral-50'
                        }`}
                >
                    <span className="text-sm font-medium text-neutral-700">{t('calendar.addEvent.repeatYearly')}</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isRecurring ? 'bg-pink-400' : 'bg-neutral-200'
                        }`}>
                        {isRecurring && <Check className="w-3 h-3 text-white" />}
                    </div>
                </button>

                {/* Notes */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('calendar.addEvent.notesLabel')}</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('calendar.addEvent.notesPlaceholder')}
                        rows={2}
                        className={`w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 ${accentStyles.focusRing} ${accentStyles.focusBorder} focus:outline-none text-sm resize-none`}
                    />
                </div>

                <StandardButton
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!title.trim() || isSubmitting}
                    className="w-full py-3"
                >
                    {isSubmitting ? (
                        <ButtonLoader size="sm" tone={isSecret ? 'indigo' : 'rose'} />
                    ) : (
                        <>
                            <Plus className="w-4 h-4" />
                            {t('calendar.addEvent.submit')}
                        </>
                    )}
                </StandardButton>
            </Motion.div>
        </Motion.div>
    );
};

export default EventForm;
