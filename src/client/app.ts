type Suit = "S" | "H" | "D" | "C";
type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
type PlayerStatus = "active" | "folded" | "allin" | "out";

interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

interface PublicPlayer {
  readonly id: string;
  readonly name: string;
  readonly isBot: boolean;
  readonly stack: number;
  readonly streetBet: number;
  readonly status: PlayerStatus;
  readonly lastAction: string;
  readonly cardCount: number;
  readonly holeCards: readonly Card[] | null;
  readonly isDealer: boolean;
  readonly isSmallBlind: boolean;
  readonly isBigBlind: boolean;
}

interface AllowedActions {
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly canCall: boolean;
  readonly canRaise: boolean;
  readonly callAmount: number;
  readonly minRaiseTo: number;
  readonly maxRaiseTo: number;
}

interface HandHistoryEntry {
  readonly handNumber: number;
  readonly winners: readonly string[];
  readonly pot: number;
  readonly description: string;
}

interface ChatEntry {
  readonly id: number;
  readonly author: string;
  readonly text: string;
  readonly system: boolean;
}

interface PublicGameState {
  readonly tableName: string;
  readonly handNumber: number;
  readonly street: Street;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly pot: number;
  readonly communityCards: readonly Card[];
  readonly players: readonly PublicPlayer[];
  readonly currentPlayerId: string | null;
  readonly humanPlayerId: string;
  readonly message: string;
  readonly handComplete: boolean;
  readonly allowedActions: AllowedActions;
  readonly history: readonly HandHistoryEntry[];
  readonly chat: readonly ChatEntry[];
  readonly humanHandRank: string | null;
  readonly handOdds: {
    readonly twoPair: number;
    readonly fullHouse: number;
    readonly trips: number;
    readonly straight: number;
    readonly other: number;
  };
  readonly stats: {
    readonly handsPlayed: number;
    readonly handsWon: number;
    readonly biggestPot: number;
  };
}

const suitGlyph: Readonly<Record<Suit, string>> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const rankGlyph: Readonly<Record<number, string>> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

const avatarMap: Readonly<Record<string, string>> = {
  cossack: "/assets/avatars/cossack.jpg",
  you: "/assets/avatars/cossack.jpg",
  byte: "/assets/avatars/byte.jpg",
  leocat: "/assets/avatars/leocat.jpg",
  mira: "/assets/avatars/mira.jpg",
  shadow88: "/assets/avatars/shadow88.jpg",
  anatolia: "/assets/avatars/anatolia.jpg",
  pokerwolf: "/assets/avatars/pokerwolf.jpg"
};

let currentState: PublicGameState | null = null;
let connectionHealthy = false;
let nextHandAutoTimer: number | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element: ${id}`);
  return el as T;
}

function money(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function numberStr(value: number): string {
  return value.toLocaleString("en-US");
}

function isGameState(value: unknown): value is PublicGameState {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Readonly<Record<string, unknown>>;
  return typeof c.tableName === "string" && Array.isArray(c.players) && Array.isArray(c.communityCards) && typeof c.pot === "number";
}

function getAvatarUrl(nameOrId: string): string {
  const key = nameOrId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return avatarMap[key] ?? "/assets/avatars/cossack.jpg";
}

function renderCard(card: Card | null, hidden = false, compact = false): HTMLElement {
  const el = document.createElement("div");
  el.className = `card${compact ? " card--compact" : ""}`;
  
  if (hidden || card === null) {
    el.classList.add("card--back");
    return el;
  }
  
  const isRed = card.suit === "H" || card.suit === "D";
  el.classList.add(isRed ? "card--red" : "card--black");

  const rankStr = rankGlyph[card.rank] ?? String(card.rank);
  const suitStr = suitGlyph[card.suit];

  const topCorner = document.createElement("div");
  topCorner.className = "card-corner-top";
  
  const rSpan = document.createElement("span");
  rSpan.className = "card-rank";
  rSpan.textContent = rankStr;

  const sSpan = document.createElement("span");
  sSpan.className = "card-suit-small";
  sSpan.textContent = suitStr;
  
  topCorner.append(rSpan, sSpan);

  const centerSuit = document.createElement("span");
  centerSuit.className = "card-center-suit";
  centerSuit.textContent = suitStr;

  el.append(topCorner, centerSuit);
  return el;
}

function renderCommunity(state: PublicGameState): void {
  const board = byId<HTMLDivElement>("community-cards");
  board.replaceChildren();
  for (let i = 0; i < 5; i++) {
    const card = state.communityCards[i];
    if (!card) {
      const p = document.createElement("div");
      p.className = "card card--placeholder";
      board.append(p);
    } else {
      board.append(renderCard(card));
    }
  }
}

function renderPlayers(state: PublicGameState): void {
  state.players.forEach((player, index) => {
    const seat = document.getElementById(`seat-${index}`) as HTMLDivElement | null;
    if (!seat) return;

    const isCurrent = state.currentPlayerId === player.id;
    const isHuman = player.id === state.humanPlayerId;

    // Avatar ring glow
    const avatarRing = seat.querySelector<HTMLElement>(".avatar-ring");
    if (avatarRing) {
      if (isCurrent) {
        avatarRing.classList.add("avatar-ring--active");
      } else if (!isHuman) {
        avatarRing.classList.remove("avatar-ring--active");
      }
    }

    const nameEl = seat.querySelector<HTMLElement>("[data-name]");
    if (nameEl) nameEl.textContent = player.name;

    const stackEl = seat.querySelector<HTMLElement>("[data-stack]");
    if (stackEl) stackEl.textContent = money(player.stack);

    const actionEl = seat.querySelector<HTMLElement>("[data-action]");
    if (actionEl) {
      if (player.lastAction) {
        actionEl.textContent = player.lastAction;
        actionEl.style.display = "inline-block";
        if (player.lastAction.toLowerCase().includes("bet") || player.lastAction.toLowerCase().includes("raise")) {
          actionEl.className = "action-pill action-pill--bet";
        } else if (player.lastAction.toLowerCase().includes("check")) {
          actionEl.className = "action-pill action-pill--check";
        } else if (player.lastAction.toLowerCase().includes("fold")) {
          actionEl.className = "action-pill action-pill--fold";
        } else {
          actionEl.className = "action-pill";
        }
      } else {
        actionEl.style.display = "none";
      }
    }

    // Hole Cards
    const cardsEl = seat.querySelector<HTMLElement>("[data-hole]");
    if (cardsEl) {
      cardsEl.replaceChildren();
      if (player.status !== "folded") {
        for (let i = 0; i < player.cardCount; i++) {
          const card = player.holeCards?.[i] ?? null;
          cardsEl.append(renderCard(card, player.holeCards === null, !isHuman));
        }
      }
    }

    // Human floating hand rank
    if (isHuman) {
      const rankPill = document.getElementById("human-hand-rank-pill");
      const rankText = document.getElementById("hand-rank-text");
      if (rankPill && rankText) {
        if (state.humanHandRank && player.status !== "folded" && player.cardCount >= 2) {
          rankText.textContent = state.humanHandRank;
          rankPill.style.display = "flex";
        } else {
          rankPill.style.display = "none";
        }
      }

      // Human timer bar
      const timerEl = seat.querySelector<HTMLElement>("[data-timer]");
      if (timerEl) {
        timerEl.style.width = isCurrent ? "100%" : "0%";
      }
    }
  });
}

function renderActions(state: PublicGameState): void {
  const a = state.allowedActions;
  const fold = byId<HTMLButtonElement>("fold-button");
  const passive = byId<HTMLButtonElement>("passive-button");
  const raise = byId<HTMLButtonElement>("raise-button");
  const callType = byId<HTMLElement>("call-action-type");
  const callAmount = byId<HTMLElement>("call-action-amount");
  const raiseText = byId<HTMLElement>("raise-btn-text");
  
  const range = byId<HTMLInputElement>("raise-range");
  const amount = byId<HTMLInputElement>("raise-amount");

  fold.disabled = !a.canFold;
  passive.disabled = !(a.canCheck || a.canCall);

  if (a.canCall) {
    callType.textContent = "Call";
    callAmount.textContent = numberStr(a.callAmount);
    callAmount.style.display = "inline";
  } else {
    callType.textContent = "Check";
    callAmount.textContent = "";
    callAmount.style.display = "none";
  }

  raise.disabled = !a.canRaise;

  if (a.canRaise) {
    range.min = String(a.minRaiseTo);
    range.max = String(a.maxRaiseTo);
    range.step = String(Math.max(1, state.bigBlind));

    const currentVal = parseInt(amount.value.replace(/[^0-9]/g, ""), 10);
    const selected = Number.isFinite(currentVal)
      ? Math.max(a.minRaiseTo, Math.min(a.maxRaiseTo, currentVal))
      : a.minRaiseTo;

    range.value = String(selected);
    amount.value = numberStr(selected);
    amount.disabled = false;
    range.disabled = false;
    raiseText.textContent = `Raise ${numberStr(selected)}`;
  } else {
    range.value = "0";
    amount.value = "0";
    amount.disabled = true;
    range.disabled = true;
    raiseText.textContent = "Raise";
  }

  // Auto-schedule next hand if hand is complete
  if (state.handComplete) {
    if (nextHandAutoTimer === null) {
      nextHandAutoTimer = window.setTimeout(async () => {
        nextHandAutoTimer = null;
        try {
          await postJson("/api/new-hand");
        } catch {
          // Ignore
        }
      }, 3500);
    }
  } else {
    if (nextHandAutoTimer !== null) {
      clearTimeout(nextHandAutoTimer);
      nextHandAutoTimer = null;
    }
  }
}

function renderHandOdds(state: PublicGameState): void {
  const odds = state.handOdds ?? { twoPair: 78, fullHouse: 12, trips: 6, straight: 3, other: 1 };

  const setBar = (idBar: string, idVal: string, pct: number) => {
    const bar = document.getElementById(idBar);
    const val = document.getElementById(idVal);
    if (bar) bar.style.width = `${pct}%`;
    if (val) val.textContent = `${pct}%`;
  };

  setBar("bar-two-pair", "val-two-pair", odds.twoPair);
  setBar("bar-full-house", "val-full-house", odds.fullHouse);
  setBar("bar-trips", "val-trips", odds.trips);
  setBar("bar-straight", "val-straight", odds.straight);
  setBar("bar-other", "val-other", odds.other);
}

function renderChat(state: PublicGameState): void {
  const list = byId<HTMLDivElement>("chat-list");
  list.replaceChildren();

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  for (const msg of state.chat.slice(-15)) {
    const item = document.createElement("div");
    item.className = msg.system ? "chat-item chat-item--system" : "chat-item";

    if (!msg.system) {
      const img = document.createElement("img");
      img.className = "chat-avatar";
      img.src = getAvatarUrl(msg.author);
      img.alt = msg.author;
      item.append(img);
    }

    const body = document.createElement("div");
    body.className = "chat-body";

    if (!msg.system) {
      const header = document.createElement("div");
      header.className = "chat-header";

      const author = document.createElement("span");
      author.className = "chat-author";
      author.textContent = msg.author;

      const time = document.createElement("span");
      time.className = "chat-time";
      time.textContent = timeStr;

      header.append(author, time);
      body.append(header);
    }

    const text = document.createElement("div");
    text.className = "chat-text";
    text.textContent = msg.text;

    body.append(text);
    item.append(body);
    list.append(item);
  }

  list.scrollTop = list.scrollHeight;
}

function renderHistory(state: PublicGameState): void {
  const list = byId<HTMLDivElement>("history-list");
  list.replaceChildren();

  if (state.history.length === 0) {
    const empty = document.createElement("div");
    empty.style.padding = "10px";
    empty.style.color = "var(--text-subtle)";
    empty.textContent = "No hands completed yet.";
    list.append(empty);
    return;
  }

  for (const item of state.history.slice(0, 6)) {
    const row = document.createElement("div");
    row.className = "hand-row";

    const pCol = document.createElement("div");
    pCol.className = "hand-player-col";

    const winner = document.createElement("strong");
    winner.className = "hand-winner";
    winner.textContent = item.winners.join(", ");

    const type = document.createElement("span");
    type.className = "hand-type";
    type.textContent = item.description;

    pCol.append(winner, type);

    const cCol = document.createElement("div");
    cCol.className = "hand-cards-col";

    const m1 = document.createElement("span");
    m1.className = "mini-card mini-card--red";
    m1.textContent = "K♥";

    const m2 = document.createElement("span");
    m2.className = "mini-card mini-card--black";
    m2.textContent = "K♣";

    cCol.append(m1, m2);

    const potCol = document.createElement("div");
    potCol.className = "hand-pot-col text-win";
    potCol.textContent = `+${numberStr(item.pot)}`;

    row.append(pCol, cCol, potCol);
    list.append(row);
  }
}

function render(state: PublicGameState): void {
  currentState = state;

  byId("pot-amount").textContent = numberStr(state.pot);

  const human = state.players.find(p => p.id === state.humanPlayerId);
  if (human) {
    byId("header-chips").textContent = numberStr(human.stack);
  }

  renderCommunity(state);
  renderPlayers(state);
  renderActions(state);
  renderHandOdds(state);
  renderChat(state);
  renderHistory(state);
}

async function postJson(path: string, body: Readonly<Record<string, unknown>> = {}): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    if (typeof payload === "object" && payload !== null && "error" in payload) {
      const v = (payload as Readonly<Record<string, unknown>>).error;
      if (typeof v === "string") message = v;
    }
    throw new Error(message);
  }
}

function showToast(message: string, kind: "info" | "error" = "info"): void {
  const toast = byId<HTMLDivElement>("toast");
  toast.textContent = message;
  toast.className = `toast toast--visible${kind === "error" ? " toast--error" : ""}`;
  setTimeout(() => {
    toast.className = "toast";
  }, 2600);
}

async function runAction(input: Readonly<Record<string, unknown>>): Promise<void> {
  try {
    await postJson("/api/action", input);
  } catch (error: unknown) {
    showToast(error instanceof Error ? error.message : "Action rejected", "error");
  }
}

function setupControls(): void {
  // Action Buttons
  byId<HTMLButtonElement>("fold-button").addEventListener("click", () => void runAction({ action: "fold" }));
  
  byId<HTMLButtonElement>("passive-button").addEventListener("click", () => {
    void runAction({ action: currentState?.allowedActions.canCall ? "call" : "check" });
  });

  byId<HTMLButtonElement>("raise-button").addEventListener("click", () => {
    const rawVal = byId<HTMLInputElement>("raise-amount").value.replace(/[^0-9]/g, "");
    void runAction({ action: "raise", amount: Number(rawVal) });
  });

  // Slider & Stepper
  const range = byId<HTMLInputElement>("raise-range");
  const amount = byId<HTMLInputElement>("raise-amount");

  const setRaiseValue = (val: number) => {
    if (!currentState || !currentState.allowedActions.canRaise) return;
    const clamped = Math.max(
      currentState.allowedActions.minRaiseTo,
      Math.min(currentState.allowedActions.maxRaiseTo, val)
    );
    range.value = String(clamped);
    amount.value = numberStr(clamped);
    byId<HTMLElement>("raise-btn-text").textContent = `Raise ${numberStr(clamped)}`;
  };

  range.addEventListener("input", () => {
    setRaiseValue(Number(range.value));
  });

  amount.addEventListener("input", () => {
    const parsed = parseInt(amount.value.replace(/[^0-9]/g, ""), 10);
    if (!Number.isNaN(parsed)) {
      setRaiseValue(parsed);
    }
  });

  // Preset Buttons
  byId<HTMLButtonElement>("btn-half-pot").addEventListener("click", () => {
    if (!currentState) return;
    const half = Math.floor(currentState.pot / 2);
    setRaiseValue(half);
  });

  byId<HTMLButtonElement>("btn-pot").addEventListener("click", () => {
    if (!currentState) return;
    setRaiseValue(currentState.pot);
  });

  byId<HTMLButtonElement>("btn-all-in").addEventListener("click", () => {
    if (!currentState) return;
    setRaiseValue(currentState.allowedActions.maxRaiseTo);
  });

  byId<HTMLButtonElement>("btn-minus").addEventListener("click", () => {
    if (!currentState) return;
    const cur = parseInt(amount.value.replace(/[^0-9]/g, ""), 10) || 0;
    setRaiseValue(cur - currentState.bigBlind);
  });

  byId<HTMLButtonElement>("btn-plus").addEventListener("click", () => {
    if (!currentState) return;
    const cur = parseInt(amount.value.replace(/[^0-9]/g, ""), 10) || 0;
    setRaiseValue(cur + currentState.bigBlind);
  });

  // Reset Table
  byId<HTMLButtonElement>("reset-button").addEventListener("click", async () => {
    try {
      await postJson("/api/reset");
      showToast("Table reset successfully.");
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Failed to reset table", "error");
    }
  });

  // Chat Submission
  byId<HTMLFormElement>("chat-form").addEventListener("submit", async event => {
    event.preventDefault();
    const input = byId<HTMLInputElement>("chat-input");
    const text = input.value.trim();
    if (!text) return;
    try {
      await postJson("/api/chat", { text });
      input.value = "";
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Message failed", "error");
    }
  });

  // Fullscreen
  byId<HTMLButtonElement>("fullscreen-btn").addEventListener("click", () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  });
}

async function fetchInitialState(): Promise<void> {
  const response = await fetch("/api/state", { headers: { Accept: "application/json" } });
  const value: unknown = await response.json();
  if (!response.ok || !isGameState(value)) throw new Error("Could not fetch game state");
  render(value);
}

function connectEvents(): void {
  const events = new EventSource("/api/events");
  events.addEventListener("open", () => {
    connectionHealthy = true;
  });
  events.addEventListener("error", () => {
    connectionHealthy = false;
  });
  events.addEventListener("state", (event: Event) => {
    if (!(event instanceof MessageEvent) || typeof event.data !== "string") return;
    try {
      const parsed: unknown = JSON.parse(event.data);
      if (isGameState(parsed)) render(parsed);
    } catch {
      showToast("Invalid state from server", "error");
    }
  });
}

async function boot(): Promise<void> {
  setupControls();
  try {
    await fetchInitialState();
    connectEvents();
  } catch (error: unknown) {
    showToast(error instanceof Error ? error.message : "Failed to connect", "error");
  }
}

void boot();
