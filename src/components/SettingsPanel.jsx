import React, { useState, useCallback } from 'react';
import { useNostrAuth } from '../contexts/NostrAuthContext';
import { truncateNpub } from '../services/nostr';

/**
 * Settings Panel
 * Shows Profile, Relay Management, and Account sections.
 */
export default function SettingsPanel() {
    const {
        user,
        logout,
        setDisplayName,
        relays,
        relaysLoading,
        addRelay,
        removeRelay,
        resetRelays,
        refetchRelays,
        refreshRelayStatus,
    } = useNostrAuth();

    const [newRelayUrl, setNewRelayUrl] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(user?.displayName || '');
    const [relayError, setRelayError] = useState('');
    const [copied, setCopied] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);

    const handleCopyNpub = useCallback(async () => {
        if (!user?.npub) return;
        try {
            await navigator.clipboard.writeText(user.npub);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const el = document.createElement('textarea');
            el.value = user.npub;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [user?.npub]);

    const handleSaveName = useCallback(() => {
        if (nameInput.trim()) {
            setDisplayName(nameInput.trim());
        }
        setEditingName(false);
    }, [nameInput, setDisplayName]);

    const handleAddRelay = useCallback(async () => {
        if (!newRelayUrl.trim()) return;
        setRelayError('');
        try {
            await addRelay(newRelayUrl.trim());
            setNewRelayUrl('');
        } catch (err) {
            setRelayError(err.message);
        }
    }, [newRelayUrl, addRelay]);

    const handleRemoveRelay = useCallback(async (url) => {
        setRelayError('');
        try {
            await removeRelay(url);
        } catch (err) {
            setRelayError(err.message);
        }
    }, [removeRelay]);

    const handleRefetchRelays = useCallback(async () => {
        setRelayError('');
        await refetchRelays();
    }, [refetchRelays]);

    const handleClearData = useCallback(() => {
        localStorage.clear();
        logout();
        window.location.reload();
    }, [logout]);

    if (!user) {
        return (
            <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-slate-800 border-dashed">
                <div className="text-6xl mb-4 opacity-50">⚙️</div>
                <h3 className="text-white font-bold text-xl mb-2">Login Required</h3>
                <p className="text-slate-400 max-w-sm mx-auto">Log in with Nostr to access settings.</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">

            {/* ── Profile ── */}
            <section className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-700/30 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600/20 to-orange-500/20 px-6 py-4 border-b border-slate-700/30">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">👤 Profile</h2>
                </div>
                <div className="p-6 space-y-5">
                    {/* npub */}
                    <div>
                        <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Your npub</label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-black/30 border border-slate-700/50 rounded-xl px-4 py-3 text-purple-300 font-mono text-sm break-all">
                                {user.npub}
                            </code>
                            <button
                                onClick={handleCopyNpub}
                                className="px-4 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-white text-sm font-medium transition-all flex-shrink-0"
                            >
                                {copied ? '✅ Copied' : '📋 Copy'}
                            </button>
                        </div>
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Display Name</label>
                        {editingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                    autoFocus
                                    className="flex-1 bg-black/30 border border-orange-500/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    placeholder="Enter display name"
                                />
                                <button onClick={handleSaveName} className="px-4 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl text-white text-sm font-bold transition-all">Save</button>
                                <button onClick={() => setEditingName(false)} className="px-4 py-3 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-white text-sm transition-all">Cancel</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="flex-1 bg-black/30 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm">{user.displayName || truncateNpub(user.npub)}</span>
                                <button onClick={() => { setNameInput(user.displayName || ''); setEditingName(true); }} className="px-4 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-white text-sm font-medium transition-all">✏️ Edit</button>
                            </div>
                        )}
                    </div>

                    {/* Login Method */}
                    <div>
                        <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Login Method</label>
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${user.isExtension ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'}`}>
                                {user.isExtension ? '🔌 Browser Extension' : '🔑 Private Key'}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Relays ── */}
            <section className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-700/30 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600/20 to-cyan-500/20 px-6 py-4 border-b border-slate-700/30 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">📡 Relays</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { refreshRelayStatus(); }}
                            className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-300 text-xs font-medium transition-all"
                            title="Refresh status"
                        >🔄 Refresh</button>
                        <button
                            onClick={handleRefetchRelays}
                            disabled={relaysLoading}
                            className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 rounded-lg text-blue-300 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Fetch your relay list from NIP-65"
                        >{relaysLoading ? '⏳ Fetching...' : '📥 Fetch from NIP-65'}</button>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    {/* Relay List */}
                    {relays.length === 0 ? (
                        <p className="text-slate-500 text-sm italic text-center py-4">No relays connected. Add one below.</p>
                    ) : (
                        <div className="space-y-2">
                            {relays.map((relay) => (
                                <div key={relay.url} className="flex items-center gap-3 bg-black/20 border border-slate-700/50 rounded-xl px-4 py-3 group hover:border-slate-600/50 transition-all">
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${relay.connected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.3)]'}`}
                                        title={relay.connected ? 'Connected' : 'Disconnected'}></div>
                                    <code className="flex-1 text-slate-300 font-mono text-sm truncate">{relay.url}</code>
                                    <span className={`text-xs font-bold uppercase tracking-wider ${relay.connected ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {relay.connected ? 'Online' : 'Offline'}
                                    </span>
                                    <button
                                        onClick={() => handleRemoveRelay(relay.url)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-all"
                                        title="Remove relay"
                                    >✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {relayError && (
                        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{relayError}</p>
                    )}

                    {/* Add Relay */}
                    <div className="flex items-center gap-2 pt-2">
                        <input
                            value={newRelayUrl}
                            onChange={(e) => setNewRelayUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddRelay()}
                            placeholder="wss://relay.example.com"
                            className="flex-1 bg-black/30 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 font-mono"
                        />
                        <button onClick={handleAddRelay} className="px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-bold transition-all shadow-lg shadow-blue-600/20">+ Add</button>
                    </div>

                    {/* Reset */}
                    <button
                        onClick={resetRelays}
                        className="w-full text-center text-slate-500 hover:text-slate-300 text-xs font-medium py-2 transition-colors"
                    >Reset to default relays</button>
                </div>
            </section>

            {/* ── Account ── */}
            <section className="bg-slate-800/40 backdrop-blur-md rounded-2xl border border-slate-700/30 overflow-hidden">
                <div className="bg-gradient-to-r from-red-600/20 to-rose-500/20 px-6 py-4 border-b border-slate-700/30">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">🔐 Account</h2>
                </div>
                <div className="p-6 space-y-4">
                    <button
                        onClick={logout}
                        className="w-full px-4 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-white font-medium transition-all"
                    >Logout</button>

                    {!confirmClear ? (
                        <button
                            onClick={() => setConfirmClear(true)}
                            className="w-full px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-500/20 rounded-xl text-red-400 font-medium transition-all text-sm"
                        >Clear All Local Data</button>
                    ) : (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                            <p className="text-red-300 text-sm mb-3">This will clear all bounties, meetups, and settings. This cannot be undone.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmClear(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium">Cancel</button>
                                <button onClick={handleClearData} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-bold">Yes, Clear Everything</button>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
