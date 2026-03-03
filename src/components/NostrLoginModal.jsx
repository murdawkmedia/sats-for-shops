import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNostrAuth } from '../contexts/NostrAuthContext';

/**
 * Nostr Login Modal — allows login via extension, nsec, or new identity generation.
 * Accessible: focus trap, Escape to close, ARIA dialog role, labelled regions.
 */
const NostrLoginModal = ({ isOpen, onClose, onSuccess }) => {
    const { hasExtension, loginWithExtension, loginWithKey, generateNewIdentity } = useNostrAuth();
    const [mode, setMode] = useState('main'); // 'main' | 'nsec' | 'generated'
    const [nsecInput, setNsecInput] = useState('');
    const [error, setError] = useState('');
    const [generatedNsec, setGeneratedNsec] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);

    const modalRef = useRef(null);
    const previousFocusRef = useRef(null);

    // ── Focus trap & Escape key ──
    useEffect(() => {
        if (!isOpen) return;

        // Save current focus to restore later
        previousFocusRef.current = document.activeElement;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            // Trap focus within modal
            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last?.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first?.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Focus the modal container on open
        requestAnimationFrame(() => {
            modalRef.current?.focus();
        });

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Restore focus on close
            previousFocusRef.current?.focus();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleExtensionLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const session = await loginWithExtension();
            onSuccess?.(session);
        } catch (err) {
            setError(err.message || 'Failed to connect to extension');
        } finally {
            setLoading(false);
        }
    };

    const handleNsecLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const session = await loginWithKey(nsecInput.trim());
            onSuccess?.(session);
        } catch (err) {
            setError(err.message || 'Invalid private key');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateNew = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await generateNewIdentity();
            setGeneratedNsec(result.nsec);
            setMode('generated');
        } catch (err) {
            setError(err.message || 'Failed to generate identity');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyNsec = () => {
        navigator.clipboard.writeText(generatedNsec).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleContinue = () => {
        onSuccess?.();
    };

    return (
        <div
            className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nostr-login-title"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                className="bg-[#0f172a] rounded-3xl border border-slate-700/30 p-8 max-w-md w-full shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative ring-1 ring-white/5 animate-scale-in focus:outline-none"
            >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-600 via-orange-500 to-yellow-500"></div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    aria-label="Close login dialog"
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800"
                >
                    ✕
                </button>

                {mode === 'main' && (
                    <>
                        <div className="text-center mb-8">
                            <div className="text-6xl mb-4" aria-hidden="true">⚡</div>
                            <h2 id="nostr-login-title" className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400 mb-2">
                                Login with Nostr
                            </h2>
                            <p className="text-slate-400 text-sm">
                                Your identity, your keys. No emails, no passwords.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Extension Login (primary if available) */}
                            {hasExtension && (
                                <button
                                    onClick={handleExtensionLogin}
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    <span className="text-xl" aria-hidden="true">🔌</span>
                                    {loading ? 'Connecting...' : 'Login with Extension'}
                                </button>
                            )}

                            {/* nsec login */}
                            <button
                                onClick={() => setMode('nsec')}
                                className="w-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-orange-500/30 text-white font-bold py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-3"
                            >
                                <span className="text-xl" aria-hidden="true">🔑</span>
                                Login with Private Key
                            </button>

                            {/* Generate new identity */}
                            <button
                                onClick={handleGenerateNew}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-slate-950 font-bold py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-orange-500/30 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <span className="text-xl" aria-hidden="true">✨</span>
                                {loading ? 'Generating...' : 'Generate New Identity'}
                            </button>

                            {/* Browse without login */}
                            <button
                                onClick={onClose}
                                className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
                            >
                                Browse as guest →
                            </button>
                        </div>

                        {!hasExtension && (
                            <div className="mt-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    <span className="text-purple-400 font-bold">💡 Pro tip:</span> Install a Nostr browser extension like{' '}
                                    <a href="https://getalby.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">
                                        Alby
                                    </a>{' '}
                                    or{' '}
                                    <a href="https://github.com/nicolgit/nos2x" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">
                                        nos2x
                                    </a>{' '}
                                    for the smoothest login experience.
                                </p>
                            </div>
                        )}

                        {error && (
                            <p role="alert" className="mt-4 text-red-400 text-sm text-center bg-red-900/20 border border-red-500/20 p-3 rounded-lg">{error}</p>
                        )}
                    </>
                )}

                {mode === 'nsec' && (
                    <>
                        <button
                            onClick={() => { setMode('main'); setError(''); }}
                            className="mb-6 text-slate-400 hover:text-orange-400 transition-colors flex items-center gap-2 text-sm"
                        >
                            ← Back
                        </button>

                        <div className="text-center mb-6">
                            <div className="text-4xl mb-3" aria-hidden="true">🔑</div>
                            <h2 id="nostr-login-title" className="text-2xl font-bold text-white mb-2">
                                Login with Private Key
                            </h2>
                            <p className="text-slate-400 text-sm">
                                Enter your nsec or hex private key. It never leaves your browser.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="nsec-input" className="block text-slate-400 text-sm font-medium mb-2">Private Key</label>
                                <input
                                    id="nsec-input"
                                    type="password"
                                    value={nsecInput}
                                    onChange={(e) => setNsecInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleNsecLogin()}
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors font-mono text-sm"
                                    placeholder="nsec1..."
                                    autoFocus
                                    autoComplete="off"
                                    aria-describedby={error ? 'nsec-error' : undefined}
                                />
                            </div>

                            {error && (
                                <p id="nsec-error" role="alert" className="text-red-400 text-sm bg-red-900/20 border border-red-500/20 p-3 rounded-lg">{error}</p>
                            )}

                            <button
                                onClick={handleNsecLogin}
                                disabled={!nsecInput.trim() || loading}
                                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-slate-950 font-bold py-3 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Logging in...' : 'Login'}
                            </button>

                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                <p className="text-amber-200 text-xs leading-relaxed">
                                    <span className="font-bold">⚠️ Security:</span> Your private key is processed locally and never sent to any server.
                                    For maximum security, use a browser extension instead.
                                </p>
                            </div>
                        </div>
                    </>
                )}

                {mode === 'generated' && (
                    <>
                        <div className="text-center mb-6">
                            <div className="text-6xl mb-4 animate-bounce" aria-hidden="true">🎉</div>
                            <h2 id="nostr-login-title" className="text-2xl font-bold text-emerald-400 mb-2">
                                Identity Created!
                            </h2>
                            <p className="text-slate-400 text-sm">
                                Save your private key below. You'll need it to log in again.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-red-400 font-bold text-sm">🔐 YOUR PRIVATE KEY (save this!)</span>
                                </div>
                                <div
                                    className="bg-black/40 rounded-lg p-3 font-mono text-xs text-red-300 break-all select-all"
                                    role="textbox"
                                    aria-readonly="true"
                                    aria-label="Generated private key"
                                >
                                    {generatedNsec}
                                </div>
                                <button
                                    onClick={handleCopyNsec}
                                    className="mt-3 w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 font-medium py-2 rounded-lg transition-colors text-sm"
                                >
                                    {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
                                </button>
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4" role="alert">
                                <p className="text-amber-200 text-xs leading-relaxed">
                                    <span className="font-bold">⚠️ Important:</span> This key is shown <strong>only once</strong>.
                                    If you lose it, you lose access to this identity forever.
                                    Write it down or save it in a password manager.
                                </p>
                            </div>

                            <button
                                onClick={handleContinue}
                                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/30"
                            >
                                I've Saved My Key — Continue ⚡
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default NostrLoginModal;
