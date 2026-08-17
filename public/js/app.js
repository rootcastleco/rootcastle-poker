"use strict";
const suitGlyph = { S: "♠", H: "♥", D: "♦", C: "♣" };
const rankGlyph = { 11: "J", 12: "Q", 13: "K", 14: "A" };
let currentState = null;
let connectionHealthy = false;
function byId(id) { const element = document.getElementById(id); if (element === null)
    throw new Error(`Missing DOM element: ${id}`); return element; }
function money(value) { return `$${value.toLocaleString("en-US")}`; }
function isGameState(value) { if (typeof value !== "object" || value === null)
    return false; const c = value; return typeof c.tableName === "string" && Array.isArray(c.players) && Array.isArray(c.communityCards) && typeof c.pot === "number"; }
function renderCard(card, hidden = false, compact = false) { const el = document.createElement("div"); el.className = `card${compact ? " card--compact" : ""}`; if (hidden || card === null) {
    el.classList.add("card--back");
    const mark = document.createElement("span");
    mark.className = "card-back-mark";
    mark.textContent = "R";
    el.append(mark);
    return el;
} el.classList.add(card.suit === "H" || card.suit === "D" ? "card--red" : "card--black"); const rank = document.createElement("span"); rank.className = "card-rank"; rank.textContent = rankGlyph[card.rank] ?? String(card.rank); const suit = document.createElement("span"); suit.className = "card-suit"; suit.textContent = suitGlyph[card.suit]; el.append(rank, suit); return el; }
function makeBadge(text) { const el = document.createElement("span"); el.className = "seat-badge"; el.textContent = text; return el; }
function renderPlayers(state) { state.players.forEach((player, index) => { const seat = byId(`seat-${index}`); seat.className = `seat seat-${index}`; if (state.currentPlayerId === player.id)
    seat.classList.add("seat--turn"); if (player.id === state.humanPlayerId)
    seat.classList.add("seat--human"); if (player.status === "folded" || player.status === "out")
    seat.classList.add("seat--dim"); const avatar = seat.querySelector("[data-avatar]"), name = seat.querySelector("[data-name]"), stack = seat.querySelector("[data-stack]"), action = seat.querySelector("[data-action]"), badges = seat.querySelector("[data-badges]"), cards = seat.querySelector("[data-hole]"); if (avatar === null || name === null || stack === null || action === null || badges === null || cards === null)
    throw new Error(`Seat ${index} incomplete`); avatar.textContent = player.name.slice(0, 2).toUpperCase(); name.textContent = player.id === state.humanPlayerId ? "YOU" : player.name; stack.textContent = money(player.stack); action.textContent = player.lastAction; badges.replaceChildren(); if (player.isDealer)
    badges.append(makeBadge("D")); if (player.isSmallBlind)
    badges.append(makeBadge("SB")); if (player.isBigBlind)
    badges.append(makeBadge("BB")); if (player.status === "allin")
    badges.append(makeBadge("ALL-IN")); cards.replaceChildren(); for (let i = 0; i < player.cardCount; i += 1)
    cards.append(renderCard(player.holeCards?.[i] ?? null, player.holeCards === null, true)); }); }
function renderCommunity(state) { const board = byId("community-cards"); board.replaceChildren(); for (let index = 0; index < 5; index += 1) {
    const card = state.communityCards[index];
    if (card === undefined) {
        const p = document.createElement("div");
        p.className = "card card--placeholder";
        board.append(p);
    }
    else
        board.append(renderCard(card));
} }
function renderActions(state) { const a = state.allowedActions; const fold = byId("fold-button"), passive = byId("passive-button"), raise = byId("raise-button"), range = byId("raise-range"), amount = byId("raise-amount"), newHand = byId("new-hand-button"); fold.disabled = !a.canFold; passive.disabled = !(a.canCheck || a.canCall); passive.textContent = a.canCall ? `CALL ${money(a.callAmount)}` : "CHECK"; raise.disabled = !a.canRaise; newHand.disabled = !state.handComplete; if (a.canRaise) {
    range.min = String(a.minRaiseTo);
    range.max = String(a.maxRaiseTo);
    range.step = String(Math.max(1, state.bigBlind));
    const prior = Number(amount.value);
    const selected = Number.isFinite(prior) ? Math.max(a.minRaiseTo, Math.min(a.maxRaiseTo, prior)) : a.minRaiseTo;
    range.value = String(selected);
    amount.min = String(a.minRaiseTo);
    amount.max = String(a.maxRaiseTo);
    amount.value = String(selected);
    amount.disabled = false;
    range.disabled = false;
    raise.textContent = `RAISE TO ${money(selected)}`;
}
else {
    range.value = "0";
    amount.value = "0";
    amount.disabled = true;
    range.disabled = true;
    raise.textContent = "RAISE";
} }
function renderHistory(state) { const list = byId("history-list"); list.replaceChildren(); if (state.history.length === 0) {
    const e = document.createElement("p");
    e.className = "muted empty-row";
    e.textContent = "Henüz tamamlanan el yok.";
    list.append(e);
    return;
} for (const item of state.history.slice(0, 5)) {
    const row = document.createElement("div");
    row.className = "history-row";
    const hand = document.createElement("span");
    hand.textContent = `#${item.handNumber}`;
    const winner = document.createElement("span");
    winner.textContent = `${item.winners.join(" + ")} · ${item.description}`;
    const pot = document.createElement("strong");
    pot.textContent = money(item.pot);
    row.append(hand, winner, pot);
    list.append(row);
} }
function renderChat(state) { const list = byId("chat-list"); list.replaceChildren(); for (const msg of state.chat.slice(-10)) {
    const row = document.createElement("div");
    row.className = msg.system ? "chat-message chat-message--system" : "chat-message";
    const author = document.createElement("strong");
    author.textContent = `${msg.author}: `;
    const text = document.createElement("span");
    text.textContent = msg.text;
    row.append(author, text);
    list.append(row);
} list.scrollTop = list.scrollHeight; }
function render(state) { currentState = state; byId("table-name").textContent = state.tableName; byId("hand-number").textContent = `HAND #${state.handNumber}`; byId("blind-level").textContent = `${money(state.smallBlind)} / ${money(state.bigBlind)}`; byId("pot-value").textContent = money(state.pot); byId("street-value").textContent = state.street.toUpperCase(); byId("status-message").textContent = state.message; const human = state.players.find(p => p.id === state.humanPlayerId); byId("wallet-value").textContent = human === undefined ? "$0" : money(human.stack); byId("stat-hands").textContent = String(state.stats.handsPlayed); byId("stat-wins").textContent = String(state.stats.handsWon); byId("stat-biggest").textContent = money(state.stats.biggestPot); byId("stat-rate").textContent = `${(state.stats.handsPlayed === 0 ? 0 : state.stats.handsWon / state.stats.handsPlayed * 100).toFixed(0)}%`; renderCommunity(state); renderPlayers(state); renderActions(state); renderHistory(state); renderChat(state); renderConnection(); }
function renderConnection() { const el = byId("connection-status"); el.textContent = connectionHealthy ? "LIVE" : "RECONNECTING"; el.className = connectionHealthy ? "connection connection--ok" : "connection connection--bad"; }
async function postJson(path, body = {}) { const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) {
    let message = `HTTP ${response.status}`;
    if (typeof payload === "object" && payload !== null && "error" in payload) {
        const v = payload.error;
        if (typeof v === "string")
            message = v;
    }
    throw new Error(message);
} }
function showToast(message, kind = "info") { const toast = byId("toast"); toast.textContent = message; toast.className = `toast toast--visible${kind === "error" ? " toast--error" : ""}`; globalThis.setTimeout(() => { toast.className = "toast"; }, 2600); }
async function runAction(input) { try {
    await postJson("/api/action", input);
}
catch (error) {
    showToast(error instanceof Error ? error.message : "Aksiyon reddedildi.", "error");
} }
function setupControls() { byId("fold-button").addEventListener("click", () => void runAction({ action: "fold" })); byId("passive-button").addEventListener("click", () => void runAction({ action: currentState?.allowedActions.canCall ? "call" : "check" })); byId("raise-button").addEventListener("click", () => void runAction({ action: "raise", amount: Number(byId("raise-amount").value) })); byId("new-hand-button").addEventListener("click", async () => { try {
    await postJson("/api/new-hand");
}
catch (error) {
    showToast(error instanceof Error ? error.message : "Yeni el başlatılamadı.", "error");
} }); byId("reset-button").addEventListener("click", async () => { try {
    await postJson("/api/reset");
    showToast("Masa sıfırlandı.");
}
catch (error) {
    showToast(error instanceof Error ? error.message : "Masa sıfırlanamadı.", "error");
} }); const range = byId("raise-range"), amount = byId("raise-amount"); range.addEventListener("input", () => { amount.value = range.value; byId("raise-button").textContent = `RAISE TO ${money(Number(range.value))}`; }); amount.addEventListener("input", () => { const state = currentState; if (state === null || !state.allowedActions.canRaise)
    return; const value = Math.max(state.allowedActions.minRaiseTo, Math.min(state.allowedActions.maxRaiseTo, Number(amount.value) || 0)); range.value = String(value); byId("raise-button").textContent = `RAISE TO ${money(value)}`; }); byId("chat-form").addEventListener("submit", async (event) => { event.preventDefault(); const input = byId("chat-input"); const text = input.value.trim(); if (text.length === 0)
    return; try {
    await postJson("/api/chat", { text });
    input.value = "";
}
catch (error) {
    showToast(error instanceof Error ? error.message : "Mesaj gönderilemedi.", "error");
} }); }
async function fetchInitialState() { const response = await fetch("/api/state", { headers: { Accept: "application/json" } }); const value = await response.json(); if (!response.ok || !isGameState(value))
    throw new Error("Oyun durumu alınamadı."); render(value); }
function connectEvents() { const events = new EventSource("/api/events"); events.addEventListener("open", () => { connectionHealthy = true; renderConnection(); }); events.addEventListener("error", () => { connectionHealthy = false; renderConnection(); }); events.addEventListener("state", (event) => { if (!(event instanceof MessageEvent) || typeof event.data !== "string")
    return; try {
    const parsed = JSON.parse(event.data);
    if (isGameState(parsed))
        render(parsed);
}
catch {
    showToast("Sunucudan geçersiz durum alındı.", "error");
} }); }
async function boot() { setupControls(); try {
    await fetchInitialState();
    connectEvents();
}
catch (error) {
    connectionHealthy = false;
    renderConnection();
    showToast(error instanceof Error ? error.message : "Uygulama başlatılamadı.", "error");
} }
void boot();
