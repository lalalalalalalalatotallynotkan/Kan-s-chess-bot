const fs = require('fs');
const vm = require('vm');

function loadScript(path){
  const code = fs.readFileSync(path, 'utf8');
  vm.runInThisContext(code, {filename: path});
}

// Load engine components
loadScript(__dirname + '/../constants.js');
loadScript(__dirname + '/../board.js');
loadScript(__dirname + '/../movegen.js');
loadScript(__dirname + '/../endgame.js');
// Initialize endgame tables used by evaluation
if (typeof initEndgameTab === 'function') initEndgameTab();
loadScript(__dirname + '/../evaluation.js');
loadScript(__dirname + '/../search.js');

// Create board and search
const fen = process.argv[2] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const tm = parseInt(process.argv[3], 10) || 1000;
const b = new Board();
b.loadFEN(fen);
const s = new Search();

console.log('Running engineSearch on FEN:', fen);
try{
  const best = s.engineSearch(b, tm);
  console.log('Best move returned:', best ? moveToAN(best, b) : 'none');
} catch (e){
  console.error('Search crashed:', e.stack || e);
}
