<div align="center">

# ♠ ROOTCASTLE POKER LAB
### High-Performance, Zero-Dependency Server-Authoritative Texas Hold'em Engine

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-339933.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-F59E0B.svg?style=for-the-badge)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20(Runtime)-10B981.svg?style=for-the-badge)](package.json)
[![Security Hardened](https://img.shields.io/badge/Security-CSP%20%2B%20Strict%20Headers-6366F1.svg?style=for-the-badge)](src/server/server.ts)

<p align="center">
  <strong>An enterprise-grade, browser-based No-Limit Texas Hold'em simulator engineered for precision, security, and low-latency real-time gameplay.</strong>
</p>

[Quick Start](#-quick-start) • [Architecture](#-architecture) • [Features](#-key-features) • [API Reference](#-api-reference) • [Security Model](#-security--fair-play) • [Development](#-development--testing)

---

</div>

## 🌟 Overview

**Rootcastle Poker Lab** is a zero-dependency, server-authoritative Texas Hold'em poker simulation built on modern Node.js and strict TypeScript. Designed with a security-first posture and deterministic state transitions, the entire poker state machine—including deck shuffling, side-pot reconciliation, betting rounds, and bot heuristics—executes strictly server-side.

The client interface communicates with the server via Server-Sent Events (SSE) for low-latency live table updates and hardened REST endpoints for player actions.

---

## ⚡ Key Features

- **♠ 100% Server-Authoritative Engine:** The browser client is treated as an untrusted view layer. Chip stacks, blinds, active bets, community cards, turn queues, and side-pot split calculations are managed entirely on the backend.
- **🛡️ Cryptographic Fairness:** Deck initialization and card dealing use CSPRNG (`crypto.randomInt`) to guarantee non-deterministic shuffling and eliminate client-side card sniffing before showdown.
- **⚡ Zero Runtime Dependencies:** Powered entirely by Node.js built-in modules (`node:http`, `node:fs`, `node:path`, `node:crypto`).
- **🤖 Heuristic AI Bot Players:** 5 server-controlled automated opponents featuring bounded situational logic (pre-flop ranges, pot-odds awareness, calling/raising/folding decisions).
- **📡 Real-Time SSE Updates:** Unidirectional Server-Sent Events stream live table states directly to connected clients without heavy WebSocket overhead.
- **🎛️ Responsive Luxury Dark Theme UI:** Hand-crafted CSS layout tailored for desktop, tablet, and mobile displays with fluid chips animation, felt table ergonomics, and live session stats.
- **🔒 Enterprise Security Posture:** Strict Content Security Policy (CSP), anti-tampering bounds validation, request payload rate-limits (8 KiB max body), and sanitized chat input.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 22.0.0+** installed on your system.

### Running Locally (Pre-compiled Build)

No `npm install` is required for runtime execution!

```bash
# Clone the repository
git clone https://github.com/rootcastleco/rootcastle-poker.git
cd rootcastle-poker

# Start the server
npm start
# or directly: node dist/server.js
```

### Windows One-Click Launcher
Double-click `start-windows.bat` or run:
```bat
.\start-windows.bat
```

### macOS / Linux Launcher
```bash
chmod +x ./start-unix.sh
./start-unix.sh
```

Navigate to **[http://127.0.0.1:8787](http://127.0.0.1:8787)** in your web browser.

---

## 🏛️ Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────┐
│               Rootcastle Browser Client                │
│       (Strict TypeScript + Vanilla CSS + HTML5)        │
└──────────────┬─────────────────────────▲───────────────┘
               │                         │
      POST Commands (JSON)          SSE Stream (EventSource)
      - /api/action                 - /api/events
      - /api/chat                            │
      - /api/new-hand                        │
      - /api/reset                           │
               │                             │
               ▼                             │
┌────────────────────────────────────────────┴───────────┐
│               Rootcastle Node HTTP Server              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Trust-Boundary Validation & Strict CSP Headers   │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│  ┌──────────────────────────▼───────────────────────┐  │
│  │         PokerGame Domain State Machine           │  │
│  │  • CSPRNG Card Shuffle (crypto.randomInt)        │  │
│  │  • Blind Escalation & Turn Order Queue           │  │
│  │  • Best-5-of-7 Hand Combinatorics Evaluator      │  │
│  │  • Multi-Tier Side-Pot Calculation Engine        │  │
│  │  • Heuristic Bot Decision Matrix                 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 📡 API Reference

### REST Endpoints

| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Server heartbeat & health status | _None_ |
| `GET` | `/api/state` | Retrieve current public game state | _None_ |
| `POST` | `/api/action` | Submit human player action | `{"action": "call"}` or `{"action": "raise", "amount": 100}` |
| `POST` | `/api/new-hand`| Initialize and deal a new hand | `{}` |
| `POST` | `/api/reset` | Reset chips and reinitialize table | `{}` |
| `POST` | `/api/chat` | Broadcast a table chat message | `{"text": "Nice hand!"}` |

### Event Stream

| Method | Endpoint | Protocol | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/events` | Server-Sent Events (SSE) | Emits `state` events upon every table state mutation. |

---

## 🛡️ Security & Fair Play

Rootcastle Poker enforces rigorous security standards:
- **Zero Information Leakage:** Opponent hole cards are filtered from public state payloads until official showdown.
- **Action Verification:** All bets, raises, checks, and folds are validated against table constraints and player stack limits on the server before execution.
- **XSS & Injection Protection:** Client-side DOM updates leverage strict `textContent` binding; raw HTML injection is strictly prohibited.
- **Modern Security Headers:** Emits `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Permissions-Policy`.
- **Fair Play Disclaimer:** Rootcastle Poker Lab operates exclusively with virtual chips. No real-money wagering, deposits, or transactions are supported.

---

## 🛠️ Development & Testing

### Project Structure

```
rootcastle-poker/
├── dist/                  # Compiled JavaScript artifacts
│   ├── poker.js           # Compiled poker engine logic
│   └── server.js          # Compiled HTTP & SSE server
├── docs/                  # Documentation & design assets
│   ├── ACCEPTANCE.md      # Acceptance criteria checklist
│   └── design-concept.png # High-fidelity UI mockups
├── public/                # Static assets served to the browser
│   ├── index.html         # Main game layout & DOM structure
│   ├── styles.css         # Responsive Dark UI stylesheet
│   └── js/app.js          # Client-side UI & SSE controller
├── src/                   # TypeScript Source Code
│   ├── client/
│   │   └── app.ts         # Client controller & state renderer
│   └── server/
│       ├── node-shims.d.ts
│       ├── poker.ts       # Poker engine, rules & evaluator
│       └── server.ts      # Server implementation & routing
├── tests/                 # Evaluator unit test suite
│   └── poker-evaluator.test.mjs
├── package.json           # Package metadata & build scripts
├── tsconfig.client.json   # TypeScript configuration (Client)
└── tsconfig.server.json   # TypeScript configuration (Server)
```

### Building from Source

To compile client and server TypeScript code:

```bash
npm run build
```

### Running Unit Tests

To verify poker hand evaluator combinatorics, tie-breakers, and Royal Flush recognition:

```bash
npm test
```

---

## 🏢 About Rootcastle Co.

**Rootcastle Co.** crafts high-reliability software architectures, interactive gaming engines, and real-time distributed systems.

- **Website / Organization:** [github.com/rootcastleco](https://github.com/rootcastleco)
- **Repository:** [rootcastleco/rootcastle-poker](https://github.com/rootcastleco/rootcastle-poker)
- **License:** Distributed under the MIT License. See [LICENSE](LICENSE) for more details.

<div align="center">
  <sub>© Rootcastle Co. All rights reserved.</sub>
</div>
