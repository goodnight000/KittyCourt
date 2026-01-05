import React from 'react';
import { motion as Motion } from 'framer-motion';
import { User, Calendar, Camera, Upload, AlertTriangle } from 'lucide-react';
import PropTypes from 'prop-types';
import { useI18n } from '../../i18n';
import { PRESET_AVATARS } from '../../services/avatarService';

const ProfileFieldStep = ({
    fieldType,
    value = '',
    onChange,
    error = null,
    onFileSelect = null,
    onError = null
}) => {
    const { t } = useI18n();
    const [avatarError, setAvatarError] = React.useState(null);

    const handleAvatarFile = (file) => {
        if (!file) return;
        setAvatarError(null);

        if (!file.type.startsWith('image/')) {
            const errorMsg = t('onboarding.errors.invalidImage');
            setAvatarError(errorMsg);
            onError?.(errorMsg);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            const errorMsg = t('onboarding.errors.imageTooLarge');
            setAvatarError(errorMsg);
            onError?.(errorMsg);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result !== 'string') {
                const errorMsg = t('onboarding.errors.imageReadFailed');
                setAvatarError(errorMsg);
                onError?.(errorMsg);
                return;
            }
            setAvatarError(null);
            onChange(result);
        };
        reader.onerror = () => {
            const errorMsg = t('onboarding.errors.imageReadFailed');
            setAvatarError(errorMsg);
            onError?.(errorMsg);
        };
        reader.readAsDataURL(file);
    };

    if (fieldType === 'name') {
        return (
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={t('onboarding.name.placeholder')}
                        className="w-full pl-12 pr-4 py-4 bg-white/90 border border-white/80 rounded-2xl text-neutral-700 text-lg placeholder:text-neutral-400 focus:outline-none focus:border-[#D2BC76] focus:ring-2 focus:ring-[#F1E3B6] transition-all shadow-inner-soft"
                        autoFocus
                    />
                </div>
                <p className="text-sm text-neutral-400 text-center">
                    {t('onboarding.name.helper')}
                </p>
            </Motion.div>
        );
    }

    if (fieldType === 'birthday') {
        return (
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                <div className="relative w-full">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                        type="date"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full min-w-0 max-w-full box-border pl-12 pr-4 py-4 bg-white/90 border rounded-2xl text-neutral-700 text-lg focus:outline-none focus:ring-2 transition-all shadow-inner-soft ${
                            error
                                ? 'border-[#D2BC76] focus:border-[#B9911F] focus:ring-[#F1E3B6]'
                                : 'border-white/80 focus:border-[#D2BC76] focus:ring-[#F1E3B6]'
                        }`}
                    />
                </div>
                {error && (
                    <p className="text-sm text-[#6B4F3C] text-center flex items-center justify-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </p>
                )}
                <p className="text-sm text-neutral-400 text-center">
                    {t('onboarding.birthday.helper')}
                </p>
            </Motion.div>
        );
    }

    if (fieldType === 'avatar') {
        return (
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Current selection preview */}
                <div className="flex flex-col items-center">
                    <div className={`w-20 h-24 rounded-2xl overflow-hidden border-4 shadow-soft bg-white transition-all ${
                        value ? 'border-[#D2BC76]' : 'border-neutral-200'
                    }`}>
                        {value ? (
                            <img
                                src={value}
                                alt={t('onboarding.avatar.selectedAlt')}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                                <User className="w-12 h-12" />
                            </div>
                        )}
                    </div>
                    <p className={`text-sm mt-2 ${value ? 'text-neutral-500' : 'text-[#6B4F3C] font-medium'}`}>
                        {value ? t('onboarding.avatar.selectedHint') : t('onboarding.avatar.requiredHint')}
                    </p>
                </div>

                {/* Preset avatars grid */}
                <div>
                    <p className="text-xs text-neutral-400 uppercase tracking-wider mb-3 text-center">
                        {t('onboarding.avatar.presetLabel')}
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                        {PRESET_AVATARS.map((avatar, index) => (
                            <Motion.button
                                key={avatar.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onChange(avatar.path)}
                                className={`aspect-square rounded-2xl overflow-hidden border-3 transition-all ${
                                    value === avatar.path
                                        ? 'border-[#D2BC76] ring-2 ring-[#F1E3B6]/60 shadow-soft'
                                        : 'border-white/80 hover:border-neutral-200'
                                }`}
                            >
                                <img
                                    src={avatar.path}
                                    alt={t('onboarding.avatar.presetAlt', {
                                        name: avatar.labelKey ? t(avatar.labelKey) : avatar.label
                                    })}
                                    className="w-full h-full object-cover"
                                />
                            </Motion.button>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-neutral-200" />
                    <span className="text-neutral-400 text-xs">{t('common.or')}</span>
                    <div className="flex-1 h-px bg-neutral-200" />
                </div>

                {/* Upload options */}
                <div className="flex gap-3">
                    <label className="flex-1 cursor-pointer">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                handleAvatarFile(file);
                            }}
                        />
                        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-white/90 border border-white/80 rounded-xl hover:bg-white transition-all shadow-soft">
                            <Upload className="w-5 h-5 text-neutral-500" />
                            <span className="font-medium text-neutral-700">{t('onboarding.avatar.upload')}</span>
                        </div>
                    </label>

                    <label className="flex-1 cursor-pointer">
                        <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                handleAvatarFile(file);
                            }}
                        />
                        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-white/90 border border-white/80 rounded-xl hover:bg-white transition-all shadow-soft">
                            <Camera className="w-5 h-5 text-neutral-500" />
                            <span className="font-medium text-neutral-700">{t('onboarding.avatar.camera')}</span>
                        </div>
                    </label>
                </div>

                {/* Avatar error message */}
                {avatarError && (
                    <p className="text-sm text-[#6B4F3C] text-center flex items-center justify-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {avatarError}
                    </p>
                )}

                {/* Note about changing later */}
                <p className="text-xs text-neutral-400 text-center">
                    {t('onboarding.avatar.changeLater')}
                </p>
            </Motion.div>
        );
    }

    return null;
};

ProfileFieldStep.propTypes = {
    fieldType: PropTypes.oneOf(['name', 'birthday', 'avatar']).isRequired,
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    error: PropTypes.string,
    onFileSelect: PropTypes.func,
    onError: PropTypes.func,
};

export default ProfileFieldStep;
