




const EMPTY = 0, PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
const WHITE = 0, BLACK = 1;


const onB = s => !(s & 0x88);
const rk = s => s >> 4;
const fl = s => s & 7;
const s88 = (r, f) => (r << 4) | f;


const pC = p => p === 0 ? -1 : p < 8 ? WHITE : BLACK;
const pT = p => p & 7;
const mkP = (c, t) => c === WHITE ? t : t | 8;


const mkM = (f, t, c, p, fl) => f | (t << 7) | (c << 14) | (p << 18) | (fl << 22);
const mF = m => m & 0x7F;
const mT = m => (m >> 7) & 0x7F;
const mC = m => (m >> 14) & 0xF;
const mP = m => (m >> 18) & 0xF;
const mFL = m => (m >> 22) & 0x7;


const FL_N = 0, FL_C = 1, FL_E = 2, FL_P = 3;


const CWK = 1, CWQ = 2, CBK = 4, CBQ = 8;


const MX_PLY = 64;  
const MATE = 100000;  
const INF_V = 999999;  


const PST_P = [
  [0,0,0,0,0,0,0,0],
  [50,50,50,50,50,50,50,50],
  [10,10,20,30,30,20,10,10],
  [5,5,10,30,30,10,5,5],
  [0,0,0,30,30,0,0,0],
  [5,-5,-10,0,0,-10,-5,5],
  [5,10,10,-20,-20,10,10,5],
  [0,0,0,0,0,0,0,0]
];
const PST_N = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,0,0,0,0,-20,-40],
  [-30,0,10,15,15,10,0,-30],
  [-30,5,15,20,20,15,5,-30],
  [-30,0,15,20,20,15,0,-30],
  [-30,5,10,15,15,10,5,-30],
  [-40,-20,0,5,5,0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];
const PST_B = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,0,0,0,0,0,0,-10],
  [-10,0,10,10,10,10,0,-10],
  [-10,5,5,10,10,5,5,-10],
  [-10,0,5,10,10,5,0,-10],
  [-10,10,10,10,10,10,10,-10],
  [-10,5,0,0,0,0,5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];
const PST_R = [
  [0,0,0,0,0,0,0,0],
  [15,15,10,10,10,10,15,15],
  [-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],
  [0,0,0,5,5,0,0,0]
];
const PST_Q = [
  [-20,-10,-10,-5,-5,-10,-10,-20],
  [-10,0,0,0,0,0,0,-10],
  [-10,0,5,5,5,5,0,-10],
  [-5,0,5,5,5,5,0,-5],
  [0,0,5,5,5,5,0,-5],
  [-10,5,5,5,5,5,0,-10],
  [-10,0,5,0,0,0,0,-10],
  [-20,-10,-10,-5,-5,-10,-10,-20]
];
const PST_KM = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20,20,0,0,0,0,20,20],
  [20,30,10,0,0,10,30,20]
];
const PST_KE = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,0,0,-10,-20,-30],
  [-30,-10,20,30,30,20,-10,-30],
  [-30,-10,30,40,40,30,-10,-30],
  [-30,-10,30,40,40,30,-10,-30],
  [-30,-10,20,30,30,20,-10,-30],
  [-30,-30,0,0,0,0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50]
];
const PST_TBL = [null, PST_P, PST_N, PST_B, PST_R, PST_Q, null];

const MVV_LVA_FLAT = new Uint8Array([0,0,0,0,0,0,0, 0,15,25,25,35,45,55, 0,14,24,24,34,44,54, 0,13,23,23,33,43,53, 0,12,22,22,32,42,52, 0,11,21,21,31,41,51, 0,10,20,20,30,40,50]);


const N_D = [-33, -31, -18, -14, 14, 18, 31, 33];
const B_D = [-17, -15, 15, 17];
const R_D = [-16, -1, 1, 16];
const K_D = [-17, -16, -15, -1, 1, 15, 16, 17]
const PV = [0, 100, 325, 370, 500, 950, 20000];




var contemptFactor = 20;


const PCHARS = ['', '♟', '♞', '♝', '♜', '♛', '♚', '', '', '♙', '♘', '♗', '♖', '♕', '♔'];
const PCNAMES = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
const PCHARSl = ['', 'P', 'N', 'B', 'R', 'Q', 'K', '', '', 'p', 'n', 'b', 'r', 'q', 'k'];


let zPc = [], zSd = 0, zCs = new Array(16), zEp = new Array(8);

function rnd32(){
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

function initZobrist(){
  for(let p = 0; p < 15; p++){
    zPc[p] = new Uint32Array(128);
    for(let s = 0; s < 128; s++)
      if(onB(s)) zPc[p][s] = rnd32();
  }
  zSd = rnd32();
  for(let i = 0; i < 16; i++) zCs[i] = rnd32();
  for(let i = 0; i < 8; i++) zEp[i] = rnd32();
}


initZobrist();

function compH(brd, sd, cas, epSq){
  let h = 0;
  for(let s = 0; s < 128; s++)
    if(onB(s) && brd[s]) h ^= zPc[brd[s]][s];
  if(sd === BLACK) h ^= zSd;
  h ^= zCs[cas];
  if(epSq !== -1) h ^= zEp[fl(epSq)];
  return h >>> 0;
}

function moveToAN(m, board){
  const f = mF(m), t = mT(m), flag = mFL(m), pc = board.brd[f];
  const ty = pT(pc);
  const cap = mC(m);
  const prom = mP(m);
  
  let s = '';
  if(flag === FL_C) s = t > f ? 'O-O' : 'O-O-O';
  else{
    if(ty !== PAWN) s += PCNAMES[ty] || '';
    if(cap){
      if(ty === PAWN) s += String.fromCharCode(97 + fl(f));
      s += 'x';
    }
    s += String.fromCharCode(97 + fl(t)) + (rk(t) + 1);
    if(prom) s += '=' + PCNAMES[pT(prom)];
  }
  return s;
}



function see(board, move) {
  const from = mF(move);
  const to = mT(move);
  const cap = mC(move);
  if (!cap) return 0;
  
  const attacker = board.brd[from];
  const attType = pT(attacker);
  const attColor = pC(attacker);
  
  
  const capType = pT(cap);
  let exchange = PV[capType] - PV[attType];
  
  
  if (exchange < 0) return exchange;
  
  
  const defenders = findDefenders(board, to, attColor);
  if (defenders.length === 0) return exchange;
  
  
  defenders.sort((a, b) => PV[pT(board.brd[a])] - PV[pT(board.brd[b])]);
  
  
  let gain = exchange;
  let side = attColor ^ 1;
  
  for (const defSq of defenders) {
    const defender = board.brd[defSq];
    const defType = pT(defender);
    
    
    const savedFrom = board.brd[defSq];
    board.brd[defSq] = EMPTY;
    board.brd[to] = defender;
    
    
    const isAttacked = board.isAttacked(to, side ^ 1);
    
    
    board.brd[to] = cap;
    board.brd[defSq] = savedFrom;
    
    if (isAttacked) {
      
      const newExchange = -(gain - PV[attType] + PV[defType]);
      if (newExchange < gain) {
        gain = newExchange;
        side ^= 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return gain;
}


function findDefenders(board, sq, color) {
  const defenders = [];
  const oppColor = color ^ 1;
  
  
  for (let s = 0; s < 128; s++) {
    if (!onB(s)) continue;
    const p = board.brd[s];
    if (!p || pC(p) !== color) continue;
    
    const ty = pT(p);
    
    
    if (canAttack(board, s, sq, ty)) {
      defenders.push(s);
    }
  }
  
  return defenders;
}


function canAttack(board, from, to, pieceType) {
  const dr = rk(to) - rk(from);
  const df = fl(to) - fl(from);
  const ad = Math.abs(dr), af = Math.abs(df);
  
  switch (pieceType) {
    case PAWN:
      const dir = pC(board.brd[from]) === WHITE ? 1 : -1;
      return (dr === dir && af === 1);
    case KNIGHT:
      return (ad === 2 && af === 1) || (ad === 1 && af === 2);
    case BISHOP:
      return ad === af && isClearPath(board, from, to, BISHOP);
    case ROOK:
      return (ad === 0 || af === 0) && isClearPath(board, from, to, ROOK);
    case QUEEN:
      return (ad === af || ad === 0 || af === 0) && isClearPath(board, from, to, QUEEN);
    case KING:
      return ad <= 1 && af <= 1;
  }
  return false;
}


function isClearPath(board, from, to, pieceType) {
  const dr = Math.sign(rk(to) - rk(from));
  const df = Math.sign(fl(to) - fl(from));
  if (dr === 0 && df === 0) return false;
  
  let sq = from + (dr * 16) + df;
  while (sq !== to) {
    if (board.brd[sq] !== 0) return false;
    sq += (dr * 16) + df;
  }
  return true;
}
