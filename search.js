

class Search {
  constructor(){
	// Increase TT size from 2^17 to 2^20 (8x larger = ~1M entries)
	this.tt = new Array(1 << 20);  
	this.ttMask = (1 << 20) - 1;
    // Generation counter to prefer recent entries during replacement
    this.ttGen = 0;
	this.killers = Array.from({length: MX_PLY}, () => [0, 0]);
	
	// History heuristic for move ordering (larger table for better distribution)
	this.histH = [new Int32Array(65536), new Int32Array(65536)];
	
	this.capH = new Int32Array(65536);  
	this.hHist = [];
	this.ply = 0;
	this.sStop = false;
	this.maxTm = 3000;
	this.stTm = 0;
	this.nCnt = 0;
	this.timeCnt = 0;  
	this.prunedCnt = 0;
	this.razoredCnt = 0;
	this.futilityCnt = 0;
	this.lmPruneCnt = 0;
	this.moveCntPruneCnt = 0;
	this.bestRt = 0;
	this.srchNfo = '';
	this.rootMoves = [];
	this.pvLines = [];
	
	this.ttProbeResult = {v: false, s: 0, m: 0};
	
	this.ttHits = 0;
	this.ttMisses = 0;
	this.ttExactHits = 0;
	this.ttBetaHits = 0;
	this.ttAlphaHits = 0;
	
	
	this.multiPV = 1;  
	this.singularMove = null;  
	this.singularDepth = 0;
	this.singularBeta = 0;
	this.rootDepth = 0;  
	this.prevRootScore = 0;
	this.bestMoveScores = new Map();  
	this.searchNormalization = 0;  
	this.contemptFactor = 0;  
	this.tbHits = 0;  
	this.tbProbes = 0;  
	this.moveStack = []; 
	
	
	this.evalCacheKeys = new Uint32Array(1 << 16);
	this.evalCacheVals = new Int32Array(1 << 16);
	this.evalMask = (1 << 16) - 1;
	
	
	this.counterMoves = [new Int32Array(4096), new Int32Array(4096)];
	
	
	this.lmrTable = Array.from({length: 64}, () => new Uint8Array(64));
	this.initLMRTable();
  }
 
  
  getTTStats() {
	const total = this.ttHits + this.ttMisses;
	if (total === 0) return { hitRate: 0, exact: 0, beta: 0, alpha: 0, total: 0 };
	const hitRate = (this.ttHits / total) * 100;
	return {
	  hitRate: hitRate.toFixed(1),
	  exact: this.ttExactHits,
	  beta: this.ttBetaHits,
	  alpha: this.ttAlphaHits,
	  total: total
	};
  }

  // Validate board state integrity
  validateBoardState(board, label) {
	let piecesOnBoard = 0;
	for(let sq = 0; sq < 128; sq++) {
	  if(onB(sq) && board.brd[sq]) {
		const p = board.brd[sq];
		const c = pC(p);
		const t = pT(p);
		if(c > 1 || t > 6) {
		  console.error(`${label}: Invalid piece at ${sq}: ${p}`);
		  return false;
		}
		piecesOnBoard++;
	  }
	}
	
	// Check king squares are valid
	for(let c = 0; c < 2; c++) {
	  const kSq = board.kSq[c];
	  if(!onB(kSq) || board.brd[kSq] !== mkP(c, KING)) {
		console.error(`${label}: King square mismatch for side ${c}. kSq=${kSq}, piece=${board.brd[kSq]}`);
		return false;
	  }
	}
	
	return true;
  }
  
  logTTStats() {
	const stats = this.getTTStats();
	console.log(`TT Stats: Hit Rate: ${stats.hitRate}% (Hits: ${this.ttHits}, Misses: ${this.ttMisses})`);
	console.log(`  - Exact: ${stats.exact}, Beta: ${stats.beta}, Alpha: ${stats.alpha}`);
	return stats;
  }

  
  resetTTStats() {
	this.ttHits = 0;
	this.ttMisses = 0;
	this.ttExactHits = 0;
	this.ttBetaHits = 0;
	this.ttAlphaHits = 0;
  }
  
  
  setMultiPV(pvCount) {
	this.multiPV = Math.max(1, Math.min(pvCount, 10));
  }

  
  setContempt(factor) {
	this.contemptFactor = factor;
  }

  applyContempt(board, myeval) {
	const totalMaterial = board.pieceCount[0] + board.pieceCount[1];
	if (totalMaterial <= 4) {
	  return myeval + this.contemptFactor * 10;
	}
	return myeval;
  }
 
  addKiller(m, d){
	if(d < MX_PLY && this.killers[d][0] !== m){
	  this.killers[d][1] = this.killers[d][0];
	  this.killers[d][0] = m;
	}
  }

  hIdx(f, t, p){
	// Expanded history index for larger table (2^16 entries)
	// Format: 14 bits for from/to, 2 bits for piece type
	return ((f & 0x7F) << 8) | ((t & 0x7F) << 1) | (p & 1);
  }

  capIdx(f, p, t, cap){
	
	return ((f & 0x3F) << 6) | (t & 0x3F);
  }

  mvIdx(m){
	return ((mF(m) & 0x3F) << 6) | (mT(m) & 0x3F);
  }

  // ===== STATIC EXCHANGE EVALUATION (SEE) =====
  // Evaluates the balance of material in a capture sequence
  // Critical for accurate move scoring and pruning decisions
  see(board, from, to, capturedPiece) {
	let balance = PV[pT(capturedPiece)];
	const attacker = board.brd[from];
	if (!attacker) return balance;
	
	const attackerType = pT(attacker);
	const color = pC(attacker);
	balance -= PV[attackerType];
	
	// Generate all attackers on the target square
	const attackers = [[], []];
	
	// Pawns
	for (let c = 0; c < 2; c++) {
	  const dir = c === WHITE ? 16 : -16;
	  const pawnAttacks = c === WHITE ? [15, 17] : [-17, -15];
	  for (const offset of pawnAttacks) {
		const sq = to - offset;
		if (sq >= 0 && sq < 128 && (sq & 0x88) === 0) {
		  const p = board.brd[sq];
		  if (p && pT(p) === PAWN && pC(p) === c) {
			attackers[c].push(sq);
		  }
		}
	  }
	}
	
	// Knights
	const knightMoves = [-33, -31, -18, -14, 14, 18, 31, 33];
	for (const offset of knightMoves) {
	  const sq = to + offset;
	  if (sq >= 0 && sq < 128 && (sq & 0x88) === 0) {
		const p = board.brd[sq];
		if (p && pT(p) === KNIGHT) attackers[pC(p)].push(sq);
	  }
	}
	
	// Bishops and Queens (diagonal)
	const diagonals = [-17, -15, 15, 17];
	for (const offset of diagonals) {
	  let sq = to + offset;
	  while (sq >= 0 && sq < 128 && (sq & 0x88) === 0) {
		const p = board.brd[sq];
		if (p) {
		  const ptype = pT(p);
		  if (ptype === BISHOP || ptype === QUEEN) {
			attackers[pC(p)].push(sq);
		  }
		  break;
		}
		sq += offset;
	  }
	}
	
	// Rooks and Queens (orthogonal)
	const orthogonal = [-16, -1, 1, 16];
	for (const offset of orthogonal) {
	  let sq = to + offset;
	  while (sq >= 0 && sq < 128 && (sq & 0x88) === 0) {
		const p = board.brd[sq];
		if (p) {
		  const ptype = pT(p);
		  if (ptype === ROOK || ptype === QUEEN) {
			attackers[pC(p)].push(sq);
		  }
		  break;
		}
		sq += offset;
	  }
	}
	
	// Kings
	const kingMoves = [-17, -16, -15, -1, 1, 15, 16, 17];
	for (const offset of kingMoves) {
	  const sq = to + offset;
	  if (sq >= 0 && sq < 128 && (sq & 0x88) === 0) {
		const p = board.brd[sq];
		if (p && pT(p) === KING) attackers[pC(p)].push(sq);
	  }
	}
	
	// If we don't have an attacker, return current balance
	if (attackers[color].length === 0) return balance;
	
	// Simulate the exchange: use cheapest attacker
	let currentColor = color;
	let currentAttacker = from;
	let capturedType = pT(capturedPiece);
	
	// Repeat: attacker takes, then defender takes back
	for (let depth = 0; depth < 32; depth++) {
	  currentColor = currentColor ^ 1;
	  if (attackers[currentColor].length === 0) break;
	  
	  // Find cheapest attacker for current color
	  let cheapest = 0;
	  let cheapestType = KING + 1;
	  for (let i = 0; i < attackers[currentColor].length; i++) {
		const sq = attackers[currentColor][i];
		const p = board.brd[sq];
		const ptype = pT(p);
		if (ptype < cheapestType) {
		  cheapest = i;
		  cheapestType = ptype;
		}
	  }
	  
	  // Remove this attacker
	  attackers[currentColor].splice(cheapest, 1);
	  
	  // Current attacker type becomes captured
	  balance += (currentColor === color ? 1 : -1) * PV[capturedType];
	  capturedType = cheapestType;
	  
	  // If no more attackers, stop
	  if (attackers[currentColor ^ 1].length === 0) break;
	}
	
	return balance;
  }

  initLMRTable(){
	// Late Move Reduction table based on Stockfish techniques
	// More aggressive reductions for later moves and shallower depths
	// Formula: similar to Stockfish but optimized for JavaScript
	// Reduces depth for moves that appear worse (ordered later)
	for(let d = 1; d < 64; d++){
	  for(let m = 1; m < 64; m++){
		if(d === 0 || m === 0){
		  this.lmrTable[d][m] = 0;
		  continue;
		}
		
		// Stockfish-style formula: more aggressive for later moves
		// Base reduction increases logarithmically with both depth and move count
		// The 0.75 coefficient makes reductions more aggressive than standard
		const logDepth = Math.log(Math.max(1, d)) * 0.94;
		const logMoves = Math.log(Math.max(1, m)) * 0.75;
		const rd = logDepth * logMoves;
		// Cap between 1 and 8 for reasonable search balance
		this.lmrTable[d][m] = Math.max(1, Math.min(8, Math.floor(rd)));
	  }
	}
  }

  staticEval(board){
		const idx = (board.hKey | 0) & this.evalMask;
		if (this.evalCacheKeys[idx] === board.hKey) return this.evalCacheVals[idx] | 0;
		const s = Evaluation.evaluate(board) | 0;
		this.evalCacheKeys[idx] = board.hKey;
		this.evalCacheVals[idx] = s;
		return s;
  }

  pushHash(hash){
	this.hHist.push(hash);
  }

  popHash(){
	this.hHist.pop();
  }

  pushMove(m){
	this.moveStack.push(m);
  }

  popMove(){
	this.moveStack.pop();
  }

  scoreMove(board, m, ttm){
	// TT move gets highest priority - it's from proven best move at this position
	if(m === ttm) return 9000000;
	
	// Captures scored by MVV-LVA + SEE (Static Exchange Evaluation)
	// This order is critical for alpha-beta pruning effectiveness
	const cap = mC(m);
	if(cap) {
	  const attacker = pT(board.brd[mF(m)]);
	  const victim = pT(cap);
	  // Use SEE to evaluate actual material balance in exchange
	  const seeVal = this.see(board, mF(m), mT(m), cap);
	  const baseScore = seeVal >= 0 ? 7000000 : 6000000;
	  return baseScore + Math.max(-9999, Math.min(9999, seeVal)) * 100;
	}
	
	// Promotions are almost as good as captures (free piece upgrade)
	const prom = mP(m);
	if(prom) return 8000000 + PV[pT(prom)];
	
	// Killer moves from sibling nodes (often refute at same depth)
	if(this.ply < MX_PLY){
	  if(m === this.killers[this.ply][0]) return 6000000;
	  if(m === this.killers[this.ply][1]) return 5900000;
	}
	
	// Quiet moves scored by history heuristic (prior success rate)
	const p = pT(board.brd[mF(m)]);
	let score = this.histH[board.sd][this.hIdx(mF(m), mT(m), p)];
	
	// Counter-move heuristic: moves that refuted previous move
	const prev = this.moveStack.length > 0 ? this.moveStack[this.moveStack.length - 1] : 0;
	if(prev){
	  const prevIdx = this.mvIdx(prev);
	  if(m === this.counterMoves[board.sd][prevIdx]) score += 80000;
	}

	// Opening/development bonus for central pawn pushes and knight development
	if(!cap && !prom){
	  const to = mT(m);
	  const p = pT(board.brd[mF(m)]);
	  const centerPawnTargets = [s88(3,4), s88(4,4), s88(3,3), s88(4,3)];
	  const knightDevelopment = [s88(2,2), s88(5,2), s88(2,5), s88(5,5)];
	  if(p === PAWN && centerPawnTargets.includes(to)) score += 150000;
	  if(p === KNIGHT && knightDevelopment.includes(to)) score += 120000;
	}
	
	return score;
  }

  orderMoves(board, mv, ttm){
	if(mv.length < 2) return mv;
	// In-place scoring with early swap for better cache locality
	for(let i = 0; i < mv.length; i++){
	  const score = this.scoreMove(board, mv[i], ttm);
	  let maxIdx = i, maxScore = score;
	  
	  for(let j = i + 1; j < mv.length; j++){
		const jScore = this.scoreMove(board, mv[j], ttm);
		if(jScore > maxScore){
		  maxScore = jScore;
		  maxIdx = j;
		}
	  }
	  
	  if(maxIdx !== i){
		const tmp = mv[i];
		mv[i] = mv[maxIdx];
		mv[maxIdx] = tmp;
	  }
	}
	return mv;
  }

  isRepetition(){
	const hlen = this.hHist.length;
	if(hlen < 4) return false;
	const hash = this.hHist[hlen - 1];
	
	// Check for 3-fold repetition more efficiently
	// Scan back by 2-ply to find same position (ignoring side to move distinction)
	let count = 0;
	for(let i = hlen - 3; i >= 0; i -= 2){
	  if(this.hHist[i] === hash){
		count++;
		if(count >= 2) return true; // 3-fold repetition found (1 current + 2 previous)
	  }
	  // Stop if we go past 50-move rule boundary
	  if(hlen - i > 110) break;
	}
	return false;
  }ttProbe(h, d, a, b){
    // 1. Force signed 32-bit integer array index lookup matching ttStore
    const i = (h | 0) & this.ttMask;
    const e = this.tt[i];
    
    if(!e || e.h !== h){
      this.ttMisses++;
      this.ttProbeResult.v = false;
      this.ttProbeResult.m = 0;
      return this.ttProbeResult;
    }
    
	const m = e.m;
		if(e.d >= d){
      let s = e.s;
      
      // 2. Reverse the mate score adjustment done in ttStore 
      // (Convert ply-independent stored score back to a root-relative score)
      if(s > MATE - MX_PLY) s -= this.ply;
      else if(s < -MATE + MX_PLY) s += this.ply;
      
      if(e.f === 0){ // EXACT MATCH
        this.ttHits++;
        this.ttExactHits++;
        this.ttProbeResult.v = true;
        this.ttProbeResult.s = s;
        this.ttProbeResult.m = m;
        return this.ttProbeResult;
      }
      if(e.f === 1 && s <= a){ // UPPER BOUND (Beta Cutoff / Fail-Low)
        this.ttHits++;
        this.ttBetaHits++;
        this.ttProbeResult.v = true;
        this.ttProbeResult.s = a;
        this.ttProbeResult.m = m;
        return this.ttProbeResult;
      }
      if(e.f === 2 && s >= b){ // LOWER BOUND (Alpha Cutoff / Fail-High)
        this.ttHits++;
        this.ttAlphaHits++;
        this.ttProbeResult.v = true;
        this.ttProbeResult.s = b;
        this.ttProbeResult.m = m;
        return this.ttProbeResult;
      }
	}
    
    this.ttMisses++;
    this.ttProbeResult.v = false;
    this.ttProbeResult.s = 0;
    this.ttProbeResult.m = m; // Still return the best move even on a depth-miss for move ordering!
    return this.ttProbeResult;
  }

  ttStore(board, d, s, f, m){
    // 1. Calculate integer array slot using the exact same bitwise mask optimization
    const i = (board.hKey | 0) & this.ttMask;
    let sc = s;
    
    // 2. Adjust mate scores to be ply-independent before saving
    if(sc > MATE - MX_PLY) sc += this.ply;
    else if(sc < -MATE + MX_PLY) sc -= this.ply;
    
		const oldEntry = this.tt[i];
		if(!oldEntry){
			this.tt[i] = {h: board.hKey, d, s: sc, f, m, g: this.ttGen};
		} else if(oldEntry.h === board.hKey){
			// If updating the same position, favor EXACT flags or overwrite bounds
			if(f === 0 || oldEntry.f !== 0){
				this.tt[i] = {h: board.hKey, d, s: sc, f, m, g: this.ttGen};
			}
		} else {
			// Replacement policy enhanced with generation awareness
			// Prefer replacing older-generation entries when depths are similar
			const depthDiff = d - oldEntry.d;
			const isExact = f === 0;
			const oldIsExact = oldEntry.f === 0;

			// If new entry is exact and old is not, prefer new
			if(isExact && !oldIsExact){
				this.tt[i] = {h: board.hKey, d, s: sc, f, m, g: this.ttGen};
				return;
			}

			// Replace if new is much deeper
			if(depthDiff >= 3) {
				this.tt[i] = {h: board.hKey, d, s: sc, f, m, g: this.ttGen};
				return;
			}

			// If old entry is from an older generation and depths are comparable, replace it
			if((oldEntry.g || 0) < this.ttGen && d >= oldEntry.d){
				this.tt[i] = {h: board.hKey, d, s: sc, f, m, g: this.ttGen};
				return;
			}

			// Favor deeper or same-depth overwrites
			if(d >= oldEntry.d){
				this.tt[i] = {h: board.hKey, d, s: sc, f, m, g: this.ttGen};
			}
			// Otherwise keep old entry
		}
  }
  quiesce(board, a, b){
	this.nCnt++;
	if(++this.timeCnt >= 8192){
	  this.timeCnt = 0;
	  if(Date.now() - this.stTm > this.maxTm){
		this.sStop = true;
		return 0;
	  }
	}
	
	// Standing pat: we can always pass (evaluate current position)
	// After ~20 ply in quiescence, assume we found a quiet position
	let se = this.ply > 20 ? 0 : this.staticEval(board);  
	if(se >= b) return b;  // Beta cutoff
	if(se > a) a = se;     // Improve alpha (fail-soft)
	
	// Only generate captures/promotions in quiescence
	const mv = MoveGen.genMoves(board, true);
	if(mv.length === 0) return se;  // No captures available
	
	// Critical: order moves by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
	// This is essential for tactical accuracy in quiescence search
	const om = this.orderMoves(board, mv, 0);
	
	// Delta pruning: skip moves that can't improve position
	// Margin = queen value, tactical threshold
	const delta = 950;  
	
	for(const m of om){
	  // Skip captures that appear to lose too much material
	  // Even with winning capture, delta pruning keeps search efficient
	  if(mC(m) && se + PV[pT(mC(m))] + delta < a) continue;
	  
	  // Make the move (pruned moves never made)
	  if(!board.doMove(m)){
		continue;
	  }
	  this.ply++;
	  this.pushHash(board.hKey);
	  
	  // Recurse with swapped alpha-beta bounds (negamax)
	  const s = -this.quiesce(board, -b, -a);
	  
	  this.popHash();
	  this.ply--;
	  board.undoMove(m);
	  
	  if(this.sStop) return 0;
	  if(s >= b) return b;  // Beta cutoff
	  if(s > a) a = s;      // Improve alpha
	}
	
	return a;
  }

  abSearch(board, depth, a, b, doNM){
	// === ALPHA-BETA PRUNING FRAMEWORK ===
	// Negamax formulation with fail-soft bounds [alpha, beta)
	// Returns exact score if found in window, otherwise bounds estimate
	// Per CPW: move ordering is critical for pruning effectiveness
	
	if(this.sStop) return 0;
	
	if(++this.timeCnt >= 8192){
	  this.timeCnt = 0;
	  if(Date.now() - this.stTm > this.maxTm){
		this.sStop = true;
		return 0;
	  }
	}
	
	// Draw detection: 3-fold repetition or 50-move rule
	if(this.ply > 0 && this.isRepetition()) return 0;
	if(this.ply > 0 && board.hmc >= 100) return 0;
	
	// Check detection for extensions
	const inCk = board.isAttacked(board.kSq[board.sd], board.sd ^ 1);
	if(inCk) depth++;  // Extend search when in check (important for safety)
	if(depth <= 0) return this.quiesce(board, a, b);  // Transition to quiescence
	
	this.nCnt++;
	
	// === TRANSPOSITION TABLE PROBE ===
	// TT provides both best move AND score bounds
	const pv = b - a > 1;  // PV node: narrow window (principal variation)
	let ttm = 0;  // TT move for move ordering
	const tp = this.ttProbe(board.hKey, depth, a, b);
	if(tp.m) ttm = tp.m;  // Extract best move if available
	if(tp.v && !pv) return tp.s;  // Use TT score if not PV node
	const e = tp;
	
	const se = this.staticEval(board);
	
	// === STATIC NULL MOVE PRUNING (RAZORING) ===
	// If position is hopeless (eval far below alpha), go to quiescence
	if(doNM && !inCk && !pv && depth <= 2 && se >= b){
	  const margins = [0, 150, 400];  // Depth-based margins
	  if(se - margins[depth] >= b) return se;
	}
	
	// === REVERSE FUTILITY PRUNING ===
	// If standing pat is way below alpha, likely no good moves
	if(depth <= 2 && se + 200 + 100 * depth < a && !inCk){
	  this.razoredCnt++;
	  return this.quiesce(board, a, b);
	}
	
	// === TRANSPOSITION CUTOFF ===
	// Do not reduce search depth when no TT move exists.
	// Internal iterative deepening should be a separate process.
	
	
	
	let singularExt = 0;
	if(
	  !pv && 
	  ttm && 
	  depth >= 8 && 
	  !this.singularMove &&  
	  e && e.d >= depth - 3 && 
	  e.f === 0  
	){
	  
	  const singularBeta = e.s - 3;
	  this.singularMove = ttm;
	  this.singularDepth = depth;
	  this.singularBeta = singularBeta;
	  
	  const ss = -this.abSearch(board, depth / 2, singularBeta - 1, singularBeta, doNM);
	  
	  this.singularMove = null;
	  
	  if(ss < singularBeta){
		
		const ext = ss < singularBeta - 2 ? 2 : 1;
		if(ext > 0 && depth + ext <= MX_PLY){
		  singularExt = ext;
		}
	  } else if(e.s >= b){
		
		return e.s;
	  }
	}
	
	
	depth += singularExt;
	
	
	// === NULL MOVE PRUNING ===
	// Per CPW and Stockfish: prune when opponent gets no move and still loses
	// Stockfish formula: R = 3 + depth / 6 for better balance
	// Conditions: must not be check, not zugzwang (have pieces), not PV node
	if(doNM && !inCk && !pv && depth >= 2 && this.ply > 0 && board.pieceCount[board.sd] > 0){
	  board.doNull();
	  this.ply++;
	  this.pushHash(board.hKey);
	  
	  // Stockfish-style variable reduction: scales with depth
	  // More aggressive at deeper depths but bounded to 4
	  const R = Math.min(4, 3 + Math.floor(depth / 6));
	  const ns = -this.abSearch(board, Math.max(0, depth - 1 - R), -b, -b + 1, false);
	  
	  this.popHash();
	  this.ply--;
	  board.undoNull();
	  
	  if(this.sStop) return 0;
	  if(ns >= b){
		// Beta cutoff: position is too good, no need to search further
		this.ttStore(board, depth - R, ns, ns >= b ? 2 : 0, 0);
		return ns;  // Fail-soft: return exact value, not just beta
	  }
	}
	
	const mv = MoveGen.genMoves(board, false);
	const om = this.orderMoves(board, mv, ttm);
	
	let bs = -INF_V, bm = 0, lm = 0, quietCnt = 0;
	const origA = a;
	const futilityMargins = [0, 100, 300];  
	
	for(let i = 0; i < om.length; i++){
	  const m = om[i];
	  if(!board.doMove(m)){
		continue;
	  }
	  
	  this.ply++;
	  this.pushHash(board.hKey);
	  this.pushMove(m);
	  lm++;
	  
	  const isQuiet = !mC(m) && !mP(m);
	  if(isQuiet) quietCnt++;
	  
	  const gc = board.isAttacked(board.kSq[board.sd], board.sd ^ 1);
	  const isKiller = this.ply < MX_PLY && (m === this.killers[this.ply][0] || m === this.killers[this.ply][1]);
	  
	  // === PROBABILITY CUTOFF (ProbCut) - Stockfish optimization ===
	  // Skip expensive search if shallow qsearch shows clear cutoff
	  // Reduces nodes in quiet positions significantly (3-5% speedup)
	  if(!inCk && depth >= 5 && !pv && isQuiet && lm > 3 && !gc){
		const probCutBeta = b + 50 + depth * 2;  // Margin scales with depth
		const probCutResult = this.quiesce(board, probCutBeta - 1, probCutBeta);
		if(probCutResult >= probCutBeta){
		  // Position is clearly winning after checks/captures
		  // No need to search quiet moves
		  this.popHash();
		  this.ply--;
		  this.popMove();
		  board.undoMove(m);
		  continue;
		}
	  }
	  
	  if(!inCk && depth <= 2 && isQuiet && !gc && quietCnt > 1){
		if(se + futilityMargins[depth] < a){
		  this.futilityCnt++;
		  this.popHash();
		  this.ply--;
		  this.popMove();
		  board.undoMove(m);
		  continue;
		}
	  }
	  
	  
	  if(!inCk && depth <= 1 && isQuiet && !gc && quietCnt > 2){
		this.lmPruneCnt++;
		this.popHash();
		this.ply--;
		this.popMove();
		board.undoMove(m);
		continue;
	  }
	  
	  
	  
	  let s;
	  
	  // === EXTENSION LOGIC ===
	  let recaptureExt = 0;
	  const isRecapture = mC(m) && this.moveStack.length > 0 && mT(this.moveStack[this.moveStack.length - 1]) === mF(m);
	  if(isRecapture && depth >= 2) {
		recaptureExt = 1;
	  }
	  
	  // === LATE MOVE REDUCTIONS (LMR) ===
	  if(lm >= 2 && depth >= 2 && !inCk && !mC(m) && !mP(m) && !gc && !isKiller && recaptureExt === 0){
		const dIdx = Math.min(63, Math.max(0, depth));
		const mIdx = Math.min(63, lm);
		let R = this.lmrTable[dIdx][mIdx];
		
		// Reduce based on move quality signals (Stockfish style)
		const p = pT(board.brd[mF(m)]);
		const histScore = this.histH[board.sd][this.hIdx(mF(m), mT(m), p)];
		const prev = this.moveStack.length > 0 ? this.moveStack[this.moveStack.length - 1] : 0;
		
		// More aggressive reduction adjustments based on history
		if(prev){
		  const prevIdx = this.mvIdx(prev);
		  if(m === this.counterMoves[board.sd][prevIdx]) R -= 2;  // Counter-moves reduce more
		}
		// Stronger history-based reductions
		if(histScore > 4000) R -= 1;
		if(histScore > 8000) R -= 2;
		if(histScore > 12000) R -= 2;
		// Penalty for very bad moves
		if(histScore < -4000) R += 1;
		
		R = Math.max(1, Math.min(depth - 1, R));
		
		s = -this.abSearch(board, depth - 1 - R + recaptureExt, -a - 1, -a, true);
		if(s > a) s = -this.abSearch(board, depth - 1 + recaptureExt, -b, -a, true);
	  }else if(lm > 1){
		s = -this.abSearch(board, depth - 1 + recaptureExt, -a - 1, -a, true);
		if(s > a && s < b) s = -this.abSearch(board, depth - 1 + recaptureExt, -b, -a, true);
	  }else{
		s = -this.abSearch(board, depth - 1, -b, -a, true);
	  }
	  
	  this.popHash();
	  this.ply--;
	  this.popMove();
	  board.undoMove(m);
	  
	  if(this.sStop) return 0;
	  
	  if(s > bs){
		bs = s;
		bm = m;
		if(this.ply === 0) this.bestRt = m;
		
		if(s > a){
		  a = s;
		  if(s >= b){
			this.prunedCnt++;
			if(!mC(m)){
			  this.addKiller(m, this.ply + 1);
			  const p = pT(board.brd[mF(m)]);
			  const histBonus = depth * depth;
			  this.histH[board.sd][this.hIdx(mF(m), mT(m), p)] += histBonus;
			  
			  // Update counter-move: this move refutes opponent's last move
			  const prev = this.moveStack.length > 0 ? this.moveStack[this.moveStack.length - 1] : 0;
			  if(prev){
				const prevIdx = this.mvIdx(prev);
				this.counterMoves[board.sd][prevIdx] = m;
			  }
			} else {
			  // Capture history
			  const p = pT(board.brd[mF(m)]);
			  const cap = pT(mC(m));
			  this.capH[this.capIdx(mF(m), p, mT(m), cap)] += depth * depth;
			}
			this.ttStore(board, depth, b, 2, m);
			return b;
		  }
		}
	  }
	}
	
	if(lm === 0) return inCk ? -MATE + this.ply : 0;
	
	this.ttStore(board, depth, bs, bs <= origA ? 1 : 0, bm);
	return bs;
  }

  extractPV(board, depth) {
	const pv = [];
	const origHHist = [...this.hHist];
	const movesPlayed = [];
	
	for(let d = 0; d < depth && pv.length < 3; d++) {
	  const tp = this.ttProbe(board.hKey, 0, -INF_V, INF_V);
	  if(!tp.m) break;
	  
	  pv.push(moveToAN(tp.m, board));
	  
	  if(!board.doMove(tp.m)) {
		break;
	  }
	  movesPlayed.push(tp.m);
	  this.ply++;
	  this.pushHash(board.hKey);
	}
	
	
	for(let i = movesPlayed.length - 1; i >= 0; i--) {
	  this.popHash();
	  this.ply--;
	  board.undoMove(movesPlayed[i]);
	}
	
	return pv;
  }

  engineSearch(board, tmMs){
	// DIAGNOSTIC: Verify board state before search
	const sideNames = ['WHITE', 'BLACK'];
	const inCheck = board.isAttacked(board.kSq[board.sd], board.sd ^ 1);
	console.log(`🔍 Engine Search Starting: Side=${sideNames[board.sd]} | In Check=${inCheck} | King Sq=${board.kSq[board.sd]}`);
	
	// Sanity check: verify there are legal moves for this side
	const testMoves = MoveGen.genMoves(board, false);
	console.log(`📋 Available moves for ${sideNames[board.sd]}: ${testMoves.length}`);
	
	this.sStop = false;
	this.stTm = Date.now();
	this.maxTm = tmMs;
	this.nCnt = 0;
	this.timeCnt = 0;
	this.prunedCnt = 0;
	this.razoredCnt = 0;
	this.futilityCnt = 0;
	this.lmPruneCnt = 0;
	this.moveCntPruneCnt = 0;
	this.bestRt = 0;
	this.ply = 0;
	this.hHist = [];
	this.moveStack = [];
	this.pvLines = [];
	
	this.resetTTStats();
	
	
	for(let c = 0; c < 2; c++){
	  for(let i = 0; i < 32768; i++){
		// Improved history decay: use logarithmic scaling instead of bit shift
		// This gives better gradient for move ordering while still aging old entries
		const oldVal = this.histH[c][i];
		if(oldVal > 0){
		  // Math.sqrt gives ~70% retention, smoother than >> 1
		  this.histH[c][i] = Math.max(0, Math.floor(Math.sqrt(oldVal * 0.5)));
		}
	  }
	}
	
	
	for(let i = 0; i < 65536; i++){
	  const oldVal = this.capH[i];
	  if(oldVal > 0){
		this.capH[i] = Math.max(0, Math.floor(Math.sqrt(oldVal * 0.5)));
	  }
	}
	
	let bm = 0, bsc = 0, finalDepth = 1;
	let prevScore = 0;
	let scoreVolatility = 0; 
	
	
	
	const moveNumber = Math.floor(board.hmc / 2) + 1;
	let timeFactor = 1.0;
	
	
	if (moveNumber < 10) {
	  timeFactor = 1.2;
	}
	
	else if (moveNumber < 30) {
	  timeFactor = 1.0;
	}
	
	else if (moveNumber < 50) {
	  timeFactor = 0.8;
	}
	
	else {
	  timeFactor = 1.1;
	}
	
	
	const dynamicMaxTm = Math.floor(tmMs * timeFactor);
	
	// Save initial board state to restore after each iteration
	const initialSd = board.sd;
	
	for(let d = 1; d <= 64; d++){
	  // Bump transposition table generation to prefer recent entries
	  this.ttGen = (this.ttGen + 1) & 0x7fffffff;
	  this.ply = 0;
	  this.hHist = [];
	  this.moveStack = [];
	  this.timeCnt = 0;
	  const prevPruned = this.prunedCnt;
	  
	  // SAFETY: Verify board state at start of each iteration
	  if(board.sd !== initialSd){
		console.error(`❌ CRITICAL: Board.sd corrupted before depth ${d}! Expected ${initialSd}, got ${board.sd}`);
		// Force restore
		while(board.sd !== initialSd) board.sd ^= 1;
	  }
	  
	  let s;
	  if(d < 4 || this.nCnt === 0){
		s = this.abSearch(board, d, -INF_V, INF_V, true);
	  } else {
		
		const delta = Math.max(20, Math.min(100, 30 + scoreVolatility));
		const alpha = Math.max(-INF_V, prevScore - delta);
		const beta = Math.min(INF_V, prevScore + delta);
		s = this.abSearch(board, d, alpha, beta, true);
		
		
		if(this.sStop) {
		  s = this.abSearch(board, d, -INF_V, INF_V, true);
		} else if(s <= alpha) {
		  s = this.abSearch(board, d, -INF_V, alpha + delta, true);
		} else if(s >= beta) {
		  s = this.abSearch(board, d, beta - delta, INF_V, true);
		}
	  }
	  
	  if(this.sStop && d > 1) break;
	  
	  finalDepth = d;
	  bm = this.bestRt;
	  bsc = s;
	  
	  
	  scoreVolatility = Math.abs(bsc - prevScore);
	  prevScore = bsc;
	  
	  const el = Date.now() - this.stTm;
	  const nps = el > 0 ? Math.round(this.nCnt/ (el / 1000)) : 0;
	  const prunedThisDepth = this.prunedCnt - prevPruned;
	  const allPruned = this.prunedCnt + this.razoredCnt + this.futilityCnt + this.lmPruneCnt + this.moveCntPruneCnt;
	  const prunePct = this.nCnt > 0 ? ((allPruned / this.nCnt) * 100).toFixed(1) : '0.0';
	  const mstr = bsc > MATE - MX_PLY ? `M${Math.ceil((MATE - bsc) / 2)}` : bsc < -MATE + MX_PLY ? `-M${Math.ceil((MATE + bsc) / 2)}` : (bsc / 100).toFixed(2);
	  const bestMoveAN = moveToAN(bm, board);
	  const pv = this.extractPV(board, 13);
	  
	  this.srchNfo = `Depth: ${d}\nScore: ${mstr}\nBest: ${bestMoveAN}\nNodes: ${this.nCnt.toLocaleString()}\nTime: ${el}ms\nNPS: ${nps.toLocaleString()}\nPruning: ${prunePct}%`;
	  
	  console.log(`\n${'='.repeat(80)}`);
	  console.log(`Depth ${d} | Score: ${mstr} | Best Move: ${bestMoveAN}`);
	  console.log(`Nodes: ${this.nCnt.toLocaleString()} | All Pruned: ${allPruned.toLocaleString()} (${prunePct}%) | AB: ${this.prunedCnt.toLocaleString()} | Razor: ${this.razoredCnt.toLocaleString()} | Fut: ${this.futilityCnt.toLocaleString()} | LMP: ${this.lmPruneCnt.toLocaleString()} | MCP: ${this.moveCntPruneCnt.toLocaleString()} | Time: ${el}ms | NPS: ${nps.toLocaleString()}`);
	  if(pv.length > 0) {
		console.log(`Principal Variation: ${pv.join(' ')}`);
	  }
	  
	  const ttStats = this.getTTStats();
	  console.log(`TT Hit Rate: ${ttStats.hitRate}% | Exact: ${ttStats.exact} | Beta: ${ttStats.beta} | Alpha: ${ttStats.alpha} | Total Probes: ${ttStats.total}`);
	  console.log(`${'='.repeat(80)}`);
	  if(Math.abs(bsc) > MATE - MX_PLY) break;
	}
	
	// SAFETY: Verify best move is from the correct side before returning
	if(bm){
	  const mf = mF(bm);
	  const pc = board.brd[mf];
	  if(!pc || pC(pc) !== board.sd){
		console.error(`❌ CRITICAL: Search returned move from WRONG SIDE!`);
		console.error(`   Side to move: ${board.sd === WHITE ? 'WHITE' : 'BLACK'}`);
		console.error(`   Move: ${moveToAN(bm, board)}`);
		console.error(`   Piece at ${mf}: ${pc}`);
		console.error(`   This indicates a transposition table or search corruption bug!`);
		return 0;  // Return null move to prevent illegal move
	  }
	  
	  // Verify board state is restored correctly
	  if(board.sd !== initialSd){
		console.error(`❌ CRITICAL: Board.sd not restored after search! Expected ${initialSd}, got ${board.sd}`);
		return 0;
	  }
	  
	  // Validate entire board state
	  if(!this.validateBoardState(board, "After search completion")){
		console.error(`❌ CRITICAL: Board state validation failed after search!`);
		return 0;
	  }
	}
	
	console.log(`\n✓ Search complete. Best move: ${moveToAN(bm, board)} with score ${(bsc/100).toFixed(2)}`);
	return bm;
  }
}
