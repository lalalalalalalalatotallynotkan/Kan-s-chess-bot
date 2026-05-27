const fs = require('fs');
const vm = require('vm');

function loadScript(path, context){
  const code = fs.readFileSync(path, 'utf8');
  vm.runInThisContext(code, {filename: path});
}

// Load engine files into Node context
loadScript(__dirname + '/../constants.js');
loadScript(__dirname + '/../board.js');
loadScript(__dirname + '/../movegen.js');

function perft(board, depth){
  if(depth === 0) return 1;
  let nodes = 0;
  const moves = MoveGen.genMoves(board, false);
  for(const m of moves){
    if(!board.doMove(m)) continue;
    const c = perft(board, depth - 1);
    board.undoMove(m);
    nodes += c;
  }
  return nodes;
}

function run(){
  const b = new Board();
  b.loadFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  console.log('Starting perft depth 1..4');
  for(let d = 1; d <= 4; d++){
    const t0 = Date.now();
    const n = perft(b, d);
    const t1 = Date.now();
    console.log(`Depth ${d}: ${n} nodes (${t1 - t0} ms)`);
  }
}

run();
