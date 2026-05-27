const fs = require('fs');
const vm = require('vm');

function loadScript(path){
  const code = fs.readFileSync(path, 'utf8');
  vm.runInThisContext(code, {filename: path});
}

const base = process.cwd();
loadScript(base + '/constants.js');
loadScript(base + '/board.js');
loadScript(base + '/movegen.js');
loadScript(base + '/endgame.js');
if (typeof initEndgameTab === 'function') initEndgameTab();
loadScript(base + '/evaluation.js');
loadScript(base + '/search.js');

const fen = process.argv[2] || 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const depth = parseInt(process.argv[3], 10) || 6;
const b = new Board();
b.loadFEN(fen);
const s = new Search();

const moves = MoveGen.genMoves(b, false);
const scores = [];
for (const m of moves) {
  if (!b.doMove(m)) continue;
  s.ply = 1;
  s.pushHash(b.hKey);
  const score = -s.abSearch(b, depth - 1, -999999, 999999, true);
  s.popHash();
  s.ply = 0;
  b.undoMove(m);
  scores.push({move: moveToAN(m, b), score});
}

scores.sort((a,b)=>b.score - a.score);
console.log('Root move scores for FEN:', fen, 'depth', depth);
for (const item of scores) {
  console.log(item.move, item.score);
}
