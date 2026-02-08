# Sats for Shops 🛒⚡

A decentralized Bitcoin bounty board for local businesses, powered by [Nostr](https://nostr.com/).

## Features

- **🔐 Nostr Authentication** — Login with NIP-07 browser extension or private key
- **📍 Meetup-based Organization** — Create bounties organized by local Bitcoin meetups
- **💰 Bounty System** — Post bounties on businesses to accept Bitcoin
- **💬 Nostr-native Comments** — Comments stored on Nostr relays (NIP-22)
- **📡 Relay Management** — Manage your relays, auto-fetch from NIP-65
- **🌐 Decentralized Storage** — Bounties stored as NIP-99 events on Nostr relays

## Tech Stack

- **Frontend**: React + Vite
- **Nostr**: NDK (Nostr Development Kit)
- **Storage**: Nostr relays (NIP-99, NIP-22) + localStorage fallback
- **Styling**: Vanilla CSS with dark theme

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/sats-for-shops.git
cd sats-for-shops

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` for development:

```bash
cp .env.example .env
```

Available variables:

- `VITE_NOSTR_NSEC` — Test account private key (dev only!)
- `VITE_NOSTR_NPUB` — Test account public key

⚠️ **Never commit real private keys!**

## NIPs Used

| NIP | Kind | Purpose |
|-----|------|---------|
| NIP-07 | — | Browser extension signing |
| NIP-22 | 1111 | Comments on bounties |
| NIP-65 | 10002 | Relay list metadata |
| NIP-99 | 30402 | Bounty listings |

## Project Structure

```
src/
├── components/        # React components
│   ├── NostrLoginModal.jsx
│   ├── SettingsPanel.jsx
│   └── ...
├── contexts/          # React contexts
│   └── NostrAuthContext.jsx
├── services/          # API & Nostr services
│   ├── api.js         # Hybrid Nostr + localStorage
│   ├── nostr.js       # NDK wrapper & NIP implementations
│   └── storage.js     # localStorage persistence
├── App.jsx
├── BountyBoard.jsx    # Main app component
└── LandingPage.jsx
```

## License

MIT
