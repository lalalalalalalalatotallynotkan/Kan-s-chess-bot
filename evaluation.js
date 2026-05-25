
const EVAL_PAWNS = [new Array(8), new Array(8)];
const EVAL_MIN_RANK = [new Int32Array(8), new Int32Array(8)];
const EVAL_MAX_RANK = [new Int32Array(8), new Int32Array(8)];

// Initialize arrays once
for(let c = 0; c < 2; c++) {
  for(let f = 0; f < 8; f++) {
    EVAL_PAWNS[c][f] = []; // We can clear and reuse lengths instead of re-allocating
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
    
    // === OPTIMIZED: Use piece lists instead of scanning 128 squares ===
    // Iterate only through actual pieces (~32 instead of 128)
    for(let c = 0; c < 2; c++){
      const opp = c ^ 1;
      
      // Check knights and bishops
      for(const sq of board.pieceList[c][KNIGHT]){
        if(board.pieceCount[opp] >= QUEEN){
          threats[c] += 5;
        }
      }
      for(const sq of board.pieceList[c][BISHOP]){
        if(board.pieceCount[opp] >= QUEEN){
          threats[c] += 5;
        }
      }
      
      // Check pawn threats
      for(const sq of board.pieceList[c][PAWN]){
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
    
// === FIX 2: STOP RE-ALLOCATING ARRAYS IN THE HOT PATH ===
    const pawns = EVAL_PAWNS; 
    const minRank = EVAL_MIN_RANK;
    const maxRank = EVAL_MAX_RANK;
    const bishops = [0, 0];
    const kingSq = [board.kSq[WHITE], board.kSq[BLACK]];
    const kingFile = [fl(kingSq[WHITE]), fl(kingSq[BLACK])];
    const kingRank = [rk(kingSq[WHITE]), rk(kingSq[BLACK])];
    
    for (let c = 0; c < 2; c++) {
      for (let f = 0; f < 8; f++) {
        pawns[c][f].length = 0; // Instantly empties array without memory allocation
        minRank[c][f] = 8;
        maxRank[c][f] = -1;
      }
    }
    
    let mg = 0, eg = 0, ph = 0;
    const phI = [0, 0, 1, 1, 2, 4, 0];
    const pieces = [[], []];
    
    // === OPTIMIZED: Use piece lists instead of scanning 128 squares ===
    // Only iterate through actual pieces (avg 32 instead of 128)
    for(let c = 0; c < 2; c++){
      const sgn = c === WHITE ? 1 : -1;
      
      // Iterate through each piece type
      for(let ty = PAWN; ty <= KING; ty++){
        for(const sq of board.pieceList[c][ty]){
          const r = rk(sq);
          const f2 = fl(sq);
          const pr = c === WHITE ? 7 - r : r;
          const mat = PV[ty];
          
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
          
          if(ty === PAWN){
            const pawnsForColor = pawns[c];
            const pawnFile = pawnsForColor[f2];
            pawnFile.push(r);
            if(r < minRank[c][f2]) minRank[c][f2] = r;
            if(r > maxRank[c][f2]) maxRank[c][f2] = r;
          } else if(ty === BISHOP){
            bishops[c]++;
          }
          
          pieces[c].push({sq, type: ty, file: f2, rank: r});
        }
      }
    }
    
    for (let c = 0; c < 2; c++) {
      const pcList = pieces[c];
      const sgn = c === WHITE ? 1 : -1;
      for (let i = 0; i < pcList.length; i++) {
        const piece = pcList[i];
        const ty = piece.type;
        const f = piece.file;
        const r = piece.rank;
        
        
        if (ty === PAWN && f >= 3 && f <= 4 && r >= 3 && r <= 4) {
          mg += sgn * 30;
        }
        
        
        if (ty !== PAWN && ty !== KING && f >= 2 && f <= 5 && r >= 2 && r <= 5) {
          mg += sgn * (ty === KNIGHT || ty === BISHOP ? 15 : 10);
        }
      }
    }
    
    
    let wPawns = 0, bPawns = 0;
    const opp = [BLACK, WHITE];  
    
    for (let c = 0; c < 2; c++) {
      let pawnScore = 0;
      const oppIdx = opp[c];
      
      for (let f = 0; f < 8; f++) {
        const filePawns = pawns[c][f];
        if (!filePawns.length) continue;
        
        
        if (filePawns.length > 1) pawnScore -= 25 * (filePawns.length - 1);
        
        for (let i = 0; i < filePawns.length; i++) {
          const r = filePawns[i];
          
          
          let hasPhalanxSupport = false;
          if (f > 0) {
            const left = pawns[c][f - 1];
            for (let j = 0; j < left.length; j++) {
              if (left[j] === r) { hasPhalanxSupport = true; break; }
            }
          }
          if (!hasPhalanxSupport && f < 7) {
            const right = pawns[c][f + 1];
            for (let j = 0; j < right.length; j++) {
              if (right[j] === r) { hasPhalanxSupport = true; break; }
            }
          }
          
          if (hasPhalanxSupport) pawnScore += 15;
          
          
          let hasAllySupport = hasPhalanxSupport;
          if (!hasAllySupport) {
            hasAllySupport = (f > 0 && pawns[c][f - 1].length > 0) || (f < 7 && pawns[c][f + 1].length > 0);
          }
          
          
          if (!hasAllySupport) {
            pawnScore -= 20;
            const advSq = r + (c === WHITE ? 1 : -1);
            if (advSq >= 0 && advSq <= 7) {
              for (let af = f - 1; af <= f + 1; af += 2) {
                if (af >= 0 && af <= 7) {
                  if ((oppIdx === BLACK && maxRank[oppIdx][af] > advSq) ||
                      (oppIdx === WHITE && minRank[oppIdx][af] < advSq)) {
                    pawnScore -= 10;
                  }
                }
              }
            }
          }
          
          
          let isPassed = true;
          for (let ofile = f - 1; ofile <= f + 1; ofile++) {
            if (ofile < 0 || ofile > 7) continue;
            if ((oppIdx === WHITE && minRank[oppIdx][ofile] < r) ||
                (oppIdx === BLACK && maxRank[oppIdx][ofile] > r)) {
              isPassed = false;
              break;
            }
          }
          
          if (isPassed) {
            const advancement = c === WHITE ? 7 - r : r;
            pawnScore += 30 + advancement * 8;
            
            
            const promoRank = c === WHITE ? 7 : 0;
            const distOwn = Math.max(Math.abs(f - kingFile[c]), Math.abs(r - kingRank[c]));
            const distOpp = Math.max(Math.abs(f - kingFile[oppIdx]), Math.abs(r - kingRank[oppIdx]));
            pawnScore += (distOpp - distOwn) * 3;
            
            
            if (advancement >= 4) pawnScore += 8;
            if (advancement >= 5 && Math.abs(promoRank - kingRank[oppIdx]) > 1) pawnScore += 10;
          }
        }
      }
      
      if (c === WHITE) wPawns = pawnScore;
      else bPawns = pawnScore;
    }
    
    
    let wSafety = 0, bSafety = 0;
    for (let c = 0; c < 2; c++) {
      let safety = 0;
      const ksq = kingSq[c];
      const f0 = fl(ksq);
      
      
      let shieldCount = 0;
      for (let df = -1; df <= 1; df++) {
        const f = f0 + df;
        if (f >= 0 && f <= 7 && pawns[c][f].length > 0) shieldCount++;
      }
      safety -= (3 - shieldCount) * 10;
      
      
      for (let df = -1; df <= 1; df++) {
        const f = f0 + df;
        if (f >= 0 && f <= 7 && pawns[WHITE][f].length + pawns[BLACK][f].length === 0) {
          safety -= 10;
        }
      }
      
      if (c === WHITE) wSafety = safety;
      else bSafety = safety;
    }
    
    
    let wTropism = 0, bTropism = 0;
    for (let c = 0; c < 2; c++) {
      let tropism = 0;
      const oppIdx = c ^ 1;
      const oppKSq = kingSq[oppIdx];
      const oppKFile = fl(oppKSq);
      const oppKRank = rk(oppKSq);
      
      const pcList = pieces[c];
      for (let i = 0; i < pcList.length; i++) {
        const piece = pcList[i];
        if (piece.type === KING) continue;
        
        const fileDist = Math.abs(piece.file - oppKFile);
        const rankDist = Math.abs(piece.rank - oppKRank);
        const dist = Math.max(fileDist, rankDist);
        
        if (dist <= 3) {
          tropism += 5 + (3 - dist) * 2;
        }
      }
      
      if (c === WHITE) wTropism = tropism;
      else bTropism = tropism;
    }
    
    
    let wActivity = 0, bActivity = 0;
    for (let c = 0; c < 2; c++) {
      let act = 0;
      const oppIdx = c ^ 1;
      const pcList = pieces[c];
      
      for (let i = 0; i < pcList.length; i++) {
        const piece = pcList[i];
        const ty = piece.type;
        const f = piece.file;
        const r = piece.rank;
        
        
        if (f >= 2 && f <= 5 && r >= 2 && r <= 5) act += 5;
        
        
        if (ty === KNIGHT) {
          let isOutpost = true;
          for (let af = f - 1; af <= f + 1; af += 2) {
            if (af >= 0 && af <= 7) {
              const front = r + (c === WHITE ? 1 : -1);
              if (front >= 0 && front <= 7) {
                if ((oppIdx === WHITE && minRank[oppIdx][af] === front) ||
                    (oppIdx === BLACK && maxRank[oppIdx][af] === front)) {
                  isOutpost = false;
                }
              }
            }
          }
          if (isOutpost) act += 25;
        }
        
        
        if (ty === ROOK) {
          const seventh = c === WHITE ? 1 : 6;
          if (r === seventh) act += 20;
        }
        
        
        if (ty === ROOK || ty === QUEEN) {
          const filePawns = pawns[WHITE][f].length + pawns[BLACK][f].length;
          if (filePawns === 0) act += 15;
          else if (pawns[oppIdx][f].length > 0) {
            if (c === WHITE && maxRank[oppIdx][f] < r) act += 10;
            if (c === BLACK && minRank[oppIdx][f] > r) act += 10;
          }
        }
      }
      
      
      if (bishops[c] === 2) act += 50;
      
      
      
// === FIX: Use the populated 'pieces' 2D array instead of non-existent variables ===
      if (c === WHITE && bishops[WHITE] === 1 && bishops[BLACK] === 1) {
        const wBishop = pieces[WHITE].find(p => p.type === BISHOP);
        const bBishop = pieces[BLACK].find(p => p.type === BISHOP);
        if (wBishop && bBishop) {
          // Check if bishops are on the same square color using 0x88 rank & file coordinates
          const wColor = (wBishop.rank + wBishop.file) % 2;
          const bColor = (bBishop.rank + bBishop.file) % 2;
          
          if (wColor === bColor) {
            // Opposite-colored bishop endgame adjustment/penalty
            act -= 15;
          }
        }
      }
      if (c === WHITE) wActivity = act;
      else bActivity = act;
    }
    
    
    const mgBonus = wActivity - bActivity + (wSafety - bSafety) * 0.6;
    const egBonus = (wPawns - bPawns) * 0.5 + (wSafety - bSafety) * 0.2;
    mg += mgBonus;
    eg += egBonus;
    
    
    
    const totalMaterial = Math.abs(mg);
    if (totalMaterial < 200) {
      
      const tempoBonus = 10;
      if (board.sd === WHITE) {
        mg += tempoBonus;
      } else {
        mg -= tempoBonus;
      }
    }
    
    
    
    
    if (typeof contemptFactor !== 'undefined' && contemptFactor !== 0) {
      
      
      const contempt = contemptFactor;
      if (board.sd === WHITE) {
        mg += contempt;
      } else {
        mg -= contempt;
      }
    }
    
    ph = Math.min(ph, 24);
    let s = Math.round((mg * ph + eg * (24 - ph)) / 24);
    const mobility = this.calcMobility(board);
    s += (mobility[WHITE] - mobility[BLACK]) * 0.5;
    s += this.calcSpace(board) * 0.3;
    s += this.calcCoordination(board);
    // ... previous code ...
    s += (mobility[WHITE] - mobility[BLACK]) * 0.5;
    s += this.calcSpace(board) * 0.3;
    s += this.calcCoordination(board);

    // === FIX 1: CLASSICAL OPENING HEURISTIC ===
    // If the board is full (early game), reward classical pawn centers 
    // and penalize bringing knights out before center pawns.
    if (board.pieceCount[WHITE] + board.pieceCount[BLACK] >= 30) {
      let openingBonus = 0;
      
      // Reward White for central pawn control
      if (board.brd[s88(3, 4)] === mkP(WHITE, PAWN)) openingBonus += 35; // e4
      if (board.brd[s88(3, 3)] === mkP(WHITE, PAWN)) openingBonus += 35; // d4
      if (board.brd[s88(2, 2)] === mkP(WHITE, PAWN)) openingBonus += 20; // c3 (support)
      
      // Reward Black for central pawn responses
      if (board.brd[s88(4, 4)] === mkP(BLACK, PAWN)) openingBonus -= 35; // e5
      if (board.brd[s88(4, 3)] === mkP(BLACK, PAWN)) openingBonus -= 35; // d5
      if (board.brd[s88(4, 2)] === mkP(BLACK, PAWN)) openingBonus -= 25; // c5
      
      // Penalize developing knights before moving a center pawn
      if (board.brd[s88(2, 5)] === mkP(WHITE, KNIGHT) && board.brd[s88(3, 4)] !== mkP(WHITE, PAWN)) openingBonus -= 15; // Nf3 before e4
      if (board.brd[s88(5, 5)] === mkP(BLACK, KNIGHT) && board.brd[s88(4, 4)] !== mkP(BLACK, PAWN)) openingBonus += 15; // Nf6 before e5

      s += openingBonus;
    }

    return board.sd === WHITE ? s : -s;
  } // <-- End of evaluate() method
  
  
  
  
  
  static calcMobility(board) {
    const mobility = [0, 0];
    const dirs = [
      [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]
    ];
    const knightMoves = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    // === OPTIMIZED: Use piece lists instead of scanning 128 squares ===
    // Reduces from 128 to ~32 iterations average (4x speedup)
    for(let c = 0; c < 2; c++){
      // Pawn mobility
      for(const sq of board.pieceList[c][PAWN]){
        let moves = 0;
        const dir = c === WHITE ? 1 : -1;
        const forward = sq + (dir * 16);
        if(onB(forward) && !board.brd[forward]) moves++;
        for(let df of [-1, 1]){
          const capSq = sq + (dir * 16) + df;
          if(onB(capSq)){
            const capP = board.brd[capSq];
            if(capP && pC(capP) !== c) moves++;
          }
        }
        mobility[c] += moves;
      }
      
      // Knight mobility
      for(const sq of board.pieceList[c][KNIGHT]){
        let moves = 0;
        for(let m of knightMoves){
          const ns = sq + (m[0] * 16) + m[1];
          if(onB(ns)){
            const tp = board.brd[ns];
            if(!tp || pC(tp) !== c) moves++;
          }
        }
        mobility[c] += moves;
      }
      
      // Bishop mobility
      for(const sq of board.pieceList[c][BISHOP]){
        let moves = 0;
        for(let d = 0; d < 4; d++){
          for(let i = 1; i < 8; i++){
            const ns = sq + dirs[d][0] * i * 16 + dirs[d][1] * i;
            if(!onB(ns)) break;
            const tp = board.brd[ns];
            if(tp){
              if(pC(tp) !== c) moves++;
              break;
            }
            moves++;
          }
        }
        mobility[c] += moves;
      }
      
      // Rook mobility
      for(const sq of board.pieceList[c][ROOK]){
        let moves = 0;
        for(let d = 0; d < 4; d++){
          for(let i = 1; i < 8; i++){
            const ns = sq + dirs[d][0] * i * 16 + dirs[d][1] * i;
            if(!onB(ns)) break;
            const tp = board.brd[ns];
            if(tp){
              if(pC(tp) !== c) moves++;
              break;
            }
            moves++;
          }
        }
        mobility[c] += moves;
      }
      
      // Queen mobility
      for(const sq of board.pieceList[c][QUEEN]){
        let moves = 0;
        for(let d = 0; d < 8; d++){
          for(let i = 1; i < 8; i++){
            const ns = sq + dirs[d][0] * i * 16 + dirs[d][1] * i;
            if(!onB(ns)) break;
            const tp = board.brd[ns];
            if(tp){
              if(pC(tp) !== c) moves++;
              break;
            }
            moves++;
          }
        }
        mobility[c] += moves;
      }
      
      // King mobility
      const kSq = board.kSq[c];
      let moves = 0;
      for(let d = 0; d < 8; d++){
        const ns = kSq + dirs[d][0] * 16 + dirs[d][1];
        if(onB(ns)){
          const tp = board.brd[ns];
          if(!tp || pC(tp) !== c) moves++;
        }
      }
      mobility[c] += moves;
    }
    
    return mobility;
  }
  
  
  static calcSpace(board) {
    let space = 0;
    
    // === OPTIMIZED: Use piece lists instead of scanning 128 squares ===
    // Iterate only through actual pieces (~32 vs 128)
    for(let c = 0; c < 2; c++){
      const sgn = c === WHITE ? 1 : -1;
      
      for(let ty = PAWN; ty <= KING; ty++){
        for(const sq of board.pieceList[c][ty]){
          const f = fl(sq);
          const r = rk(sq);
          
          if(f >= 2 && f <= 5 && r >= 2 && r <= 5){
            space += sgn * (f >= 3 && f <= 4 && r >= 3 && r <= 4 ? 3 : 1);
          }
        }
      }
    }
    
    return space;
  }
  
  
  static calcCoordination(board) {
    let coord = 0;
    
    // === OPTIMIZED: Use piece lists instead of scanning 128 squares ===
    // Directly use pieceList arrays (already organized by color/type)
    for(let c = 0; c < 2; c++){
      const opp = c ^ 1;
      
      // Get all pieces for this color from piece lists
      const allPieces = [];
      for(let ty = PAWN; ty <= KING; ty++){
        for(const sq of board.pieceList[c][ty]){
          allPieces.push(sq);
        }
      }
      for(let i = 0; i < allPieces.length; i++){
        const sq1 = allPieces[i];
        for(let j = 0; j < allPieces.length; j++){
          if(i === j) continue;
          // Math logic...
          const sq2 = allPieces[j];
          
          const dist = Math.max(Math.abs(fl(sq1) - fl(sq2)), Math.abs(rk(sq1) - rk(sq2)));
          if(dist <= 2){
            const p1Type = pT(board.brd[sq1]);
            const p2Type = pT(board.brd[sq2]);
            const sgn = c === WHITE ? 1 : -1;
            if(p1Type !== KING && p2Type !== KING){
              coord += sgn * 3;
            }
          }
        }
      }
    }
    
    return coord;
  }
}
