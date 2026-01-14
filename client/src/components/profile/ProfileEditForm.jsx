import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Check, User, AlertTriangle } from 'lucide-react';
import { validateBirthdayDate } from '../../utils/helpers';
import { PRESET_AVATARS } from '../../services/avatarService';
import { useI18n } from '../../i18n';
import { DEFAULT_LANGUAGE } from '../../i18n/languageConfig';

const buildFormState = (data) => ({
    nickname: data?.nickname || '',
    birthday: data?.birthday || '',
    loveLanguage: data?.loveLanguage || '',
    avatarUrl: data?.avatarUrl || null,
    anniversaryDate: data?.anniversaryDate || '',
    preferredLanguage: data?.preferredLanguage || DEFAULT_LANGUAGE,
});

const ProfileEditForm = ({ profileData, loveLanguages, onSave, onClose }) => {
    const { t, supportedLanguages } = useI18n();
    const [formData, setFormData] = useState(() => buildFormState(profileData));
    const [birthdayError, setBirthdayError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const translateValidationError = (validation) => {
        if (!validation?.error) return null;
        if (validation.errorCode) {
            return t(`validation.${validation.errorCode}`, validation.meta);
        }
        return validation.error;
    };

    const handleBirthdayChange = (value) => {
        setFormData({ ...formData, birthday: value });
        if (value) {
            const validation = validateBirthdayDate(value);
            setBirthdayError(validation.isValid ? null : translateValidationError(validation));
        } else {
            setBirthdayError(null);
        }
    };

    const handleImageUpload = async (file) => {
        if (!file) return;

        // Validate file type (MIME type check)
        // Note: File content validation is handled by Supabase Storage backend
        if (!file.type.startsWith('image/')) {
            alert(t('errors.IMAGE_INVALID'));
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert(t('errors.IMAGE_TOO_LARGE'));
            return;
        }

        setUploading(true);
        try {
            // Convert to base64 for preview (compression happens on save)
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, avatarUrl: reader.result });
                setUploading(false);
            };
            reader.onerror = () => {
                alert(t('errors.IMAGE_READ_FAILED'));
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('Upload error:', err);
            setUploading(false);
        }
    };

    const handleCameraCapture = () => {
        // Create a hidden file input for camera
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'user'; // Front camera
        input.onchange = (e) => handleImageUpload(e.target.files[0]);
        input.click();
    };

    const handleSave = () => {
        // Don't save if there are validation errors
        if (birthdayError) return;
        onSave(formData);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/95 rounded-[32px] w-full max-w-md p-5 space-y-4 shadow-soft-lg border border-white/80 max-h-[70vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-neutral-800 text-lg">{t('profilePage.edit.title')}</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 bg-white/80 border border-neutral-200/70 rounded-full flex items-center justify-center"
                    >
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                {/* Profile Picture */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">{t('profilePage.edit.photoLabel')}</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-24 rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center overflow-hidden shadow-soft">
                            {formData.avatarUrl ? (
                                <img
                                    src={formData.avatarUrl}
                                    alt={t('profilePage.edit.profileAlt')}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                                    <User className="w-10 h-10" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-2">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCameraCapture}
                                disabled={uploading}
                                className="w-full py-2.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-amber-200"
                            >
                                {t('profilePage.edit.takePhoto')}
                            </motion.button>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full py-2.5 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-rose-200"
                            >
                                {uploading ? t('profilePage.edit.uploading') : t('profilePage.edit.uploadPhoto')}
                            </motion.button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e.target.files[0])}
                                className="hidden"
                            />
                        </div>
                    </div>
                </div>

                {/* Avatar Selection */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">{t('profilePage.edit.chooseAvatar')}</label>
                    <div className="grid grid-cols-4 gap-2">
                        {PRESET_AVATARS.map((avatar) => (
                            <button
                                key={avatar.id}
                                onClick={() => setFormData({ ...formData, avatarUrl: avatar.path })}
                                className={`p-1 rounded-xl transition-all ${formData.avatarUrl === avatar.path
                                    ? 'bg-amber-100 ring-2 ring-amber-400'
                                    : 'bg-neutral-50 hover:bg-neutral-100'
                                    }`}
                            >
                                <img
                                    src={avatar.path}
                                    alt={t('profilePage.edit.avatarAlt', { name: avatar.labelKey ? t(avatar.labelKey) : avatar.label })}
                                    className="w-full h-16 object-contain"
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Nickname */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('profilePage.edit.nicknameLabel')}</label>
                    <input
                        type="text"
                        value={formData.nickname}
                        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                        placeholder={t('profilePage.edit.nicknamePlaceholder')}
                        className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-amber-200 focus:border-amber-300 focus:outline-none text-sm"
                    />
                </div>

                {/* Birthday */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('profilePage.edit.birthdayLabel')}</label>
                    <input
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => handleBirthdayChange(e.target.value)}
                        className={`w-full bg-neutral-50 border-2 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:outline-none text-sm ${birthdayError
                            ? 'border-red-300 focus:ring-red-200 focus:border-red-300'
                            : 'border-neutral-100 focus:ring-amber-200 focus:border-amber-300'
                            }`}
                    />
                    {birthdayError && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {birthdayError}
                        </p>
                    )}
                </div>

                {/* Love Language */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">{t('profile.loveLanguageLabel')}</label>
                    <div className="space-y-2">
                        {loveLanguages.map((lang) => (
                            <button
                                key={lang.id}
                                onClick={() => setFormData({ ...formData, loveLanguage: lang.id })}
                                className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-all ${formData.loveLanguage === lang.id
                                    ? 'bg-amber-50 ring-2 ring-amber-300'
                                    : 'bg-neutral-50 hover:bg-neutral-100'
                                    }`}
                            >
                                <span className="text-xl">{lang.emoji}</span>
                                <span className="text-sm font-medium text-neutral-700">{lang.label}</span>
                                {formData.loveLanguage === lang.id && (
                                    <Check className="w-4 h-4 text-amber-500 ml-auto" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preferred Language */}
                <div>
                    <label htmlFor="preferred-language" className="text-xs font-bold text-neutral-500 mb-2 block">
                        {t('profile.languageLabel')}
                    </label>
                    <select
                        id="preferred-language"
                        value={formData.preferredLanguage || DEFAULT_LANGUAGE}
                        onChange={(e) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                        className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-amber-200 focus:border-amber-300 focus:outline-none text-sm"
                    >
                        {(supportedLanguages || []).map((languageOption) => {
                            const label = languageOption.labelKey
                                ? t(languageOption.labelKey)
                                : (languageOption.label || languageOption.nativeLabel || languageOption.code);
                            return (
                                <option key={languageOption.code} value={languageOption.code}>
                                    {label}
                                </option>
                            );
                        })}
                    </select>
                </div>

                <button
                    onClick={handleSave}
                    disabled={birthdayError || uploading}
                    className={`w-full flex items-center justify-center gap-2 ${birthdayError || uploading
                        ? 'btn-secondary opacity-50 cursor-not-allowed'
                        : 'btn-primary'
                        }`}
                >
                    <Check className="w-4 h-4" />
                    {t('profile.saveProfile')}
                </button>
            </motion.div>
        </motion.div>
    );
};

export default ProfileEditForm;
