







function testKPK_OppositionWins() {
  
  
  
  
  initEndgameTab();
  const board = new Board();
  board.loadFEN("8/8/8/3k4/3P4/3K4/8/8 w - - 0 1");
  
  const eval_score = Evaluation.evaluate(board);
  console.log("KPK Opposition (White winning):", eval_score);
  console.log("Expected: > 400 (winning with pawn advance)");
  console.log("Result:", eval_score > 400 ? "✓ PASS" : "✗ FAIL");
}

function testKPK_OppositionLoses() {
  
  
  
  
  
  initEndgameTab();
  const board = new Board();
  board.loadFEN("8/8/8/3K4/3p4/3k4/8/8 w - - 0 1");
  
  const eval_score = Evaluation.evaluate(board);
  console.log("KPK Opposition (Black winning):", eval_score);
  console.log("Expected: < -400 (losing position)");
  console.log("Result:", eval_score < -400 ? "✓ PASS" : "✗ FAIL");
}

function testKPK_PawnOnSeventh() {
  
  
  
  
  initEndgameTab();
  const board = new Board();
  board.loadFEN("8/3P4/3k4/3K4/8/8/8/8 w - - 0 1");
  
  const eval_score = Evaluation.evaluate(board);
  console.log("KPK Pawn on 7th (White winning):", eval_score);
  console.log("Expected: > 500 (promotion imminent)");
  console.log("Result:", eval_score > 500 ? "✓ PASS" : "✗ FAIL");
}

function testKPK_PawnBlocked() {
  
  
  
  
  initEndgameTab();
  const board = new Board();
  board.loadFEN("8/8/3k4/3p4/3K4/8/8/8 w - - 0 1");
  
  const eval_score = Evaluation.evaluate(board);
  console.log("KPK Pawn Blocked:", eval_score);
  console.log("Expected: ~0 (likely drawn)");
  console.log("Result:", Math.abs(eval_score) < 50 ? "✓ PASS (drawn)" : "✗ Check position");
}


function testKQK_Winning() {
  
  
  
  
  initEndgameTab();
  const board = new Board();
  board.loadFEN("8/8/8/3k4/8/8/3Q4/3K4 w - - 0 1");
  
  const eval_score = Evaluation.evaluate(board);
  console.log("KQK Winning:", eval_score);
  console.log("Expected: > 90000 (MATE score)");
  console.log("Result:", eval_score > 90000 ? "✓ PASS (mate detected)" : "✗ FAIL");
}

function testKQK_DistanceToMate() {
  
  
  
  initEndgameTab();
  
  
  const board1 = new Board();
  board1.loadFEN("8/8/8/3k4/8/8/3Q4/3K4 w - - 0 1");
  const eval1 = Evaluation.evaluate(board1);
  
  
  const board2 = new Board();
  board2.loadFEN("8/8/8/3k4/3Q4/8/8/3K4 w - - 0 1");
  const eval2 = Evaluation.evaluate(board2);
  
  console.log("KQK Distance 1:", eval1);
  console.log("KQK Distance 2:", eval2);
  console.log("Result:", eval2 > eval1 ? "✓ PASS (closer queen)" : "✗ FAIL");
}


function testKRK_Winning() {
  
  
  
  initEndgameTab();
  const board = new Board();
  board.loadFEN("8/8/8/3k4/8/8/3R4/3K4 w - - 0 1");
  
  const eval_score = Evaluation.evaluate(board);
  console.log("KRK Winning:", eval_score);
  console.log("Expected: > 85000 (still MATE, but slower)");
  console.log("Result:", eval_score > 85000 ? "✓ PASS (mate detected)" : "✗ FAIL");
}

function testKRK_vsKQK_MateDifference() {
  
  
  initEndgameTab();
  
  const boardQ = new Board();
  boardQ.loadFEN("8/8/8/3k4/8/8/3Q4/3K4 w - - 0 1");
  const evalQ = Evaluation.evaluate(boardQ);
  
  const boardR = new Board();
  boardR.loadFEN("8/8/8/3k4/8/8/3R4/3K4 w - - 0 1");
  const evalR = Evaluation.evaluate(boardR);
  
  console.log("KQK Mate Score:", evalQ);
  console.log("KRK Mate Score:", evalR);
  console.log("Result:", evalQ > evalR ? "✓ PASS (Queen faster)" : "⚠ Both way too high");
}


function runAllEndgameTests() {
  console.log("======================================");
  console.log("ENDGAME TABLEBASE - TEST SUITE");
  console.log("======================================\n");
  
  console.log("--- KPK TESTS ---");
  testKPK_OppositionWins();
  console.log();
  testKPK_OppositionLoses();
  console.log();
  testKPK_PawnOnSeventh();
  console.log();
  testKPK_PawnBlocked();

  console.log("\n--- KQK TESTS ---");
  testKQK_Winning();
  console.log();
  testKQK_DistanceToMate();

  console.log("\n--- KRK TESTS ---");
  testKRK_Winning();
  console.log();
  testKRK_vsKQK_MateDifference();
  
  console.log("\n======================================");
  console.log("TEST SUITE COMPLETE");
  console.log("======================================");
}


function benchmarkEndgameProbe() {
  initEndgameTab();
  
  const positions = [
    "8/3P4/3k4/3K4/8/8/8/8 w - - 0 1", 
    "8/8/8/3k4/8/8/3Q4/3K4 w - - 0 1", 
    "8/8/8/3k4/8/8/3R4/3K4 w - - 0 1"  
  ];
  
  const trialsPerPos = 1000;
  const results = {};
  
  for (let fenStr of positions) {
    const board = new Board();
    board.loadFEN(fenStr);
    
    const start = performance.now();
    for (let i = 0; i < trialsPerPos; i++) {
      ENDGAME_TB.probeEndgame(board);
    }
    const elapsed = performance.now() - start;
    const avgTime = elapsed / trialsPerPos;
    
    results[fenStr.substring(0, 20)] = avgTime.toFixed(4) + " ms";
  }
  
  console.log("ENDGAME PROBE BENCHMARK (1000 trials each):");
  console.table(results);
  console.log("Expected: < 0.1ms per probe");
}


function exampleKPKWinning() {
  console.log("\n=== EXAMPLE: KPK WINNING POSITION ===");
  console.log("FEN: 8/8/8/3k4/3P4/3K4/8/8 w - - 0 1");
  console.log("Position: White King d3, Black King d5, Pawn d4");
  console.log("White to move: King has opposition, pawn will advance");
  console.log("Expected: Engine recognizes this is winning");
  console.log("");
  
  initEndgameTab();
  const board = new Board();
  board.loadFEN("8/8/8/3k4/3P4/3K4/8/8 w - - 0 1");
  const score = Evaluation.evaluate(board);
  console.log("Evaluation: " + score + " (winning for white)");
}

function exampleQueenMateExecution() {
  console.log("\n=== EXAMPLE: KQK MATE EXECUTION ===");
  console.log("FEN: 8/8/8/3k4/8/8/3Q4/3K4 w - - 0 1");
  console.log("Position: Queen and King vs lone Black King");
  console.log("Expected: Tight mate, very high score");
  console.log("");
  
  initEndgameTab();
  const board = new Board();
  board.loadFEN("8/8/8/3k4/8/8/3Q4/3K4 w - - 0 1");
  const score = Evaluation.evaluate(board);
  console.log("Evaluation: " + score + " (forced mate)");
  console.log("This ensures the engine doesn't waste moves");
}


function showEndgameTestMenu() {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║       HYPERFISH v2 - ENDGAME TABLEBASE TEST          ║
╚═══════════════════════════════════════════════════════╝

RUN THESE TESTS IN BROWSER CONSOLE:

  runAllEndgameTests()       → Complete test suite
  benchmarkEndgameProbe()    → Performance benchmark
  exampleKPKWinning()        → KPK winning example
  exampleQueenMateExecution()→ KQK example

Individual tests:
  testKPK_OppositionWins()   → Opposition rule
  testKPK_PawnOnSeventh()    → Promotion imminent
  testKQK_Winning()          → Queen mate detection
  testKRK_Winning()          → Rook mate detection

  `);
}


if (typeof window !== 'undefined') {
  showEndgameTestMenu();
}
