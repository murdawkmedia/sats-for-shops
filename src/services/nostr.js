/**
 * Nostr Identity & Relay Service
 * Handles NDK initialization, NIP-07 extension detection, keypair management,
 * relay list management (NIP-65), and session persistence.
 */
import NDK, { NDKNip07Signer, NDKPrivateKeySigner, NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { npubEncode, nsecEncode, decode } from 'nostr-tools/nip19';

// ============================================================================
// DEFAULT / BOOTSTRAP RELAYS
// ============================================================================

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const RELAY_STORAGE_KEY = 'sfs_user_relays';

// ============================================================================
// NDK INSTANCE MANAGEMENT
// ============================================================================

let ndk = null;

/**
 * Connect to Nostr relays via NDK.
 * Uses saved user relays if available, otherwise defaults.
 * @returns {Promise<NDK>} The connected NDK instance
 */
export async function connectNDK(relayUrls) {
  if (ndk) return ndk;

  const urls = relayUrls || loadSavedRelays() || DEFAULT_RELAYS;
  ndk = new NDK({ explicitRelayUrls: urls });

  try {
    await ndk.connect(2500);
    console.log('✅ NDK Connected. Active relays:', ndk.pool.connectedRelays().length);
  } catch (err) {
    console.warn('⚠️ NDK Connection partial/timeout:', err);
  }

  return ndk;
}

/**
 * Get the current NDK instance (may be null if not connected).
 * @returns {NDK|null}
 */
export function getNDK() {
  return ndk;
}

/**
 * Disconnect NDK and clear the instance.
 */
export function disconnectNDK() {
  if (ndk) {
    ndk.signer = undefined;
    ndk = null;
  }
}

/**
 * Reconnect NDK with a new set of relays.
 * Tears down existing instance and creates a fresh one.
 * @param {string[]} relayUrls
 * @returns {Promise<NDK>}
 */
export async function reconnectNDK(relayUrls) {
  const hadSigner = ndk?.signer;
  disconnectNDK();
  ndk = new NDK({ explicitRelayUrls: relayUrls });

  if (hadSigner) {
    ndk.signer = hadSigner;
  }

  try {
    await ndk.connect(3000);
    console.log('✅ NDK Reconnected. Active relays:', ndk.pool.connectedRelays().length);
  } catch (err) {
    console.warn('⚠️ NDK Reconnection partial/timeout:', err);
  }

  return ndk;
}

/**
 * Create an NDK NIP-07 signer (browser extension).
 * @returns {NDKNip07Signer}
 */
export function createNip07Signer() {
  return new NDKNip07Signer();
}

/**
 * Create an NDK private key signer.
 * @param {string} key - nsec or hex private key
 * @returns {NDKPrivateKeySigner}
 */
export function createPrivateKeySigner(key) {
  return new NDKPrivateKeySigner(key);
}

// ============================================================================
// RELAY MANAGEMENT (NIP-65)
// ============================================================================

/**
 * Fetch a user's relay list from NIP-65 (kind 10002) events.
 * Queries bootstrap relays to discover the user's preferred relays.
 * @param {string} pubkey - hex pubkey
 * @returns {Promise<Array<{ url: string, read: boolean, write: boolean }>>}
 */
export async function fetchUserRelays(pubkey) {
  if (!ndk) await connectNDK();

  try {
    // kind 10002 = relay list metadata (NIP-65)
    const events = await ndk.fetchEvents({
      kinds: [10002],
      authors: [pubkey],
      limit: 5,
    });

    if (!events || events.size === 0) {
      console.log('ℹ️ No NIP-65 relay list found for user');
      return [];
    }

    // Get the most recent event
    let latest = null;
    for (const event of events) {
      if (!latest || event.created_at > latest.created_at) {
        latest = event;
      }
    }

    if (!latest) return [];

    // Parse relay tags: ["r", "wss://relay.example.com", "read"|"write"?]
    const relays = [];
    for (const tag of latest.tags) {
      if (tag[0] === 'r' && tag[1]) {
        const url = tag[1].replace(/\/$/, ''); // strip trailing slash
        const marker = tag[2]; // "read", "write", or undefined (both)
        relays.push({
          url,
          read: !marker || marker === 'read',
          write: !marker || marker === 'write',
        });
      }
    }

    console.log(`✅ Found ${relays.length} relays from NIP-65`);
    return relays;
  } catch (err) {
    console.warn('⚠️ Failed to fetch NIP-65 relay list:', err);
    return [];
  }
}

/**
 * Get the current list of relays NDK is connected to, with status.
 * @returns {Array<{ url: string, connected: boolean }>}
 */
export function getConnectedRelays() {
  if (!ndk) return DEFAULT_RELAYS.map(url => ({ url, connected: false }));

  const relayStatus = [];
  for (const relay of ndk.pool.relays.values()) {
    relayStatus.push({
      url: relay.url,
      connected: relay.connectivity?.status === 1, // WebSocket.OPEN
    });
  }

  return relayStatus;
}

/**
 * Get the list of relay URLs (either saved or defaults).
 * @returns {string[]}
 */
export function getActiveRelayUrls() {
  return loadSavedRelays() || DEFAULT_RELAYS;
}

/**
 * Get the default relay URLs.
 * @returns {string[]}
 */
export function getDefaultRelays() {
  return [...DEFAULT_RELAYS];
}

// ============================================================================
// RELAY PERSISTENCE
// ============================================================================

/**
 * Save a relay list to localStorage.
 * @param {string[]} relayUrls
 */
export function saveRelays(relayUrls) {
  localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(relayUrls));
}

/**
 * Load saved relay list from localStorage.
 * @returns {string[]|null}
 */
export function loadSavedRelays() {
  try {
    const raw = localStorage.getItem(RELAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Clear saved relay list.
 */
export function clearSavedRelays() {
  localStorage.removeItem(RELAY_STORAGE_KEY);
}

/**
 * Add a relay URL, save, and reconnect.
 * @param {string} url - wss:// relay URL
 * @returns {Promise<string[]>} updated relay list
 */
export async function addRelay(url) {
  // Validate URL
  const normalized = url.trim().replace(/\/$/, '');
  if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
    throw new Error('Relay URL must start with wss:// or ws://');
  }

  const current = loadSavedRelays() || [...DEFAULT_RELAYS];
  if (current.includes(normalized)) {
    throw new Error('Relay already in list');
  }

  current.push(normalized);
  saveRelays(current);
  await reconnectNDK(current);
  return current;
}

/**
 * Remove a relay URL, save, and reconnect.
 * @param {string} url
 * @returns {Promise<string[]>} updated relay list
 */
export async function removeRelay(url) {
  const current = loadSavedRelays() || [...DEFAULT_RELAYS];
  const normalized = url.trim().replace(/\/$/, '');
  const updated = current.filter(r => r !== normalized);

  if (updated.length === 0) {
    throw new Error('Cannot remove the last relay');
  }

  saveRelays(updated);
  await reconnectNDK(updated);
  return updated;
}

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * Generate a brand-new Nostr keypair
 * @returns {{ privateKey: Uint8Array, publicKey: string, npub: string, nsec: string }}
 */
export function generateKeypair() {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  return {
    privateKey: sk,
    publicKey: pk,
    npub: npubEncode(pk),
    nsec: nsecEncode(sk),
  };
}

/**
 * Derive public key from a private key (hex string or nsec)
 * @param {string} input - hex private key or nsec bech32 string
 * @returns {{ publicKey: string, npub: string } | null}
 */
export function publicKeyFromPrivate(input) {
  try {
    let skBytes;
    if (input.startsWith('nsec')) {
      const decoded = decode(input);
      if (decoded.type !== 'nsec') return null;
      skBytes = decoded.data;
    } else {
      skBytes = hexToBytes(input);
    }
    const pk = getPublicKey(skBytes);
    return { publicKey: pk, npub: npubEncode(pk) };
  } catch {
    return null;
  }
}

/**
 * Decode an npub to hex public key
 * @param {string} npub
 * @returns {string|null} hex pubkey
 */
export function npubToHex(npub) {
  try {
    const decoded = decode(npub);
    if (decoded.type !== 'npub') return null;
    return decoded.data;
  } catch {
    return null;
  }
}

/**
 * Encode a hex public key to npub
 * @param {string} hexPubkey
 * @returns {string} npub
 */
export function hexToNpub(hexPubkey) {
  return npubEncode(hexPubkey);
}

// ============================================================================
// NIP-07 BROWSER EXTENSION
// ============================================================================

/**
 * Check if a NIP-07 compatible browser extension is available
 * @returns {boolean}
 */
export function hasNostrExtension() {
  return typeof window !== 'undefined' && !!window.nostr;
}

/**
 * Get the user's public key from a NIP-07 extension
 * @returns {Promise<{ publicKey: string, npub: string }>}
 */
export async function getExtensionPubkey() {
  if (!hasNostrExtension()) throw new Error('No Nostr extension detected');
  const pk = await window.nostr.getPublicKey();
  return { publicKey: pk, npub: npubEncode(pk) };
}

/**
 * Sign an event using the NIP-07 extension
 * @param {object} event - unsigned Nostr event
 * @returns {Promise<object>} signed event
 */
export async function signWithExtension(event) {
  if (!hasNostrExtension()) throw new Error('No Nostr extension detected');
  return window.nostr.signEvent(event);
}

// ============================================================================
// EVENT CREATION (for future relay integration)
// ============================================================================

/**
 * Create and sign a Nostr event with a local private key
 */
export function createSignedEvent(kind, content, tags, privateKey) {
  const event = {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };
  return finalizeEvent(event, privateKey);
}

// ============================================================================
// BOUNTY EVENTS (NIP-99 - kind 30402)
// ============================================================================

const BOUNTY_KIND = 30402;

/**
 * Publish a bounty as a NIP-99 classified listing event.
 * @param {object} data - Bounty data
 * @param {string} data.id - Unique bounty identifier (used as 'd' tag)
 * @param {string} data.business_name - Business name/title
 * @param {string} data.business_type - Type of business
 * @param {string} data.description - Full description
 * @param {number} data.satoshis - Bounty amount in sats
 * @param {string} data.meetup_id - Associated meetup ID
 * @param {string} [data.status='active'] - Status: 'active', 'claimed', 'completed'
 * @returns {Promise<NDKEvent>} Published event
 */
export async function publishBounty(data) {
  if (!ndk) throw new Error('NDK not connected');
  if (!ndk.signer) throw new Error('No signer available - please login');

  const event = new NDKEvent(ndk);
  event.kind = BOUNTY_KIND;
  event.content = data.description || '';

  const now = Math.floor(Date.now() / 1000).toString();
  event.tags = [
    ['d', data.id],
    ['title', data.business_name || 'Untitled Bounty'],
    ['t', 'bounty'],
    ['t', 'sats-for-shops'],
    ['t', data.meetup_id || 'global'],
    ['price', String(data.satoshis || 0), 'sat'],
    ['status', data.status || 'active'],
    ['published_at', now],
  ];

  if (data.business_type) {
    event.tags.push(['t', data.business_type.toLowerCase().replace(/\s+/g, '-')]);
  }

  await event.publish();
  console.log('✅ Bounty published:', event.id);
  return event;
}

/**
 * Fetch bounties from relays.
 * @param {object} [filters={}] - Optional filters
 * @param {string} [filters.meetupId] - Filter by meetup
 * @param {string} [filters.status] - Filter by status
 * @param {number} [filters.limit=50] - Max results
 * @returns {Promise<Array>} Array of bounty objects
 */
export async function fetchBounties(filters = {}) {
  if (!ndk) await connectNDK();

  const filter = {
    kinds: [BOUNTY_KIND],
    '#t': ['bounty', 'sats-for-shops'],
    limit: filters.limit || 50,
  };

  if (filters.meetupId) {
    filter['#t'] = [...filter['#t'], filters.meetupId];
  }

  try {
    const events = await ndk.fetchEvents(filter);
    const bounties = [];

    for (const event of events) {
      const bounty = parseNip99Event(event);
      if (bounty && (!filters.status || bounty.status === filters.status)) {
        bounties.push(bounty);
      }
    }

    // Sort by created_at descending
    bounties.sort((a, b) => b.created_at - a.created_at);
    console.log(`✅ Fetched ${bounties.length} bounties from relays`);
    return bounties;
  } catch (err) {
    console.warn('⚠️ Failed to fetch bounties:', err);
    return [];
  }
}

/**
 * Subscribe to bounty events in real-time.
 * @param {object} [filters={}] - Optional filters
 * @param {function} onEvent - Callback for each new event
 * @returns {object} Subscription object with .stop() method
 */
export function subscribeToBounties(filters = {}, onEvent) {
  if (!ndk) {
    console.warn('NDK not connected, cannot subscribe');
    return { stop: () => { } };
  }

  const filter = {
    kinds: [BOUNTY_KIND],
    '#t': ['bounty', 'sats-for-shops'],
  };

  if (filters.meetupId) {
    filter['#t'] = [...filter['#t'], filters.meetupId];
  }

  const sub = ndk.subscribe(filter, { closeOnEose: false });

  sub.on('event', (event) => {
    const bounty = parseNip99Event(event);
    if (bounty) onEvent(bounty);
  });

  return sub;
}

/**
 * Update a bounty's status (republish with same 'd' tag).
 * @param {string} bountyId - The bounty's 'd' tag value
 * @param {object} updates - Fields to update
 * @returns {Promise<NDKEvent>}
 */
export async function updateBounty(bountyId, updates) {
  // First fetch the existing bounty
  const existing = await fetchBountyById(bountyId);
  if (!existing) throw new Error('Bounty not found');

  // Merge updates
  const merged = { ...existing, ...updates, id: bountyId };
  return publishBounty(merged);
}

/**
 * Fetch a single bounty by its 'd' tag.
 * @param {string} bountyId
 * @returns {Promise<object|null>}
 */
export async function fetchBountyById(bountyId) {
  if (!ndk) await connectNDK();

  try {
    const events = await ndk.fetchEvents({
      kinds: [BOUNTY_KIND],
      '#d': [bountyId],
      limit: 1,
    });

    for (const event of events) {
      return parseNip99Event(event);
    }
    return null;
  } catch (err) {
    console.warn('⚠️ Failed to fetch bounty by ID:', err);
    return null;
  }
}

/**
 * Parse a NIP-99 event into a bounty object.
 * @param {NDKEvent} event
 * @returns {object|null}
 */
function parseNip99Event(event) {
  try {
    const getTag = (name) => {
      const tag = event.tags.find(t => t[0] === name);
      return tag ? tag[1] : null;
    };

    const getTags = (name) => {
      return event.tags.filter(t => t[0] === name).map(t => t[1]);
    };

    const priceTag = event.tags.find(t => t[0] === 'price');
    const satoshis = priceTag ? parseInt(priceTag[1], 10) : 0;

    // Find meetup tag (exclude known system tags)
    const systemTags = ['bounty', 'sats-for-shops'];
    const tTags = getTags('t');
    const meetupId = tTags.find(t => !systemTags.includes(t) && !t.includes('-')) || 'global';

    return {
      id: getTag('d') || event.id,
      event_id: event.id,
      pubkey: event.pubkey,
      business_name: getTag('title') || 'Untitled',
      description: event.content || '',
      satoshis,
      status: getTag('status') || 'active',
      meetup_id: meetupId,
      created_at: event.created_at,
      published_at: getTag('published_at'),
      tags: tTags,
    };
  } catch (err) {
    console.warn('Failed to parse NIP-99 event:', err);
    return null;
  }
}

// ============================================================================
// COMMENT EVENTS (NIP-22 - kind 1111)
// ============================================================================

const COMMENT_KIND = 1111;

/**
 * Publish a comment on a bounty using NIP-22.
 * @param {object} data
 * @param {string} data.bountyEventId - The bounty event ID (root)
 * @param {string} data.bountyPubkey - The bounty author's pubkey
 * @param {string} data.text - Comment text
 * @param {string} [data.parentEventId] - Parent comment if replying to a comment
 * @param {string} [data.parentPubkey] - Parent comment author
 * @returns {Promise<NDKEvent>}
 */
export async function publishComment(data) {
  if (!ndk) throw new Error('NDK not connected');
  if (!ndk.signer) throw new Error('No signer available - please login');

  const event = new NDKEvent(ndk);
  event.kind = COMMENT_KIND;
  event.content = data.text || '';

  // Root scope tags (uppercase)
  event.tags = [
    ['E', data.bountyEventId, '', data.bountyPubkey],
    ['K', String(BOUNTY_KIND)],
    ['P', data.bountyPubkey],
  ];

  // Parent tags (lowercase) - same as root if direct reply to bounty
  const parentId = data.parentEventId || data.bountyEventId;
  const parentPubkey = data.parentPubkey || data.bountyPubkey;
  const parentKind = data.parentEventId ? String(COMMENT_KIND) : String(BOUNTY_KIND);

  event.tags.push(
    ['e', parentId, '', parentPubkey],
    ['k', parentKind],
    ['p', parentPubkey]
  );

  await event.publish();
  console.log('✅ Comment published:', event.id);
  return event;
}

/**
 * Fetch comments for a bounty.
 * @param {string} bountyEventId - The bounty event ID
 * @returns {Promise<Array>}
 */
export async function fetchComments(bountyEventId) {
  if (!ndk) await connectNDK();

  try {
    const events = await ndk.fetchEvents({
      kinds: [COMMENT_KIND],
      '#E': [bountyEventId],
      limit: 100,
    });

    const comments = [];
    for (const event of events) {
      comments.push(parseCommentEvent(event));
    }

    // Sort by created_at ascending (oldest first)
    comments.sort((a, b) => a.created_at - b.created_at);
    console.log(`✅ Fetched ${comments.length} comments`);
    return comments;
  } catch (err) {
    console.warn('⚠️ Failed to fetch comments:', err);
    return [];
  }
}

/**
 * Subscribe to comments for a bounty in real-time.
 * @param {string} bountyEventId
 * @param {function} onEvent
 * @returns {object} Subscription
 */
export function subscribeToComments(bountyEventId, onEvent) {
  if (!ndk) {
    console.warn('NDK not connected, cannot subscribe');
    return { stop: () => { } };
  }

  const sub = ndk.subscribe(
    { kinds: [COMMENT_KIND], '#E': [bountyEventId] },
    { closeOnEose: false }
  );

  sub.on('event', (event) => {
    onEvent(parseCommentEvent(event));
  });

  return sub;
}

/**
 * Parse a NIP-22 comment event.
 * @param {NDKEvent} event
 * @returns {object}
 */
function parseCommentEvent(event) {
  const getTag = (name) => {
    const tag = event.tags.find(t => t[0] === name);
    return tag ? tag[1] : null;
  };

  return {
    id: event.id,
    pubkey: event.pubkey,
    text: event.content,
    created_at: event.created_at,
    bounty_id: getTag('E'),
    parent_id: getTag('e'),
  };
}

// ============================================================================
// MEETUP EVENTS (NIP-99 - kind 30402 with meetup tag)
// ============================================================================

/**
 * Publish a meetup as a NIP-99 event.
 * @param {object} data
 * @returns {Promise<NDKEvent>}
 */
export async function publishMeetup(data) {
  if (!ndk) throw new Error('NDK not connected');
  if (!ndk.signer) throw new Error('No signer available - please login');

  const event = new NDKEvent(ndk);
  event.kind = BOUNTY_KIND; // Same kind, different tags
  event.content = data.description || `${data.name} Bitcoin Meetup`;

  event.tags = [
    ['d', data.id],
    ['title', data.name],
    ['t', 'meetup'],
    ['t', 'sats-for-shops'],
    ['location', data.country || '🌍'],
    ['published_at', Math.floor(Date.now() / 1000).toString()],
  ];

  await event.publish();
  console.log('✅ Meetup published:', event.id);
  return event;
}

/**
 * Fetch meetups from relays.
 * @returns {Promise<Array>}
 */
export async function fetchMeetups() {
  if (!ndk) await connectNDK();

  try {
    const events = await ndk.fetchEvents({
      kinds: [BOUNTY_KIND],
      '#t': ['meetup', 'sats-for-shops'],
      limit: 100,
    });

    const meetups = [];
    const seenIds = new Set();

    for (const event of events) {
      const meetup = parseMeetupEvent(event);
      if (meetup && !seenIds.has(meetup.id)) {
        seenIds.add(meetup.id);
        meetups.push(meetup);
      }
    }

    console.log(`✅ Fetched ${meetups.length} meetups from relays`);
    return meetups;
  } catch (err) {
    console.warn('⚠️ Failed to fetch meetups:', err);
    return [];
  }
}

/**
 * Parse a meetup event.
 * @param {NDKEvent} event
 * @returns {object|null}
 */
function parseMeetupEvent(event) {
  try {
    const getTag = (name) => {
      const tag = event.tags.find(t => t[0] === name);
      return tag ? tag[1] : null;
    };

    return {
      id: getTag('d') || event.id,
      event_id: event.id,
      pubkey: event.pubkey,
      name: getTag('title') || 'Unknown Meetup',
      country: getTag('location') || '🌍',
      created_at: event.created_at,
    };
  } catch (err) {
    console.warn('Failed to parse meetup event:', err);
    return null;
  }
}

// ============================================================================
// SESSION PERSISTENCE
// ============================================================================

const SESSION_KEY = 'sfs_nostr_session';

/**
 * Save the user's Nostr session (pubkey only — never store nsec)
 */
export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    publicKey: session.publicKey,
    npub: session.npub,
    displayName: session.displayName || '',
    isExtension: session.isExtension || false,
  }));
}

/** Load the saved Nostr session */
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear the saved Nostr session */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Truncate an npub for display
 */
export function truncateNpub(npub, chars = 8) {
  if (!npub || npub.length < chars * 2 + 5) return npub;
  return `${npub.slice(0, chars + 5)}...${npub.slice(-chars)}`;
}

/** Convert hex string to Uint8Array */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Admin pubkeys (configurable)
export const ADMIN_PUBKEYS = [];

/**
 * Check if a pubkey has admin privileges
 */
export function isAdmin(pubkey) {
  if (ADMIN_PUBKEYS.length === 0) return false;
  return ADMIN_PUBKEYS.includes(pubkey);
}
