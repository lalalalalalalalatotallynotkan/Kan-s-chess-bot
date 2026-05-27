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
    
    // === CALCULATE TOTAL MATERIAL (needed for bonuses) ===
    const totalMat = board.pieceCount[0] + board.pieceCount[1];
    
    // === PIECE PAIR BONUSES ===
    let pairBonus = 0;
    for (let c = 0; c < 2; c++) {
      const sgn = c === WHITE ? 1 : -1;
      let bishopCount = 0;
      let rookCount = 0;
      
      for (const piece of pieces[c]) {
        if (piece.type === BISHOP) bishopCount++;
        if (piece.type === ROOK) rookCount++;
      }
      
      // Bishop pair bonus (significant in open positions)
      if (bishopCount >= 2) {
        const bishopPairBonus = totalMat < 25 ? 25 : 15;
        pairBonus += sgn * bishopPairBonus;
      }
      
      // Rook pair bonus (lesser bonus)
      if (rookCount >= 2) {
        pairBonus += sgn * 5;
      }
    }
    
    // === PAWN STRUCTURE (ENHANCED) ===
    let pawnBonus = 0;
    if(totalMat < 30){  // Only in mid/endgame
      const opp = [BLACK, WHITE];  
      for (let c = 0; c < 2; c++) {
        const sgn = c === WHITE ? 1 : -1;
        const oppIdx = opp[c];
        for (let f = 0; f < 8; f++) {
          const filePawns = pawns[c][f];
          if (!filePawns.length) {
            // Open file for opponent (no pawns) - minor penalty
            pawnBonus += sgn * -3;
            continue;
          }
          
          // Doubled pawns penalty
          if (filePawns.length > 1) pawnBonus += sgn * (-25);
          
          for (let i = 0; i < filePawns.length; i++) {
            const r = filePawns[i];
            
            // Passed pawns bonus (most important pawn feature)
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
              const passedBonus = 20 + advancement * 12;  // Enhanced bonus
              pawnBonus += sgn * passedBonus;
            } else {
              // Isolated pawn penalty (no pawns on adjacent files)
              const hasLeft = f > 0 && pawns[c][f - 1].length > 0;
              const hasRight = f < 7 && pawns[c][f + 1].length > 0;
              if (!hasLeft && !hasRight) {
                pawnBonus += sgn * -15;
              }
              
              // Backward pawn penalty (blocked, undefended)
              if (i === filePawns.length - 1 && f > 0 && f < 7) {
                const leftFile = pawns[c][f - 1];
                const rightFile = pawns[c][f + 1];
                const canSupport = (leftFile.length > 0 && leftFile[leftFile.length - 1] > r) ||
                                  (rightFile.length > 0 && rightFile[rightFile.length - 1] > r);
                if (!canSupport) {
                  pawnBonus += sgn * -10;
                }
              }
            }
          }
        }
      }
    }
    
    // === PIECE ACTIVITY (ENHANCED) ===
    let activity = 0;
    for (let c = 0; c < 2; c++) {
      const sgn = c === WHITE ? 1 : -1;
      const oppKSq = board.kSq[c ^ 1];
      const oppKFile = fl(oppKSq);
      const oppKRank = rk(oppKSq);
      
      for (const piece of pieces[c]) {
        const ty = piece.type;
        if(ty === KING) continue;
        
        // Centralization bonus (more valuable in middlegame)
        if (piece.file >= 2 && piece.file <= 5 && piece.rank >= 2 && piece.rank <= 5) {
          activity += sgn * (8 + (ty === KNIGHT ? 4 : 2));
        }
        
        // Tropism (distance to enemy king) - important for attack
        const dist = Math.max(Math.abs(piece.file - oppKFile), Math.abs(piece.rank - oppKRank));
        if (dist <= 4) {
          const tropismBonus = ty === KNIGHT ? (4 - dist) * 3 : (4 - dist) * 2;
          activity += sgn * tropismBonus;
        }
        
        // Knight on outpost (can't be attacked by enemy pawns)
        if (ty === KNIGHT && totalMat < 25) {
          const isOutpost = true;
          // Check if attacked by enemy pawns
          const pawnAttackDir = c === WHITE ? -16 : 16;
          for (const offset of [-1, 1]) {
            const pawnSq = piece.sq + pawnAttackDir + offset;
            if (pawnSq >= 0 && pawnSq < 128 && (pawnSq & 0x88) === 0) {
              const p = board.brd[pawnSq];
              if (p && pT(p) === PAWN && pC(p) === (c ^ 1)) {
                // Outpost exists: not attacked by pawns
                activity += sgn * 15;
              }
            }
          }
        }
        
        // Rook on open/semi-open file
        if (ty === ROOK && totalMat < 25) {
          const f = piece.file;
          const whiteHasPawn = minRank[WHITE][f] < 8;
          const blackHasPawn = maxRank[BLACK][f] >= 0;
          if (!whiteHasPawn || !blackHasPawn) {
            const openFileBonus = (!whiteHasPawn && !blackHasPawn) ? 12 : 6;
            activity += sgn * openFileBonus;
          }
        }
      }
    }
    
    // === KING SAFETY (ENHANCED) ===
    let kingSafety = 0;
    if (totalMat >= 25) {  // Only in middlegame/early endgame
      for (let c = 0; c < 2; c++) {
        const sgn = c === WHITE ? 1 : -1;
        const ksq = board.kSq[c];
        const kr = rk(ksq);
        const kf = fl(ksq);
        
        // Pawn shield scoring (already calculated above)
        kingSafety += sgn * this.calcKingSafety(board, c);
        
        // Penalty for exposed king (open files/diagonals to enemy)
        let exposure = 0;
        const f = fl(ksq);
        if (f <= 1 || f >= 6) {
          exposure -= 10;  // Bonus for castled position
        } else {
          exposure += 15;  // Penalty for uncastled in center
        }
        kingSafety += sgn * exposure;
      }
    }
    
    // === FINAL CALCULATION ===
    ph = Math.min(ph, 24);
    let s = Math.round((mg * ph + eg * (24 - ph)) / 24);
    
    s += pawnBonus;
    s += activity;
    s += kingSafety;
    s += pairBonus;  // Add piece pair bonuses
    s += this.calcThreats(board) * 0.25;  // Slight weight increase
    
    // Tempo bonus in endgame (side to move advantage)
    if (totalMat < 200) {
      const tempoBonus = 12;
      if (board.sd === WHITE) {
        s += tempoBonus;
      } else {
        s -= tempoBonus;
      }
    }
    
    // Opening heuristic (control center)
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
    return [0, 0];
  }

  static calcSpace(board) {
    return 0;
  }

  static calcCoordination(board) {
    return 0;
  }
}
