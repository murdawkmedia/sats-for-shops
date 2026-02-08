import React, { createContext, useContext, useState } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'info', duration = 3000) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, duration);
    };

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div
                className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
                role="status"
                aria-live="polite"
                aria-label="Notifications"
            >
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role="alert"
                        aria-live="assertive"
                        onClick={() => removeToast(toast.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') removeToast(toast.id);
                        }}
                        tabIndex={0}
                        className={`
                            flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl cursor-pointer
                            transition-all duration-300 animate-slide-in-right
                            ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : ''}
                            ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-200' : ''}
                            ${toast.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-blue-200' : ''}
                            hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none
                        `}
                    >
                        <span className="text-xl" aria-hidden="true">
                            {toast.type === 'success' && '✅'}
                            {toast.type === 'error' && '❌'}
                            {toast.type === 'info' && 'ℹ️'}
                        </span>
                        <span className="text-sm font-medium">{toast.message}</span>
                        <span className="sr-only">Press Enter or Escape to dismiss</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    const { addToast } = context;

    return {
        success: (msg, duration) => addToast(msg, 'success', duration),
        error: (msg, duration) => addToast(msg, 'error', duration),
        info: (msg, duration) => addToast(msg, 'info', duration),
    };
};
