import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Check } from 'lucide-react';
import PropTypes from 'prop-types';
import { useI18n } from '../../i18n';

const OptionsStep = ({
    options,
    selectedValue = null,
    onOptionSelect,
    multiSelect = false,
    allowCustom = false,
    fieldName = ''
}) => {
    const { t } = useI18n();
    const [customInput, setCustomInput] = useState('');

    const isOptionSelected = (optionId) => {
        if (multiSelect) {
            return (selectedValue || []).includes(optionId);
        }
        return selectedValue === optionId;
    };

    const handleCustomInputKeyPress = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            const customId = `custom_${e.target.value.trim().toLowerCase().replace(/\s+/g, '_')}`;
            onOptionSelect(customId);
            setCustomInput('');
        }
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
        >
            <div className={`grid gap-3 ${multiSelect ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {options.map((option, index) => {
                    const optionLabel = option.labelKey ? t(option.labelKey) : option.label;
                    const optionDesc = option.descKey ? t(option.descKey) : option.desc;
                    const selected = isOptionSelected(option.id);

                    return (
                        <Motion.button
                            key={option.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onOptionSelect(option.id)}
                            className={`p-4 rounded-2xl text-left transition-all border ${
                                selected
                                    ? 'border-[#D2BC76] bg-[#FBF6E8] shadow-soft'
                                    : 'border-white/80 bg-white/80 hover:bg-white'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">{option.emoji}</span>
                                <div className="flex-1">
                                    <p className={`font-bold ${selected ? 'text-court-brown' : 'text-neutral-700'}`}>
                                        {optionLabel}
                                    </p>
                                    {optionDesc && (
                                        <p className="text-xs text-neutral-400 mt-0.5">{optionDesc}</p>
                                    )}
                                </div>
                                {selected && (
                                    <Motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br from-[#C9A227] to-[#8B7019]"
                                    >
                                        <Check className="w-3 h-3 text-white" />
                                    </Motion.div>
                                )}
                            </div>
                        </Motion.button>
                    );
                })}
            </div>

            {/* Custom input for multi-select */}
            {allowCustom && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4"
                >
                    <input
                        type="text"
                        placeholder={t('onboarding.customOptionPlaceholder')}
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={handleCustomInputKeyPress}
                        className="w-full px-4 py-3 bg-white/80 border border-dashed border-neutral-200 rounded-xl text-neutral-600 placeholder:text-neutral-400 focus:outline-none focus:border-[#D2BC76] transition-all"
                    />
                </Motion.div>
            )}
        </Motion.div>
    );
};

OptionsStep.propTypes = {
    options: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        emoji: PropTypes.string,
        label: PropTypes.string,
        labelKey: PropTypes.string,
        desc: PropTypes.string,
        descKey: PropTypes.string,
    })).isRequired,
    selectedValue: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.arrayOf(PropTypes.string),
    ]),
    onOptionSelect: PropTypes.func.isRequired,
    multiSelect: PropTypes.bool,
    allowCustom: PropTypes.bool,
    fieldName: PropTypes.string,
};

export default OptionsStep;
