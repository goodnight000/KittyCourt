import React from 'react';
import { motion as Motion } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';

const EVENT_TYPES = [
    { id: 'birthday', labelKey: 'calendar.eventTypes.birthday', emoji: '🎂', color: 'pink' },
    { id: 'anniversary', labelKey: 'calendar.eventTypes.anniversary', emoji: '💕', color: 'red' },
    { id: 'holiday', labelKey: 'calendar.eventTypes.holiday', emoji: '🎉', color: 'amber' },
    { id: 'date_night', labelKey: 'calendar.eventTypes.dateNight', emoji: '🌙', color: 'violet' },
    { id: 'custom', labelKey: 'calendar.eventTypes.custom', emoji: '📅', color: 'blue' },
];

const EVENT_GRADIENTS = {
    birthday: 'from-pink-50/50',
    anniversary: 'from-red-50/50',
    holiday: 'from-amber-50/50',
    date_night: 'from-violet-50/50',
    custom: 'from-blue-50/50',
};

/**
 * EventDetailsModal Component
 * Displays details for one or more events on a selected date
 */
const EventDetailsModal = ({ events, onDelete, onClose, onAddMore, currentUserId, myDisplayName, partnerDisplayName }) => {
    const { t, language } = useI18n();

    // Guard against empty events array
    if (!events?.length) {
        return null;
    }

    // Parse date string as local date to prevent timezone shift
    const dateStr = events[0].date;
    const eventDate = dateStr?.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    const eventCountLabel = events.length === 1
        ? t('calendar.details.eventsOnDayOne')
        : t('calendar.details.eventsOnDayOther', { count: events.length });

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
                className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl max-h-[70vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between sticky top-0 bg-white pb-2">
                    <div>
                        <h3 className="font-bold text-neutral-800 text-lg">
                            {eventDate.toLocaleDateString(language, { month: 'short', day: 'numeric' })}
                        </h3>
                        <p className="text-neutral-500 text-xs">
                            {eventCountLabel}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                <div className="space-y-3">
                    {events.map((event, index) => {
                        const eventType = EVENT_TYPES.find((item) => item.id === event.type) || EVENT_TYPES[4];
                        // Determine who created this event
                        const isCreatedByMe = event.createdBy === currentUserId;
                        const creatorName = isCreatedByMe ? myDisplayName : partnerDisplayName;
                        const canDelete = isCreatedByMe && !event.isDefault && !event.isPersonal;
                        const eventTypeLabel = t(eventType.labelKey);
                        const gradientFrom = EVENT_GRADIENTS[eventType.id] || EVENT_GRADIENTS.custom;

                        return (
                            <Motion.div
                                key={event.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`glass-card p-4 bg-gradient-to-r ${gradientFrom} to-white`}
                            >
                                <div className="flex items-start gap-3">
                                    <Motion.div
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                                        className="text-3xl"
                                    >
                                        {event.emoji}
                                    </Motion.div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-neutral-800">{event.title}</h4>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                                                {eventTypeLabel}
                                            </span>
                                            {event.isSecret ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#1c1c84]/10 text-[#1c1c84]">
                                                    🔒 {t('calendar.visibility.secret')}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
                                                    🤝 {t('calendar.visibility.shared')}
                                                </span>
                                            )}
                                            {event.isRecurring && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-600">
                                                    🔄 {t('calendar.details.yearly')}
                                                </span>
                                            )}
                                            {event.isPersonal && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-600">
                                                    💕 {t('calendar.details.personal')}
                                                </span>
                                            )}
                                        </div>
                                        {event.notes && (
                                            <p className="text-neutral-500 text-xs mt-2">{event.notes}</p>
                                        )}
                                        <p className="text-neutral-400 text-xs mt-2">
                                            {event.isDefault
                                                ? t('calendar.details.defaultHoliday')
                                                : event.isPersonal
                                                    ? t('calendar.details.fromProfile')
                                                    : t('calendar.details.addedBy', { name: creatorName || t('common.unknown') })}
                                        </p>
                                    </div>
                                    {canDelete && (
                                        <button
                                            onClick={() => onDelete(event.id)}
                                            className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center text-red-400 hover:bg-red-100 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </Motion.div>
                        );
                    })}
                </div>

                {/* Add More Events Button */}
                <button
                    onClick={onAddMore}
                    className="w-full py-3 bg-gradient-to-r from-court-cream to-court-tan text-court-brown rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    {t('calendar.details.addAnother')}
                </button>
            </Motion.div>
        </Motion.div>
    );
};

export default EventDetailsModal;
