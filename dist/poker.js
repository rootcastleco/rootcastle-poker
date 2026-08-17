import { randomInt } from "node:crypto";
const HUMAN_ID = "you";
const STARTING_STACK = 1500;
const SUITS = ["S", "H", "D", "C"];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const CATEGORY_LABELS = ["High Card", "Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"];
function assertInvariant(condition, message) {
    if (!condition)
        throw new Error(`Invariant failed: ${message}`);
}
function itemAt(items, index, context) {
    const item = items[index];
    assertInvariant(item !== undefined, `${context}: index ${index} out of bounds`);
    return item;
}
function categoryLabel(index) {
    const label = CATEGORY_LABELS[index];
    assertInvariant(label !== undefined, `unknown hand category ${index}`);
    return label;
}
function compareNumbers(left, right) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        const l = left[index] ?? 0;
        const r = right[index] ?? 0;
        if (l !== r)
            return l > r ? 1 : -1;
    }
    return 0;
}
export function compareHandRanks(left, right) {
    return left.category === right.category ? compareNumbers(left.values, right.values) : left.category > right.category ? 1 : -1;
}
function detectStraightHigh(ranks) {
    const unique = [...new Set(ranks)].sort((a, b) => b - a);
    if (unique.includes(14))
        unique.push(1);
    let run = 1;
    for (let index = 1; index < unique.length; index += 1) {
        const previous = itemAt(unique, index - 1, "straight previous");
        const current = itemAt(unique, index, "straight current");
        if (previous - current === 1) {
            run += 1;
            if (run >= 5)
                return itemAt(unique, index - 4, "straight high");
        }
        else
            run = 1;
    }
    return null;
}
export function evaluateFive(cards) {
    assertInvariant(cards.length === 5, "evaluateFive requires exactly five cards");
    const ranks = cards.map(card => card.rank).sort((a, b) => b - a);
    const first = itemAt(cards, 0, "first card");
    const flush = cards.every(card => card.suit === first.suit);
    const straightHigh = detectStraightHigh(ranks);
    const counts = new Map();
    for (const rank of ranks)
        counts.set(rank, (counts.get(rank) ?? 0) + 1);
    const groups = [...counts.entries()].sort((a, b) => a[1] !== b[1] ? b[1] - a[1] : b[0] - a[0]);
    if (flush && straightHigh !== null)
        return { category: 8, values: [straightHigh], label: categoryLabel(8) };
    const four = groups.find(([, count]) => count === 4);
    if (four !== undefined)
        return { category: 7, values: [four[0], groups.find(([, count]) => count === 1)?.[0] ?? 0], label: categoryLabel(7) };
    const three = groups.find(([, count]) => count === 3);
    const pair = groups.find(([, count]) => count === 2);
    if (three !== undefined && pair !== undefined)
        return { category: 6, values: [three[0], pair[0]], label: categoryLabel(6) };
    if (flush)
        return { category: 5, values: ranks, label: categoryLabel(5) };
    if (straightHigh !== null)
        return { category: 4, values: [straightHigh], label: categoryLabel(4) };
    if (three !== undefined) {
        const kickers = groups.filter(([, count]) => count === 1).map(([rank]) => rank).sort((a, b) => b - a);
        return { category: 3, values: [three[0], ...kickers], label: categoryLabel(3) };
    }
    const pairs = groups.filter(([, count]) => count === 2).map(([rank]) => rank).sort((a, b) => b - a);
    if (pairs.length >= 2)
        return { category: 2, values: [itemAt(pairs, 0, "two pair high"), itemAt(pairs, 1, "two pair low"), groups.find(([, count]) => count === 1)?.[0] ?? 0], label: categoryLabel(2) };
    if (pairs.length === 1) {
        const kickers = groups.filter(([, count]) => count === 1).map(([rank]) => rank).sort((a, b) => b - a);
        return { category: 1, values: [itemAt(pairs, 0, "pair"), ...kickers], label: categoryLabel(1) };
    }
    return { category: 0, values: ranks, label: categoryLabel(0) };
}
function chooseFive(items) {
    assertInvariant(items.length >= 5, "chooseFive requires at least five items");
    const result = [];
    const n = items.length;
    for (let a = 0; a < n - 4; a += 1)
        for (let b = a + 1; b < n - 3; b += 1)
            for (let c = b + 1; c < n - 2; c += 1)
                for (let d = c + 1; d < n - 1; d += 1)
                    for (let e = d + 1; e < n; e += 1) {
                        result.push([itemAt(items, a, "combination a"), itemAt(items, b, "combination b"), itemAt(items, c, "combination c"), itemAt(items, d, "combination d"), itemAt(items, e, "combination e")]);
                    }
    return result;
}
export function evaluateBest(cards) {
    assertInvariant(cards.length >= 5 && cards.length <= 7, "evaluateBest requires five to seven cards");
    let best = null;
    for (const combination of chooseFive(cards)) {
        const candidate = evaluateFive(combination);
        if (best === null || compareHandRanks(candidate, best) > 0)
            best = candidate;
    }
    assertInvariant(best !== null, "best hand must exist");
    return best;
}
function buildDeck() { const deck = []; for (const suit of SUITS)
    for (const rank of RANKS)
        deck.push({ rank, suit }); return deck; }
function shuffleDeck(deck) { for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    const tmp = itemAt(deck, index, "shuffle source");
    deck[index] = itemAt(deck, swap, "shuffle target");
    deck[swap] = tmp;
} }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export class PokerGame {
    players;
    deck = [];
    communityCards = [];
    street = "showdown";
    dealerIndex = -1;
    smallBlindIndex = -1;
    bigBlindIndex = -1;
    currentPlayerIndex = null;
    currentBet = 0;
    minRaise = 20;
    handNumber = 1000;
    message = "Yeni el için hazır.";
    handComplete = true;
    smallBlind = 10;
    bigBlind = 20;
    history = [];
    chat = [];
    chatSequence = 1;
    humanWins = 0;
    handsPlayed = 0;
    biggestPot = 0;
    botTimer = null;
    subscribers = new Set();
    constructor() {
        this.players = [
            { id: HUMAN_ID, name: "Cossack", isBot: false, stack: 3460, holeCards: [], streetBet: 0, totalCommitted: 0, status: "active", acted: false, lastAction: "" },
            { id: "bot-1", name: "Byte", isBot: true, stack: 1560, holeCards: [], streetBet: 0, totalCommitted: 0, status: "active", acted: false, lastAction: "" },
            { id: "bot-2", name: "LeoCat", isBot: true, stack: 1280, holeCards: [], streetBet: 0, totalCommitted: 0, status: "active", acted: false, lastAction: "" },
            { id: "bot-3", name: "Mira", isBot: true, stack: 980, holeCards: [], streetBet: 0, totalCommitted: 0, status: "active", acted: false, lastAction: "" },
            { id: "bot-4", name: "Shadow88", isBot: true, stack: 2340, holeCards: [], streetBet: 0, totalCommitted: 0, status: "active", acted: false, lastAction: "" },
            { id: "bot-5", name: "Anatolia", isBot: true, stack: 1840, holeCards: [], streetBet: 0, totalCommitted: 0, status: "active", acted: false, lastAction: "" }
        ];
        this.chat = [
            { id: 1, author: "LeoCat", text: "Nice hand! 🤝", system: false },
            { id: 2, author: "PokerWolf", text: "GL everyone", system: false },
            { id: 3, author: "Shadow88", text: "That was close!", system: false },
            { id: 4, author: "Mira", text: "Folded...", system: false },
            { id: 5, author: "Byte", text: "Anyone for turbo?", system: false },
            { id: 6, author: "Anatolia", text: "Selam herkese!", system: false },
            { id: 7, author: "System", text: "Cossack won the pot (2,400) with Two Pair.", system: true }
        ];
        this.chatSequence = 8;
        this.history = [
            { handNumber: 11, winners: ["Cossack"], pot: 2940, description: "Two Pair" },
            { handNumber: 10, winners: ["Mira"], pot: 1820, description: "Straight" },
            { handNumber: 9, winners: ["Byte"], pot: 3100, description: "Flush" },
            { handNumber: 8, winners: ["Shadow88"], pot: 980, description: "Pair" },
            { handNumber: 7, winners: ["Anatolia"], pot: 1200, description: "High Card" }
        ];
        this.startHand();
    }
    subscribe(listener) { this.subscribers.add(listener); listener(this.getPublicState()); return () => { this.subscribers.delete(listener); }; }
    getPublicState() {
        const revealBots = this.street === "showdown" || this.handComplete;
        return { tableName: "Texas Hold'em No Limit $10 / $20 Table #12", handNumber: this.handNumber, street: this.street, smallBlind: this.smallBlind, bigBlind: this.bigBlind, pot: this.getPot(), communityCards: [...this.communityCards],
            players: this.players.map((player, index) => ({ id: player.id, name: player.name, isBot: player.isBot, stack: player.stack, streetBet: player.streetBet, status: player.status, lastAction: player.lastAction, cardCount: player.holeCards.length, holeCards: player.id === HUMAN_ID || (revealBots && player.status !== "folded") ? [...player.holeCards] : null, isDealer: index === this.dealerIndex, isSmallBlind: index === this.smallBlindIndex, isBigBlind: index === this.bigBlindIndex })),
            currentPlayerId: this.currentPlayerIndex === null ? null : this.players[this.currentPlayerIndex]?.id ?? null, humanPlayerId: HUMAN_ID, message: this.message, handComplete: this.handComplete, allowedActions: this.getAllowedActions(HUMAN_ID), history: [...this.history], chat: [...this.chat],
            humanHandRank: this.getHumanHandRank(),
            handOdds: this.getHandOdds(),
            stats: { handsPlayed: this.handsPlayed, handsWon: this.humanWins, biggestPot: this.biggestPot } };
    }
    getHumanHandRank() {
        const human = this.players.find(p => p.id === HUMAN_ID);
        if (!human || human.holeCards.length < 2)
            return null;
        if (this.communityCards.length >= 3) {
            const best = evaluateBest([...human.holeCards, ...this.communityCards]);
            return best.label;
        }
        if (human.holeCards[0]?.rank === human.holeCards[1]?.rank)
            return "Pair";
        return "High Card";
    }
    getHandOdds() {
        const human = this.players.find(p => p.id === HUMAN_ID);
        if (!human || human.holeCards.length < 2)
            return { twoPair: 78, fullHouse: 12, trips: 6, straight: 3, other: 1 };
        if (this.communityCards.length === 0) {
            const isPair = human.holeCards[0]?.rank === human.holeCards[1]?.rank;
            return isPair ? { twoPair: 78, fullHouse: 12, trips: 6, straight: 3, other: 1 } : { twoPair: 42, fullHouse: 4, trips: 14, straight: 26, other: 14 };
        }
        const best = evaluateBest([...human.holeCards, ...this.communityCards]);
        switch (best.category) {
            case 2: return { twoPair: 78, fullHouse: 16, trips: 0, straight: 4, other: 2 };
            case 6: return { twoPair: 10, fullHouse: 85, trips: 0, straight: 0, other: 5 };
            case 3: return { twoPair: 12, fullHouse: 28, trips: 55, straight: 3, other: 2 };
            case 4: return { twoPair: 5, fullHouse: 2, trips: 3, straight: 88, other: 2 };
            case 5: return { twoPair: 3, fullHouse: 2, trips: 2, straight: 3, other: 90 };
            case 1: return { twoPair: 54, fullHouse: 8, trips: 18, straight: 12, other: 8 };
            default: return { twoPair: 32, fullHouse: 3, trips: 9, straight: 24, other: 32 };
        }
    }
    performHumanAction(input) { if (this.handComplete)
        throw new Error("El tamamlandı. Yeni el başlatın."); const index = this.players.findIndex(p => p.id === HUMAN_ID); if (this.currentPlayerIndex !== index)
        throw new Error("Şu an sıra sizde değil."); this.performAction(index, input); }
    addHumanChat(text) { const normalized = text.trim().replace(/\s+/g, " "); if (normalized.length === 0 || normalized.length > 120)
        throw new Error("Mesaj 1-120 karakter olmalıdır."); this.chat.push({ id: this.chatSequence, author: "You", text: normalized, system: false }); this.chatSequence += 1; this.trimChat(); this.notify(); }
    startHand() {
        this.clearBotTimer();
        this.ensurePlayableStacks();
        if (this.players.filter(p => p.stack > 0).length < 2) {
            this.resetTable();
            return;
        }
        this.handNumber += 1;
        this.handsPlayed += 1;
        this.deck = buildDeck();
        shuffleDeck(this.deck);
        this.communityCards = [];
        this.street = "preflop";
        this.handComplete = false;
        this.currentBet = 0;
        this.minRaise = this.bigBlind;
        this.message = `El #${this.handNumber} başladı.`;
        for (const player of this.players) {
            player.holeCards = [];
            player.streetBet = 0;
            player.totalCommitted = 0;
            player.status = player.stack > 0 ? "active" : "out";
            player.acted = false;
            player.lastAction = "";
        }
        this.dealerIndex = this.nextIndexWithChips(this.dealerIndex);
        this.smallBlindIndex = this.nextIndexWithChips(this.dealerIndex);
        this.bigBlindIndex = this.nextIndexWithChips(this.smallBlindIndex);
        this.dealHoleCards();
        this.postBlind(this.smallBlindIndex, this.smallBlind, "SB");
        this.postBlind(this.bigBlindIndex, this.bigBlind, "BB");
        this.currentBet = Math.max(this.players[this.smallBlindIndex]?.streetBet ?? 0, this.players[this.bigBlindIndex]?.streetBet ?? 0);
        this.currentPlayerIndex = this.nextActionIndex(this.bigBlindIndex);
        this.addSystemChat(`El #${this.handNumber} başladı. Kör bahisler ${this.smallBlind}/${this.bigBlind}.`);
        this.notifyAndScheduleBot();
    }
    resetTable() { this.clearBotTimer(); for (const p of this.players)
        p.stack = STARTING_STACK; this.dealerIndex = -1; this.history.splice(0); this.humanWins = 0; this.handsPlayed = 0; this.biggestPot = 0; this.message = "Masa sıfırlandı."; this.addSystemChat("Masa sıfırlandı; tüm oyuncular 1.500 çiple başladı."); this.startHand(); }
    ensurePlayableStacks() { if (this.players.filter(p => p.stack > 0).length >= 2)
        return; for (const p of this.players)
        p.stack = STARTING_STACK; }
    dealHoleCards() { for (let round = 0; round < 2; round += 1)
        for (let offset = 1; offset <= this.players.length; offset += 1) {
            const index = (this.dealerIndex + offset) % this.players.length;
            const player = this.players[index];
            if (player !== undefined && player.status !== "out")
                player.holeCards.push(this.drawCard());
        } }
    drawCard() { const card = this.deck.pop(); assertInvariant(card !== undefined, "deck exhausted"); return card; }
    postBlind(index, requested, label) { const player = this.players[index]; assertInvariant(player !== undefined, "blind player must exist"); const paid = Math.min(requested, player.stack); player.stack -= paid; player.streetBet += paid; player.totalCommitted += paid; player.lastAction = `${label} ${paid}`; if (player.stack === 0)
        player.status = "allin"; }
    performAction(index, input) {
        const player = this.players[index];
        assertInvariant(player !== undefined, "acting player must exist");
        if (player.status !== "active")
            throw new Error("Bu oyuncu aksiyon alamaz.");
        const callAmount = Math.max(0, this.currentBet - player.streetBet);
        if (input.action === "fold") {
            player.status = "folded";
            player.acted = true;
            player.lastAction = "Fold";
        }
        else if (input.action === "check") {
            if (callAmount !== 0)
                throw new Error("Check yapılamaz; karşılanması gereken bahis var.");
            player.acted = true;
            player.lastAction = "Check";
        }
        else if (input.action === "call") {
            if (callAmount <= 0)
                throw new Error("Call gerekmiyor; check yapabilirsiniz.");
            const paid = Math.min(callAmount, player.stack);
            this.commitChips(player, paid);
            player.acted = true;
            player.lastAction = paid < callAmount ? `All-in ${paid}` : `Call ${paid}`;
        }
        else {
            const requested = input.amount;
            if (requested === undefined || !Number.isInteger(requested))
                throw new Error("Raise miktarı tam sayı olmalıdır.");
            const maximum = player.streetBet + player.stack;
            if (requested <= this.currentBet || requested > maximum)
                throw new Error("Raise miktarı geçersiz.");
            const minimum = this.currentBet === 0 ? this.bigBlind : this.currentBet + this.minRaise;
            if (requested < minimum && requested !== maximum)
                throw new Error(`Minimum raise toplamı ${minimum}.`);
            const previous = this.currentBet;
            this.commitChips(player, requested - player.streetBet);
            this.currentBet = player.streetBet;
            const raiseSize = this.currentBet - previous;
            if (raiseSize >= this.minRaise)
                this.minRaise = raiseSize;
            for (const other of this.players)
                if (other.id !== player.id && other.status === "active")
                    other.acted = false;
            player.acted = true;
            player.lastAction = player.stack === 0 ? `All-in ${this.currentBet}` : `Raise ${this.currentBet}`;
        }
        this.message = `${player.name}: ${player.lastAction}`;
        this.afterAction(index);
    }
    commitChips(player, amount) { if (!Number.isInteger(amount) || amount < 0 || amount > player.stack)
        throw new Error("Çip aktarımı geçersiz."); player.stack -= amount; player.streetBet += amount; player.totalCommitted += amount; if (player.stack === 0 && player.status === "active")
        player.status = "allin"; }
    afterAction(previousIndex) { const contenders = this.players.filter(p => p.status !== "folded" && p.status !== "out"); if (contenders.length === 1) {
        this.awardByFold(itemAt(contenders, 0, "fold winner"));
        return;
    } if (this.isBettingRoundComplete()) {
        this.advanceStreet();
        return;
    } this.currentPlayerIndex = this.nextActionIndex(previousIndex); if (this.currentPlayerIndex === null) {
        this.advanceStreet();
        return;
    } this.notifyAndScheduleBot(); }
    isBettingRoundComplete() { const actors = this.players.filter(p => p.status === "active"); return actors.length === 0 || actors.every(p => p.acted && p.streetBet === this.currentBet); }
    advanceStreet() {
        for (const p of this.players) {
            p.streetBet = 0;
            if (p.status === "active")
                p.acted = false;
        }
        this.currentBet = 0;
        this.minRaise = this.bigBlind;
        if (this.street === "preflop") {
            this.street = "flop";
            this.communityCards.push(this.drawCard(), this.drawCard(), this.drawCard());
        }
        else if (this.street === "flop") {
            this.street = "turn";
            this.communityCards.push(this.drawCard());
        }
        else if (this.street === "turn") {
            this.street = "river";
            this.communityCards.push(this.drawCard());
        }
        else {
            this.showdown();
            return;
        }
        this.message = `${this.street.toUpperCase()} açıldı.`;
        this.currentPlayerIndex = this.nextActionIndex(this.dealerIndex);
        if (this.currentPlayerIndex === null) {
            this.advanceStreet();
            return;
        }
        this.notifyAndScheduleBot();
    }
    showdown() {
        this.clearBotTimer();
        this.street = "showdown";
        this.currentPlayerIndex = null;
        const totalPot = this.getPot();
        this.biggestPot = Math.max(this.biggestPot, totalPot);
        const contenders = this.players.filter(p => p.status !== "folded" && p.status !== "out");
        assertInvariant(contenders.length >= 1, "showdown contenders");
        const paid = new Set();
        let bestDescription = "";
        for (const side of this.buildSidePots()) {
            let best = null;
            let winners = [];
            for (const p of side.eligible) {
                const rank = evaluateBest([...p.holeCards, ...this.communityCards]);
                if (best === null || compareHandRanks(rank, best) > 0) {
                    best = rank;
                    winners = [p];
                }
                else if (compareHandRanks(rank, best) === 0)
                    winners.push(p);
            }
            assertInvariant(best !== null && winners.length > 0, "side pot winner");
            bestDescription = best.label;
            const share = Math.floor(side.amount / winners.length);
            let remainder = side.amount - share * winners.length;
            for (const w of winners) {
                w.stack += share + (remainder > 0 ? 1 : 0);
                if (remainder > 0)
                    remainder -= 1;
                paid.add(w.id);
            }
        }
        const names = this.players.filter(p => paid.has(p.id)).map(p => p.name);
        if (paid.has(HUMAN_ID))
            this.humanWins += 1;
        this.message = `${names.join(" + ")} kazandı · ${bestDescription} · Pot ${totalPot}`;
        this.history.unshift({ handNumber: this.handNumber, winners: names, pot: totalPot, description: bestDescription });
        if (this.history.length > 8)
            this.history.length = 8;
        this.handComplete = true;
        this.addSystemChat(this.message);
        this.notify();
    }
    awardByFold(winner) { this.clearBotTimer(); const pot = this.getPot(); winner.stack += pot; if (winner.id === HUMAN_ID)
        this.humanWins += 1; this.biggestPot = Math.max(this.biggestPot, pot); this.street = "showdown"; this.currentPlayerIndex = null; this.handComplete = true; this.message = `${winner.name}, diğer oyuncular fold ettiği için ${pot} kazandı.`; this.history.unshift({ handNumber: this.handNumber, winners: [winner.name], pot, description: "Uncontested" }); if (this.history.length > 8)
        this.history.length = 8; this.addSystemChat(this.message); this.notify(); }
    buildSidePots() { const levels = [...new Set(this.players.map(p => p.totalCommitted).filter(a => a > 0))].sort((a, b) => a - b); const pots = []; let previous = 0; for (const level of levels) {
        const contributors = this.players.filter(p => p.totalCommitted >= level);
        const amount = (level - previous) * contributors.length;
        const eligible = contributors.filter(p => p.status !== "folded" && p.status !== "out");
        if (amount > 0 && eligible.length > 0)
            pots.push({ amount, eligible });
        previous = level;
    } return pots; }
    getAllowedActions(playerId) { const player = this.players.find(p => p.id === playerId); if (player === undefined || this.handComplete || this.currentPlayerIndex === null || this.players[this.currentPlayerIndex]?.id !== playerId || player.status !== "active")
        return { canFold: false, canCheck: false, canCall: false, canRaise: false, callAmount: 0, minRaiseTo: 0, maxRaiseTo: 0 }; const call = Math.max(0, this.currentBet - player.streetBet); const max = player.streetBet + player.stack; const min = this.currentBet === 0 ? this.bigBlind : this.currentBet + this.minRaise; const canRaise = max > this.currentBet; return { canFold: true, canCheck: call === 0, canCall: call > 0 && player.stack > 0, canRaise, callAmount: Math.min(call, player.stack), minRaiseTo: canRaise ? Math.min(min, max) : 0, maxRaiseTo: canRaise ? max : 0 }; }
    nextIndexWithChips(from) { for (let offset = 1; offset <= this.players.length; offset += 1) {
        const index = (from + offset + this.players.length) % this.players.length;
        if ((this.players[index]?.stack ?? 0) > 0)
            return index;
    } throw new Error("Çip sahibi oyuncu bulunamadı."); }
    nextActionIndex(from) { for (let offset = 1; offset <= this.players.length; offset += 1) {
        const index = (from + offset + this.players.length) % this.players.length;
        const p = this.players[index];
        if (p !== undefined && p.status === "active" && (!p.acted || p.streetBet < this.currentBet))
            return index;
    } return null; }
    getPot() { return this.players.reduce((sum, p) => sum + p.totalCommitted, 0); }
    scheduleBot() { this.clearBotTimer(); if (this.handComplete || this.currentPlayerIndex === null)
        return; const p = this.players[this.currentPlayerIndex]; if (p === undefined || !p.isBot || p.status !== "active")
        return; this.botTimer = globalThis.setTimeout(() => { this.botTimer = null; this.performBotAction(); }, 420 + randomInt(480)); }
    performBotAction() { if (this.handComplete || this.currentPlayerIndex === null)
        return; const index = this.currentPlayerIndex; const p = this.players[index]; if (p === undefined || !p.isBot || p.status !== "active")
        return; const allowed = this.getAllowedActions(p.id); const strength = this.estimateBotStrength(p); const random = randomInt(1000) / 1000; if (allowed.callAmount > 0) {
        const pressure = allowed.callAmount / Math.max(1, p.stack + allowed.callAmount);
        if (strength + random * .32 < pressure + .24) {
            this.performAction(index, { action: "fold" });
            return;
        }
        if (allowed.canRaise && strength > .68 && random > .56) {
            this.performAction(index, { action: "raise", amount: clamp(allowed.minRaiseTo + this.bigBlind * (1 + randomInt(4)), allowed.minRaiseTo, allowed.maxRaiseTo) });
            return;
        }
        this.performAction(index, { action: "call" });
        return;
    } if (allowed.canRaise && strength > .62 && random > .64) {
        this.performAction(index, { action: "raise", amount: clamp(allowed.minRaiseTo + this.bigBlind * randomInt(4), allowed.minRaiseTo, allowed.maxRaiseTo) });
        return;
    } this.performAction(index, { action: "check" }); }
    estimateBotStrength(player) { if (this.communityCards.length >= 3) {
        const rank = evaluateBest([...player.holeCards, ...this.communityCards]);
        return clamp(.18 + rank.category * .105 + (rank.values[0] ?? 2) / 160, .15, .98);
    } const first = player.holeCards[0], second = player.holeCards[1]; if (first === undefined || second === undefined)
        return .2; const high = Math.max(first.rank, second.rank), low = Math.min(first.rank, second.rank); let score = (high + low) / 34; if (first.rank === second.rank)
        score += .28; if (first.suit === second.suit)
        score += .06; if (Math.abs(first.rank - second.rank) <= 2)
        score += .05; return clamp(score, .12, .95); }
    notifyAndScheduleBot() { this.notify(); this.scheduleBot(); }
    notify() { const state = this.getPublicState(); for (const listener of this.subscribers)
        listener(state); }
    clearBotTimer() { if (this.botTimer !== null) {
        globalThis.clearTimeout(this.botTimer);
        this.botTimer = null;
    } }
    addSystemChat(text) { this.chat.push({ id: this.chatSequence, author: "Dealer", text, system: true }); this.chatSequence += 1; this.trimChat(); }
    trimChat() { if (this.chat.length > 20)
        this.chat.splice(0, this.chat.length - 20); }
}
