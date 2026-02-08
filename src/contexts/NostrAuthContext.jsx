import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    connectNDK,
    disconnectNDK,
    reconnectNDK,
    getNDK,
    createNip07Signer,
    createPrivateKeySigner,
    generateKeypair,
    publicKeyFromPrivate,
    hasNostrExtension,
    saveSession,
    loadSession,
    clearSession,
    clearSavedRelays,
    truncateNpub,
    isAdmin,
    fetchUserRelays,
    getConnectedRelays,
    getActiveRelayUrls,
    getDefaultRelays,
    addRelay as addRelayService,
    removeRelay as removeRelayService,
    saveRelays,
    loadSavedRelays,
} from '../services/nostr';

const NostrAuthContext = createContext(null);

/**
 * Nostr Authentication & Relay Provider
 *
 * Provides user identity and relay management throughout the app.
 * On login, fetches the user's NIP-65 relay list and reconnects NDK.
 */
export function NostrAuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ndkReady, setNdkReady] = useState(false);
    const [relays, setRelays] = useState([]);
    const [relaysLoading, setRelaysLoading] = useState(false);

    // Initialize NDK on mount
    useEffect(() => {
        const init = async () => {
            try {
                await connectNDK();
                setNdkReady(true);
                refreshRelayStatus();
            } catch (err) {
                console.warn('NDK initialization error:', err);
                setNdkReady(true);
            }
        };
        init();
        return () => { disconnectNDK(); };
    }, []);

    // Restore session on mount
    useEffect(() => {
        const session = loadSession();
        if (session) {
            setUser({
                ...session,
                isAdmin: isAdmin(session.publicKey),
            });
        }
        setLoading(false);
    }, []);

    /**
     * Refresh the relay status list from NDK
     */
    const refreshRelayStatus = useCallback(() => {
        const status = getConnectedRelays();
        setRelays(status);
    }, []);

    /**
     * After login, fetch NIP-65 relays and reconnect NDK with them.
     */
    const loadUserRelays = useCallback(async (pubkey) => {
        setRelaysLoading(true);
        try {
            const userRelays = await fetchUserRelays(pubkey);
            if (userRelays.length > 0) {
                // Merge user relays with defaults (user relays first, deduped)
                const userUrls = userRelays.map(r => r.url);
                const defaults = getDefaultRelays();
                const merged = [...new Set([...userUrls, ...defaults])];

                saveRelays(merged);
                await reconnectNDK(merged);
                console.log(`✅ Loaded ${userRelays.length} user relays, ${merged.length} total`);
            }
        } catch (err) {
            console.warn('Failed to load user relays:', err);
        } finally {
            refreshRelayStatus();
            setRelaysLoading(false);
        }
    }, [refreshRelayStatus]);

    /**
     * Login with a NIP-07 browser extension
     */
    const loginWithExtension = useCallback(async () => {
        const ndkInstance = getNDK() || await connectNDK();
        const signer = createNip07Signer();
        ndkInstance.signer = signer;

        const ndkUser = await signer.user();
        const publicKey = ndkUser.pubkey;
        const npub = ndkUser.npub;

        const session = {
            publicKey,
            npub,
            displayName: truncateNpub(npub),
            isExtension: true,
            isAdmin: isAdmin(publicKey),
        };
        saveSession(session);
        setUser(session);

        // Fetch user's relay list in background
        loadUserRelays(publicKey);

        return session;
    }, [loadUserRelays]);

    /**
     * Login with a private key (nsec or hex)
     */
    const loginWithKey = useCallback(async (privateKeyInput) => {
        const result = publicKeyFromPrivate(privateKeyInput);
        if (!result) throw new Error('Invalid private key. Please check and try again.');

        const ndkInstance = getNDK() || await connectNDK();
        const signer = createPrivateKeySigner(privateKeyInput);
        ndkInstance.signer = signer;

        const session = {
            publicKey: result.publicKey,
            npub: result.npub,
            displayName: truncateNpub(result.npub),
            isExtension: false,
            isAdmin: isAdmin(result.publicKey),
        };
        saveSession(session);
        setUser(session);

        loadUserRelays(result.publicKey);

        return session;
    }, [loadUserRelays]);

    /**
     * Generate a brand-new Nostr identity
     */
    const generateNewIdentity = useCallback(async () => {
        const { publicKey, npub, nsec } = generateKeypair();

        const ndkInstance = getNDK() || await connectNDK();
        const signer = createPrivateKeySigner(nsec);
        ndkInstance.signer = signer;

        const session = {
            publicKey,
            npub,
            displayName: truncateNpub(npub),
            isExtension: false,
            isAdmin: isAdmin(publicKey),
        };
        saveSession(session);
        setUser(session);
        return { ...session, nsec };
    }, []);

    /**
     * Logout — clear session and relay list
     */
    const logout = useCallback(() => {
        const ndkInstance = getNDK();
        if (ndkInstance) ndkInstance.signer = undefined;
        clearSession();
        clearSavedRelays();
        setUser(null);

        // Reconnect with defaults
        reconnectNDK(getDefaultRelays()).then(refreshRelayStatus);
    }, [refreshRelayStatus]);

    /**
     * Update display name
     */
    const setDisplayName = useCallback((name) => {
        if (!user) return;
        const updated = { ...user, displayName: name };
        setUser(updated);
        saveSession(updated);
    }, [user]);

    /**
     * Auth gate helper
     */
    const requireAuth = useCallback(() => {
        if (!user) throw new Error('Login required');
        return user;
    }, [user]);

    /**
     * Add a relay
     */
    const addRelay = useCallback(async (url) => {
        const updated = await addRelayService(url);
        refreshRelayStatus();
        return updated;
    }, [refreshRelayStatus]);

    /**
     * Remove a relay
     */
    const removeRelay = useCallback(async (url) => {
        const updated = await removeRelayService(url);
        refreshRelayStatus();
        return updated;
    }, [refreshRelayStatus]);

    /**
     * Reset relays to defaults
     */
    const resetRelays = useCallback(async () => {
        clearSavedRelays();
        await reconnectNDK(getDefaultRelays());
        refreshRelayStatus();
    }, [refreshRelayStatus]);

    /**
     * Re-fetch relays from NIP-65
     */
    const refetchRelays = useCallback(async () => {
        if (!user) return;
        await loadUserRelays(user.publicKey);
    }, [user, loadUserRelays]);

    const value = {
        user,
        loading,
        ndkReady,
        isLoggedIn: !!user,
        hasExtension: hasNostrExtension(),
        loginWithExtension,
        loginWithKey,
        generateNewIdentity,
        logout,
        setDisplayName,
        requireAuth,
        // Relay management
        relays,
        relaysLoading,
        addRelay,
        removeRelay,
        resetRelays,
        refetchRelays,
        refreshRelayStatus,
    };

    return (
        <NostrAuthContext.Provider value={value}>
            {children}
        </NostrAuthContext.Provider>
    );
}

/**
 * Hook to access Nostr auth context
 */
export function useNostrAuth() {
    const context = useContext(NostrAuthContext);
    if (!context) throw new Error('useNostrAuth must be used within a NostrAuthProvider');
    return context;
}

export default NostrAuthContext;
