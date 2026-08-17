# Acceptance criteria

- [x] `tsc -p tsconfig.server.json` exits 0.
- [x] `tsc -p tsconfig.client.json` exits 0.
- [x] Poker evaluator unit test suite exits 0.
- [ ] Browser screenshot fidelity check: blocked by managed Chromium URL policy in the build environment; repeat externally.
- [x] Client cannot receive hidden bot cards before showdown.
- [x] Server validates fold/check/call/raise and chip bounds.
- [x] Pot and payouts are server computed, including side pots.
- [x] SSE publishes state changes; REST handles commands.
- [x] Responsive CSS includes desktop/tablet/mobile breakpoints.
