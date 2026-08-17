import test from "node:test";
import assert from "node:assert/strict";
import { compareHandRanks, evaluateBest, evaluateFive } from "../dist/poker.js";
const C=(rank,suit)=>({rank,suit});
test("royal flush is straight flush",()=>{const r=evaluateFive([C(14,"S"),C(13,"S"),C(12,"S"),C(11,"S"),C(10,"S")]);assert.equal(r.category,8);assert.equal(r.values[0],14);});
test("wheel straight is five-high",()=>{const r=evaluateFive([C(14,"H"),C(2,"S"),C(3,"C"),C(4,"D"),C(5,"H")]);assert.equal(r.category,4);assert.equal(r.values[0],5);});
test("best of seven selects straight flush",()=>{const r=evaluateBest([C(9,"H"),C(8,"H"),C(7,"H"),C(6,"H"),C(5,"H"),C(14,"C"),C(14,"D")]);assert.equal(r.category,8);assert.equal(r.values[0],9);});
test("quads outrank full house",()=>{const q=evaluateFive([C(10,"S"),C(10,"H"),C(10,"D"),C(10,"C"),C(2,"S")]);const f=evaluateFive([C(14,"S"),C(14,"H"),C(14,"D"),C(13,"C"),C(13,"S")]);assert.equal(compareHandRanks(q,f),1);});
test("pair kickers break ties",()=>{const a=evaluateFive([C(8,"S"),C(8,"H"),C(14,"D"),C(7,"C"),C(3,"S")]);const k=evaluateFive([C(8,"D"),C(8,"C"),C(13,"D"),C(7,"S"),C(3,"H")]);assert.equal(compareHandRanks(a,k),1);});
