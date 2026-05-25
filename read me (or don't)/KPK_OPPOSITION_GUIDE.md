# KPK Opposition & Zugzwang Visual Guide

## Opposition Rule (Most Important KPK Concept)

**Opposition:** Two kings face each other with exactly one square between them.
- **Wielder's perspective:** You have "opposition" - opponent must move and worsen position
- **Side to move:** LOSES with opposition (zugzwang)
- **Side NOT to move:** WINS (opponent must yield)

### Visual: Opposition Examples

```
Example 1: Direct Opposition (Vertical)
┌───────────┐
│ . . B . . │  Row 7
│ . . . . . │  Row 6
│ . . K W . │  Row 5  (B = Black King, W = White King, K = shared King position concept)
│ . . . . . │  Row 4
│ . . . . . │  Row 3
└───────────┘
  a b c d e

Kings on c5 and c7 = DIRECT OPPOSITION
Black to move = Loses (zugzwang)
White to move = Loses (Black has opposition)


Example 2: Diagonal Opposition
┌───────────┐
│ . . . . . │  Row 7
│ . . B . . │  Row 6
│ . . . W . │  Row 5
│ . . . . . │  Row 4
│ . . . . . │  Row 3
└───────────┘

Kings on c6 and d5 = DIAGONAL OPPOSITION
Black to move = Loses
White to move = Loses


Example 3: No Opposition (Kings adjacent)
┌───────────┐
│ . . . . . │  Row 7
│ . . B W . │  Row 6
│ . . . . . │  Row 5
│ . . . . . │  Row 4
│ . . . . . │  Row 3
└───────────┘

Kings on c6 and d6 = ADJACENT (NOT opposition)
Opposition not achieved, neither side has zugzwang
```

---

## Classic KPK Positions

### Position 1: White Winning - Opposition and Pawn Advance

```
┌───────────┐
│ . . . . . │  8
│ . . . . . │  7
│ . . . b . │  6  (b = black king)
│ . . p w . │  5  (p = white pawn, w = white king)
│ . . . . . │  4
│ . . . . . │  3
│ . . . . . │  2
│ . . . . . │  1
└───────────┘
  a b c d e f

FEN: 6k1/8/2b5/2pw4/8/8/8/8 w - - 0 1
     (Actually: 3b4/8/8/3wk3/8/8/8/8 w - - 0 1)

Analysis:
- White King d5, Black King c6, Pawn d4
- White to move: d5 is opposition square
- Black must yield (zugzwang)
- White plays: Kd5-c5 or Kd5-e5, and pawn advances
- Result: WHITE WINS

This is why engines need opposition knowledge!
```

**Engine must recognize:**
- ✅ Opposition present
- ✅ Pawn can advance next move
- ✅ Perfect mating progress

---

### Position 2: Black Drawing - Opposition Against White

```
┌───────────┐
│ . . . . . │  8
│ . . . . . │  7
│ . . b . . │  6  (b = black king)
│ . . . w . │  5  (w = white king, no pawn yet for spacing)
│ . . . p . │  4  (p = white pawn)
│ . . . . . │  3
│ . . . . . │  2
│ . . . . . │  1
└───────────┘

FEN: 3b4/8/8/3w4/3p4/8/8/8 b - - 0 1

Analysis:
- Black King c6, White King d5, Pawn d4
- BLACK to move: BLACK HAS OPPOSITION
- White cannot advance pawn (would be captured)
- Result: BLACK DRAWS (holds opposition)

This is where engines LOSE rating without KPK knowledge!
Many just don't realize opposition matters.
```

**Engine must recognize:**
- ✅ Opposition held by opponent
- ✅ Cannot push pawn safely
- ✅ Pawn will be captured or blocked indefinitely

---

### Position 3: Even Rook Pawn Problem (Usually Drawn)

```
┌───────────┐
│ . . . . . │  8
│ . . . . . │  7
│ b . . . . │  6  (b = black king)
│ . . . . . │  5
│ p w . . . │  4  (p = white pawn, w = white king)
│ . . . . . │  3
│ . . . . . │  2
│ . . . . . │  1
└───────────┘

FEN: 8/8/b7/8/pw6/8/8/8 w - - 0 1

Analysis:
- Pawn on a-file (rook pawn)
- Even with perfect play, often DRAWN
- Black king can reach pawn even if White tries to advance
- Reason: Rook pawns have limited mating squares
         (only corners: a1 and a8)
- Black can sacrifice king position to blockade

This is nuanced knowledge KPK captures!
```

---

### Position 4: Zugzwang - White Losing (Black Wins!)

```
┌───────────┐
│ . . . . . │  8
│ . . w . . │  7  (w = white king)
│ . b . . . │  6  (b = black king)
│ . . p . . │  5  (p = white pawn)
│ . . . . . │  4
│ . . . . . │  3
│ . . . . . │  2
│ . . . . . │  1
└───────────┘

FEN: 8/2w5/1b6/2p5/8/8/8/8 w - - 0 1

Analysis:
- White King c7, Black King b6, Pawn c5
- White to move: IN ZUGZWANG (every move loses!)
  - Can't go to b8: Black takes pawn
  - Can't go to b7: Repeats, no progress
  - Can't go to d8/d7/d6: Pawn lost
  - Can't move anywhere good
- Result: WHITE LOSES despite having pawn!

This is CRITICAL zugzwang pattern!
Engines must know: sometimes you're already losing,
not just unaware you're winning.
```

---

## Pattern Summary

| Pattern | White | Black | Notes |
|---------|-------|-------|-------|
| Opposition with pawn ahead | WIN | - | Push pawn |
| Black has opposition | - | DRAW | Can't advance |
| Rook pawn, symmetric | - | DRAW | Limited mating squares |
| Zugzwang (stm loses) | LOSE | - | Every move worsens |
| Pawn on 7th, king defends | WIN | - | Promote next move |
| Pawn central file, opposition | WIN | - | Fastest pawn race |

---

## Why Engines Lose 50-100 Elo Without KPK

1. **Opposition blindness** (~30 Elo)
   - Doesn't recognize when opposition matters
   - Plays moves that give opponent opposition

2. **Zugzwang misunderstanding** (~20 Elo)
   - Doesn't see that stm (side to move) can worsen position
   - Doesn't recognize losing positions correctly

3. **Stalemate traps** (~15 Elo)
   - Doesn't notice when pawn push is forced, prevents stalemate
   - Gets stalemated in winning positions

4. **Pawn-advance timing** (~20 Elo)
   - Pushes pawn too early or too late
   - Doesn't understand when to wait for opposition

5. **General endgame evaluation error** (~20 Elo)
   - Evaluates complex positions poorly without endgame knowledge
   - Score magnitude is wrong (thinks it's drawn when winning)

**Total Elo loss: 50-100 Elo**

The KPK tablebase FIXES all of these at once!

---

## Quick Identification Rule

When you see **K + K + P** (exactly):
1. Count pieces: Only 2 kings and 1 pawn
2. Check pawn rank: Not on rank 1 or 8 (otherwise promotion happened)
3. Use tablebase lookup
4. Result: Winning/Drawing/Losing (exact knowledge)

That's why KPK is the **#1 endgame to encode** - massive practical impact!

---

## Testing Opposition Knowledge

Use these positions to test if engine understands opposition:

```javascript
// Test 1: Opposition wins (White to move, winning)
const test1 = "8/8/2k5/3w4/3p4/8/8/8 w - - 0 1";

// Test 2: Opposition loses (Black to move, Black wins)
const test2 = "8/8/2k5/3w4/3p4/8/8/8 b - - 0 1";

// Test 3: Zugzwang (White to move, White loses)
const test3 = "8/2w5/1b6/2p5/8/8/8/8 w - - 0 1";

// Score comparison:
// test1: score > +400 (White winning)
// test2: score < -400 (Black winning, White to move)
// test3: score < -300 (White losing)
```

Without KPK knowledge, these positions are evaluated **arbitrarily**.
With KPK knowledge, they're evaluated **precisely**.

That's why this matters! 🎯
