import React from 'react';

/**
 * Modal wrapper component for consistent styling
 */
export const Modal = ({ isOpen, onClose, title, subtitle, children, accentColor = 'orange' }) => {
    if (!isOpen) return null;

    const accentClasses = {
        orange: 'from-orange-600 via-orange-400 to-orange-600',
        blue: 'from-blue-600 via-blue-400 to-blue-600',
        emerald: 'from-emerald-600 via-emerald-400 to-emerald-600',
        purple: 'from-purple-600 via-purple-400 to-purple-600',
    };

    return (
        <div
            className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && onClose?.()}
        >
            <div className="bg-[#0f172a] rounded-3xl border border-slate-700/30 p-8 max-w-md w-full shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative ring-1 ring-white/5">
                <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${accentClasses[accentColor]}`}></div>

                {title && (
                    <h2 className="text-2xl font-bold text-white mb-2 font-display">{title}</h2>
                )}
                {subtitle && (
                    <p className="text-slate-400 mb-6">{subtitle}</p>
                )}

                {children}
            </div>
        </div>
    );
};

/**
 * Form input component for consistent styling
 */
export const FormInput = ({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    className = ''
}) => (
    <div className={className}>
        {label && (
            <label className="block text-slate-400 text-sm font-medium mb-2">
                {label}
                {required && <span className="text-red-400 ml-1">*</span>}
            </label>
        )}
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder-slate-600"
        />
    </div>
);

/**
 * Form textarea component
 */
export const FormTextarea = ({
    label,
    value,
    onChange,
    placeholder,
    rows = 3,
    className = ''
}) => (
    <div className={className}>
        {label && (
            <label className="block text-slate-400 text-sm font-medium mb-2">{label}</label>
        )}
        <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder-slate-600 resize-none"
        />
    </div>
);

/**
 * Form select component
 */
export const FormSelect = ({
    label,
    value,
    onChange,
    options,
    className = ''
}) => (
    <div className={className}>
        {label && (
            <label className="block text-slate-400 text-sm font-medium mb-2">{label}</label>
        )}
        <select
            value={value}
            onChange={onChange}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
        >
            {options.map((option, i) => (
                <option key={i} value={option} className="bg-slate-900">
                    {option}
                </option>
            ))}
        </select>
    </div>
);

/**
 * Modal action buttons
 */
export const ModalActions = ({
    onCancel,
    onSubmit,
    cancelText = 'Cancel',
    submitText = 'Submit',
    submitColor = 'orange'
}) => {
    const colorClasses = {
        orange: 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/20',
        blue: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20',
        emerald: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20',
    };

    return (
        <div className="flex gap-3 mt-8">
            <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors"
            >
                {cancelText}
            </button>
            <button
                type="button"
                onClick={onSubmit}
                className={`flex-1 px-4 py-3 rounded-xl text-white font-bold transition-colors shadow-lg ${colorClasses[submitColor]}`}
            >
                {submitText}
            </button>
        </div>
    );
};

export default {
    Modal,
    FormInput,
    FormTextarea,
    FormSelect,
    ModalActions,
};
