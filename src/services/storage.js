/**
 * LocalStorage Persistence Service
 * Provides client-side CRUD operations.
 * All data stored under `sfs_*` keys in localStorage.
 */

// ============================================================================
// STORAGE KEYS
// ============================================================================
const KEYS = {
    BOUNTIES: 'sfs_bounties',
    MEETUPS: 'sfs_meetups',
    INITIALIZED: 'sfs_initialized',
};

// ============================================================================
// LOW-LEVEL HELPERS
// ============================================================================

function read(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function write(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ============================================================================
// INPUT VALIDATION & SANITIZATION
// ============================================================================

/**
 * Sanitize a string by trimming whitespace, stripping HTML tags, and enforcing max length.
 * @param {string} str - Input string
 * @param {number} maxLen - Maximum length (default 1000)
 * @returns {string} Sanitized string
 */
function sanitize(str, maxLen = 1000) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().replace(/<[^>]*>/g, '').slice(0, maxLen);
}

/**
 * Validate a URL against an optional pattern.
 * @param {string} url - URL to validate
 * @param {RegExp} [pattern] - Optional regex pattern the URL must match
 * @returns {boolean} True if valid or empty
 */
function isValidUrl(url, pattern) {
    if (!url) return true; // Optional fields
    try {
        const u = new URL(url);
        return pattern ? pattern.test(u.href) : true;
    } catch {
        return false;
    }
}

const GOOGLE_MAPS_PATTERN = /^https:\/\/(www\.)?google\.(com|[a-z]{2,3})\/maps|^https:\/\/maps\.google\.|^https:\/\/goo\.gl\/maps|^https:\/\/maps\.app\.goo\.gl/i;
const BTC_MAP_PATTERN = /^https:\/\/(www\.)?btcmap\.org/i;

/**
 * Validate required fields and return error messages.
 * @param {object} data - Data to validate
 * @param {string[]} required - Array of required field names
 * @returns {string|null} Error message or null if valid
 */
function validateRequired(data, required) {
    for (const field of required) {
        if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
            return `${field} is required`;
        }
    }
    return null;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize storage with empty data structures if needed.
 * No seed data — app starts empty for new users.
 */
export function initializeStorage() {
    // Just ensure the data structures exist, no seeding
    if (!read(KEYS.MEETUPS)) {
        write(KEYS.MEETUPS, []);
    }
    if (!read(KEYS.BOUNTIES)) {
        write(KEYS.BOUNTIES, []);
    }
}

// ============================================================================
// MEETUPS
// ============================================================================

export function getMeetups() {
    return read(KEYS.MEETUPS) || [];
}

/**
 * Create a new meetup with duplicate prevention.
 * @param {object} meetupData - { name, country }
 * @returns {object} Created meetup or throws error on duplicate
 */
export function createMeetup(meetupData) {
    const meetups = getMeetups();
    const name = sanitize(meetupData.name, 100);

    if (!name) {
        throw new Error('Meetup name is required');
    }

    // Check for duplicates (case-insensitive)
    const normalized = name.toLowerCase();
    if (meetups.some(m => m.name.toLowerCase() === normalized)) {
        throw new Error('A meetup with this name already exists');
    }

    // Prefer a pre-computed id (e.g. from api.js) so the Nostr 'd' tag matches.
    const id = meetupData.id || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const newMeetup = {
        id,
        name,
        country: sanitize(meetupData.country, 10) || '🌍',
        members: 1,
        created_at: new Date().toISOString(),
        // Persist Nostr event_id when available so comments can reference it later
        ...(meetupData.event_id ? { event_id: meetupData.event_id } : {}),
    };
    meetups.push(newMeetup);
    write(KEYS.MEETUPS, meetups);
    return newMeetup;
}

// ============================================================================
// BOUNTIES
// ============================================================================

export function getBounties(meetupId) {
    const all = read(KEYS.BOUNTIES) || [];
    if (!meetupId) return all;
    return all.filter(b => b.meetup_id === meetupId);
}

/**
 * Create a new bounty with input validation.
 */
export function createBounty({ meetup_id, business_type, description, creator_pubkey }) {
    // Validate required fields
    const sanitizedDesc = sanitize(description, 2000);
    if (!sanitizedDesc) {
        throw new Error('Description is required');
    }
    if (!meetup_id) {
        throw new Error('Meetup is required');
    }

    const all = read(KEYS.BOUNTIES) || [];
    const newBounty = {
        id: crypto.randomUUID(),
        meetup_id: sanitize(meetup_id, 100),
        business_type: sanitize(business_type, 50) || '📦 Other',
        description: sanitizedDesc,
        status: 'active',
        created_at: new Date().toISOString(),
        creator_pubkey: creator_pubkey || null,
        contributors: [],
        totalSats: 0,
        comments: [],
        watchers: [],
        claimed_by: null,
        claimer_pubkey: null,
        business_name: null,
        google_maps_link: null,
        btc_map_link: null,
        claimed_at: null,
        verified_at: null,
        completed_at: null,
        verifications: [],
    };
    all.push(newBounty);
    write(KEYS.BOUNTIES, all);
    return newBounty;
}

/**
 * Add a contribution to a bounty with validation.
 */
export function addContribution({ bounty_id, name, sats, pubkey }) {
    const satsNum = parseInt(sats, 10);
    if (!satsNum || satsNum < 1) {
        throw new Error('Sats amount must be at least 1');
    }

    const all = read(KEYS.BOUNTIES) || [];
    const idx = all.findIndex(b => b.id === bounty_id);
    if (idx === -1) {
        throw new Error('Bounty not found');
    }

    const contribution = {
        name: sanitize(name, 50) || 'Anonymous',
        pubkey: pubkey || null,
        sats: satsNum,
        date: new Date().toISOString(),
    };

    all[idx].contributors.push(contribution);
    all[idx].totalSats = all[idx].contributors.reduce((sum, c) => sum + c.sats, 0);
    write(KEYS.BOUNTIES, all);
    return contribution;
}

/**
 * Claim a bounty with validation.
 */
export function claimBounty({ bounty_id, claimer_name, business_name, google_maps_link, btc_map_link, lightning_address, notes, pubkey }) {
    // Validate required fields
    const sanitizedBusinessName = sanitize(business_name, 200);
    if (!sanitizedBusinessName) {
        throw new Error('Business name is required');
    }

    // Validate URLs
    if (!isValidUrl(google_maps_link, GOOGLE_MAPS_PATTERN)) {
        throw new Error('Invalid Google Maps link');
    }
    if (btc_map_link && !isValidUrl(btc_map_link, BTC_MAP_PATTERN)) {
        throw new Error('Invalid BTC Map link');
    }

    const all = read(KEYS.BOUNTIES) || [];
    const idx = all.findIndex(b => b.id === bounty_id);
    if (idx === -1) {
        throw new Error('Bounty not found');
    }

    if (all[idx].status !== 'active') {
        throw new Error('This bounty is no longer active');
    }

    all[idx].status = 'pending_verification';
    all[idx].claimed_by = sanitize(claimer_name, 50) || 'Anonymous';
    all[idx].claimer_pubkey = pubkey || null;
    all[idx].business_name = sanitizedBusinessName;
    all[idx].google_maps_link = google_maps_link || '';
    all[idx].btc_map_link = btc_map_link || '';
    all[idx].lightning_address = sanitize(lightning_address, 100) || '';
    all[idx].notes = sanitize(notes, 1000) || '';
    all[idx].claimed_at = new Date().toISOString();

    write(KEYS.BOUNTIES, all);
    return all[idx];
}

/**
 * Add a comment with validation.
 */
export function addComment({ bounty_id, commenter_name, comment, pubkey }) {
    const sanitizedComment = sanitize(comment, 2000);
    if (!sanitizedComment) {
        throw new Error('Comment text is required');
    }

    const all = read(KEYS.BOUNTIES) || [];
    const idx = all.findIndex(b => b.id === bounty_id);
    if (idx === -1) {
        throw new Error('Bounty not found');
    }

    const newComment = {
        name: sanitize(commenter_name, 50) || 'Anonymous',
        text: sanitizedComment,
        date: new Date().toISOString(),
        pubkey: pubkey || null,
    };

    if (!all[idx].comments) all[idx].comments = [];
    all[idx].comments.push(newComment);
    write(KEYS.BOUNTIES, all);
    return newComment;
}

/**
 * Add a verification with validation.
 */
export function addVerification({ bounty_id, name, comment, pubkey }) {
    const sanitizedComment = sanitize(comment, 1000);
    if (!sanitizedComment) {
        throw new Error('Verification comment is required');
    }

    const all = read(KEYS.BOUNTIES) || [];
    const idx = all.findIndex(b => b.id === bounty_id);
    if (idx === -1) {
        throw new Error('Bounty not found');
    }

    const verification = {
        name: sanitize(name, 50) || 'Anonymous',
        comment: sanitizedComment,
        date: new Date().toISOString(),
        pubkey: pubkey || null,
    };

    if (!all[idx].verifications) all[idx].verifications = [];
    all[idx].verifications.push(verification);
    write(KEYS.BOUNTIES, all);
    return verification;
}

/**
 * Update bounty status.
 */
export function updateBountyStatus(bountyId, status) {
    const validStatuses = ['active', 'pending_verification', 'completed'];
    if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
    }

    const all = read(KEYS.BOUNTIES) || [];
    const idx = all.findIndex(b => b.id === bountyId);
    if (idx === -1) {
        throw new Error('Bounty not found');
    }

    all[idx].status = status;
    if (status === 'completed') {
        all[idx].completed_at = new Date().toISOString();
    }
    write(KEYS.BOUNTIES, all);
    return all[idx];
}

/**
 * Delete a bounty (only creator can delete).
 */
export function deleteBounty(bountyId, pubkey) {
    if (!pubkey) {
        throw new Error('Authentication required');
    }

    const all = read(KEYS.BOUNTIES) || [];
    const idx = all.findIndex(b => b.id === bountyId);
    if (idx === -1) {
        throw new Error('Bounty not found');
    }

    if (all[idx].creator_pubkey && all[idx].creator_pubkey !== pubkey) {
        throw new Error('Only the creator can delete this bounty');
    }

    const deleted = all.splice(idx, 1)[0];
    write(KEYS.BOUNTIES, all);
    return deleted;
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
    initializeStorage,
    getMeetups,
    createMeetup,
    getBounties,
    createBounty,
    addContribution,
    claimBounty,
    addComment,
    addVerification,
    updateBountyStatus,
    deleteBounty,
};
