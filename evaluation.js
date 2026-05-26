const EVAL_PAWNS = [new Array(8), new Array(8)];
const EVAL_MIN_RANK = [new Int32Array(8), new Int32Array(8)];
const EVAL_MAX_RANK = [new Int32Array(8), new Int32Array(8)];

for(let c = 0; c < 2; c++) {
  for(let f = 0; f < 8; f++) {
    EVAL_PAWNS[c][f] = [];
  }
}

class Evaluation {
  
  static calcKingSafety(board, color) {
    const ksq = board.kSq[color];
    const f = fl(ksq);
    const r = rk(ksq);
    const forward = color === WHITE ? -1 : 1;
    let safety = 0;
    
    for (let df = -1; df <= 1; df++) {
      const sf = f + df;
      if (sf >= 0 && sf <= 7) {
        const shieldSq = s88(r + forward, sf);
        const p = board.brd[shieldSq];
        if (p && pT(p) === PAWN && pC(p) === color) {
          safety += 15;
        }
      }
    }
    
    for (let df = -1; df <= 1; df++) {
      const sf = f + df;
      if (sf >= 0 && sf <= 7) {
        const shieldSq = s88(r + forward * 2, sf);
        const p = board.brd[shieldSq];
        if (p && pT(p) === PAWN && pC(p) === color) {
          safety += 5;
        }
      }
    }
    
    if (color === WHITE) {
      if (r === 0 && f <= 1) safety += 20; 
      if (r === 0 && f >= 6) safety += 20;
    } else {
      if (r === 7 && f <= 1) safety += 20;
      if (r === 7 && f >= 6) safety += 20;
    }
    
    return safety;
  }
  
  static calcInitiative(board, egEval) {
    const totalMaterial = board.pieceCount[0] + board.pieceCount[1];
    if (totalMaterial <= 4) return 0;
    
    let initiative = 8;
    if (Math.abs(egEval) < 100) {
      initiative += 6;
    }
    
    const moveNum = board.hmc / 2;
    if (moveNum < 10) initiative += 5;
    else if (moveNum < 30) initiative += 2;
    
    return board.sd === WHITE ? initiative : -initiative;
  }
  
  static calcThreats(board) {
    let threats = [0, 0]; 
    
    for(let sq = 0; sq < 128; sq++){
      if(!onB(sq)) continue;
      const p = board.brd[sq];
      if(!p) continue;
      
      const c = pC(p), ty = pT(p);
      const opp = c ^ 1;
      
      if((ty === KNIGHT || ty === BISHOP) && board.pieceCount[opp] >= QUEEN){
        threats[c] += 5;
      }
      
      if(ty === PAWN){
        const dir = c === WHITE ? 1 : -1;
        for(let df of [-1, 1]){
          const capSq = sq + dir * 16 + df;
          if(onB(capSq)){
            const capP = board.brd[capSq];
            if(capP && pC(capP) === opp){
              const capTy = pT(capP);
              if(capTy >= KNIGHT && capTy <= QUEEN){
                threats[c] += 10 * capTy;
              }
            }
          }
        }
      }
    }
    
    return threats[WHITE] - threats[BLACK];
  }
  
  static isDrawish(board) {
    const totalMaterial = board.pieceCount[0] + board.pieceCount[1];
    if (totalMaterial <= 3) return true;
    
    if (totalMaterial === 4) {
      const hasOnlyKing = (board.pieceCount[WHITE] === 1 && board.pieceCount[BLACK] === 3) ||
                         (board.pieceCount[BLACK] === 1 && board.pieceCount[WHITE] === 3);
      if (hasOnlyKing) return true;
    }
    
    if (board.hmc >= 100) return true;
    
    return false;
  }

  static evaluate(board) {
    const egProbe = ENDGAME_TB.probeEndgame(board);
    if (egProbe.isEndgame) {
      return egProbe.eval; 
    }
    
    const pawns = EVAL_PAWNS; 
    const minRank = EVAL_MIN_RANK;
    const maxRank = EVAL_MAX_RANK;
    
    for (let c = 0; c < 2; c++) {
      for (let f = 0; f < 8; f++) {
        pawns[c][f].length = 0;
        minRank[c][f] = 8;
        maxRank[c][f] = -1;
      }
    }
    
    let mg = 0, eg = 0, ph = 0;
    const phI = [0, 0, 1, 1, 2, 4, 0];
    const pieces = [[], []];
    
    // === MAIN LOOP: Scan board for all pieces ===
    for(let sq = 0; sq < 128; sq++){
      if(!onB(sq)) continue;
      const p = board.brd[sq];
      if(!p) continue;
      
      const c = pC(p), ty = pT(p);
      const sgn = c === WHITE ? 1 : -1;
      const r = rk(sq);
      const f2 = fl(sq);
      const pr = c === WHITE ? 7 - r : r;
      
      const mat = PV[ty];
      
      // Material + PST
      if(ty >= PAWN && ty <= QUEEN){
        const pst = PST_TBL[ty][pr][f2];
        mg += sgn * (mat + pst);
        eg += sgn * (mat + pst);
      } else if(ty === KING){
        const km = PST_KM[pr][f2];
        const ke = PST_KE[pr][f2];
        mg += sgn * (mat + km);
        eg += sgn * (mat + ke);
      }
      
      ph += phI[ty];
      
      // Track pawns
      if(ty === PAWN){
        pawns[c][f2].push(r);
        if(r < minRank[c][f2]) minRank[c][f2] = r;
        if(r > maxRank[c][f2]) maxRank[c][f2] = r;
      }
      
      // Track pieces for activity
      pieces[c].push({sq, type: ty, file: f2, rank: r});
    }
    
    // === PAWN STRUCTURE (skip in opening for speed) ===
    let pawnBonus = 0;
    const totalMat = board.pieceCount[0] + board.pieceCount[1];
    if(totalMat < 28){  // Only in mid/endgame
      const opp = [BLACK, WHITE];  
      for (let c = 0; c < 2; c++) {
        const oppIdx = opp[c];
        for (let f = 0; f < 8; f++) {
          const filePawns = pawns[c][f];
          if (!filePawns.length) continue;
          
          // Doubled pawns penalty
          if (filePawns.length > 1) pawnBonus += (c === WHITE ? 1 : -1) * (-25);
          
          for (let i = 0; i < filePawns.length; i++) {
            const r = filePawns[i];
            
            // Passed pawns bonus
            let isPassed = true;
            for (let ofile = Math.max(0, f - 1); ofile <= Math.min(7, f + 1); ofile++) {
              if ((oppIdx === WHITE && minRank[oppIdx][ofile] < r) ||
                  (oppIdx === BLACK && maxRank[oppIdx][ofile] > r)) {
                isPassed = false;
                break;
              }
            }
            
            if (isPassed) {
              const advancement = c === WHITE ? 7 - r : r;
              pawnBonus += (c === WHITE ? 1 : -1) * (30 + advancement * 8);
            }
          }
        }
      }
    }
    
    // === PIECE ACTIVITY (fast version) ===
    let activity = 0;
    for (let c = 0; c < 2; c++) {
      const sgn = c === WHITE ? 1 : -1;
      const oppKSq = board.kSq[c ^ 1];
      const oppKFile = fl(oppKSq);
      const oppKRank = rk(oppKSq);
      
      for (const piece of pieces[c]) {
        const ty = piece.type;
        if(ty === KING) continue;
        
        // Centralization
        if (piece.file >= 2 && piece.file <= 5 && piece.rank >= 2 && piece.rank <= 5) {
          activity += sgn * 5;
        }
        
        // Tropism (distance to enemy king)
        const dist = Math.max(Math.abs(piece.file - oppKFile), Math.abs(piece.rank - oppKRank));
        if (dist <= 3) {
          activity += sgn * (5 + (3 - dist) * 2);
        }
      }
    }
    
    // === FINAL CALCULATION ===
    ph = Math.min(ph, 24);
    let s = Math.round((mg * ph + eg * (24 - ph)) / 24);
    
    s += pawnBonus;
    s += activity;
    s += this.calcThreats(board) * 0.2;
    
    // Tempo bonus in endgame
    if (totalMat < 200) {
      const tempoBonus = 10;
      if (board.sd === WHITE) {
        s += tempoBonus;
      } else {
        s -= tempoBonus;
      }
    }
    
    // Opening heuristic  
    if (totalMat >= 30) {
      let openingBonus = 0;
      if (board.brd[s88(3, 4)] === mkP(WHITE, PAWN)) openingBonus += 35;
      if (board.brd[s88(3, 3)] === mkP(WHITE, PAWN)) openingBonus += 30;
      if (board.brd[s88(4, 4)] === mkP(BLACK, PAWN)) openingBonus -= 35;
      if (board.brd[s88(4, 3)] === mkP(BLACK, PAWN)) openingBonus -= 30;
      s += openingBonus;
    }
    
    return board.sd === WHITE ? s : -s;
  }

  calcMobility(board) {
    // REMOVED: This was broken and expensive
    return [0, 0];
  }

  static calcSpace(board) {
    // REMOVED: Not worth the cost
    return 0;
  }

  static calcCoordination(board) {
    // REMOVED: Not worth the cost
    return 0;
  }
}
