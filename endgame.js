





class EndgameTable {
  constructor() {
    
    
    
    this.kpk = this.buildKPKTable();
    
    
    
    this.kqk = this.buildKQKTable();
    
    
    
    this.krk = this.buildKRKTable();
    
    
    
    this.kbnk = this.buildKBNKTable();
  }

  
  
  buildKPKTable() {
    
    
    
    
    const table = {};
    const LOSING = 0, DRAWN = 1, WINNING = 2;
    
    
    const pawnRanks = [1, 2, 3, 4, 5, 6]; 
    
    for (let pFile = 0; pFile < 8; pFile++) {
      table[`f${pFile}`] = {};
      
      for (let pRank of pawnRanks) {
        
        const positions = new Uint8Array(64 * 64); 
        
        
        
        
        
        
        const wkSqs = []; 
        const bkSqs = []; 
        
        for (let wKSq = 0; wKSq < 64; wKSq++) {
          for (let bKSq = 0; bKSq < 64; bKSq++) {
            if (wKSq === bKSq) continue; 
            
            const idx = wKSq * 64 + bKSq;
            positions[idx] = this.evaluateKPKPosition(wKSq, bKSq, pFile, pRank);
          }
        }
        
        table[`f${pFile}`][pRank] = positions;
      }
    }
    
    return table;
  }

  
  
  evaluateKPKPosition(wkSq, bkSq, pFile, pRank) {
    
    const wk88 = ((wkSq >> 3) << 4) | (wkSq & 7);
    const bk88 = ((bkSq >> 3) << 4) | (bkSq & 7);
    const p88 = (pRank << 4) | pFile; 
    
    
    
    if (pRank === 6) {
      const prom88 = ((7) << 4) | pFile;
      if (this.isKingAdjacent(wk88, prom88) && !this.isKingAdjacent(bk88, prom88)) {
        return 2; 
      }
    }
    
    
    if (this.isKingAdjacent(bk88, p88)) {
      return 0; 
    }
    
    
    if (this.hasOpposition(wk88, bk88, p88, true)) {
      return 2; 
    }
    
    
    if (this.hasOpposition(wk88, bk88, p88, false)) {
      return 0; 
    }
    
    
    if (this.isKingInFront(wk88, bk88, p88, true)) {
      if (!this.isKingAdjacent(bk88, ((pRank + 1) << 4) | pFile)) {
        return 2; 
      }
    }
    
    
    if (pRank <= 5) {
      
      if (this.isKingInFront(wk88, bk88, p88, true)) {
        return 1; 
      }
    }
    
    
    return 1; 
  }

  isKingAdjacent(k1, k2) {
    const rank1 = k1 >> 4, file1 = k1 & 7;
    const rank2 = k2 >> 4, file2 = k2 & 7;
    return Math.abs(rank1 - rank2) <= 1 && Math.abs(file1 - file2) <= 1;
  }

  hasOpposition(wk, bk, pawn, whitePerspective) {
    
    const wRank = wk >> 4, wFile = wk & 7;
    const bRank = bk >> 4, bFile = bk & 7;
    const pRank = pawn >> 4, pFile = pawn & 7;
    
    
    if (bFile === pFile && wFile === pFile) {
      const between = Math.abs(wRank - bRank);
      return between === 2; 
    }
    
    return false;
  }

  isKingInFront(wk, bk, pawn, whiteMoving) {
    const wRank = wk >> 4, wFile = wk & 7;
    const bRank = bk >> 4;
    const pRank = pawn >> 4, pFile = pawn & 7;
    
    
    if (wFile !== pFile) return false; 
    if (wRank <= pRank) return false; 
    
    return wRank > bRank; 
  }

  
  
  buildKQKTable() {
    const table = new Uint8Array(64 * 64); 
    
    for (let wkSq = 0; wkSq < 64; wkSq++) {
      for (let bkSq = 0; bkSq < 64; bkSq++) {
        if (wkSq === bkSq) continue;
        
        
        
        const wk88 = ((wkSq >> 3) << 4) | (wkSq & 7);
        const bk88 = ((bkSq >> 3) << 4) | (bkSq & 7);
        
        const idx = wkSq * 64 + bkSq;
        table[idx] = this.estimateQueenMateDistance(wk88, bk88);
      }
    }
    
    return table;
  }

  
  estimateQueenMateDistance(wk88, bk88) {
    const wRank = wk88 >> 4, wFile = wk88 & 7;
    const bRank = bk88 >> 4, bFile = bk88 & 7;
    
    const rankDist = Math.abs(wRank - bRank);
    const fileDist = Math.abs(wFile - bFile);
    const kingDist = Math.max(rankDist, fileDist);
    
    
    
    const dist = this.calculateMateDistance(wRank, bRank, wFile, bFile);
    
    
    return Math.min(10, Math.max(1, Math.ceil(dist / 1.5)));
  }

  
  
  buildKRKTable() {
    const table = new Uint8Array(64 * 64); 
    
    for (let wkSq = 0; wkSq < 64; wkSq++) {
      for (let bkSq = 0; bkSq < 64; bkSq++) {
        if (wkSq === bkSq) continue;
        
        const wk88 = ((wkSq >> 3) << 4) | (wkSq & 7);
        const bk88 = ((bkSq >> 3) << 4) | (bkSq & 7);
        
        const idx = wkSq * 64 + bkSq;
        
        table[idx] = this.estimateRookMateDistance(wk88, bk88);
      }
    }
    
    return table;
  }

  estimateRookMateDistance(wk88, bk88) {
    
    const wRank = wk88 >> 4, wFile = wk88 & 7;
    const bRank = bk88 >> 4, bFile = bk88 & 7;
    
    const rankDist = Math.abs(wRank - bRank);
    const fileDist = Math.abs(wFile - bFile);
    const dist = this.calculateMateDistance(wRank, bRank, wFile, bFile);
    
    
    return Math.min(16, Math.max(1, Math.ceil(dist / 1.2)));
  }

  
  
  buildKBNKTable() {
    
    
    
    
    const table = new Uint8Array(64 * 64 * 64); 
    
    for (let wkSq = 0; wkSq < 64; wkSq++) {
      for (let bkSq = 0; bkSq < 64; bkSq++) {
        if (wkSq === bkSq) continue;
        
        for (let bishopSq = 0; bishopSq < 64; bishopSq++) {
          if (bishopSq === wkSq || bishopSq === bkSq) continue;
          
          const idx = wkSq * 64 * 64 + bkSq * 64 + bishopSq;
          
          
          const wk88 = ((wkSq >> 3) << 4) | (wkSq & 7);
          const bk88 = ((bkSq >> 3) << 4) | (bkSq & 7);
          const bs88 = ((bishopSq >> 3) << 4) | (bishopSq & 7);
          
          
          
          const bRank = bkSq >> 3;
          const bFile = bkSq & 7;
          const isEdge = (bRank === 0 || bRank === 7 || bFile === 0 || bFile === 7);
          
          
          const bishopControls = this.bishopControlsEscape(bk88, bs88);
          
          
          table[idx] = (isEdge && bishopControls) ? 1 : 0;
        }
      }
    }
    
    return table;
  }
  
  
  bishopControlsEscape(kingSq, bishopSq) {
    const kRank = kingSq >> 4;
    const kFile = kingSq & 7;
    const bRank = bishopSq >> 4;
    const bFile = bishopSq & 7;
    
    
    const diag1 = kRank - kFile;
    const diag2 = kRank + kFile;
    const bDiag1 = bRank - bFile;
    const bDiag2 = bRank + bFile;
    
    
    return (diag1 === bDiag1 || diag2 === bDiag2);
  }

  
  
  
  
  probeEndgame(board) {
    
    let whiteKing = -1, blackKing = -1;
    let whiteQueens = 0, whiteRooks = 0, whiteKnights = 0, whiteBishops = 0, whitePawns = [];
    let blackQueens = 0, blackRooks = 0, blackKnights = 0, blackBishops = 0, blackPawns = [];
    
    for (let sq = 0; sq < 128; sq++) {
      if (!onB(sq)) continue;
      const p = board.brd[sq];
      if (!p) continue;
      
      const ty = pT(p);
      const c = pC(p);
      const sq64 = ((sq >> 4) << 3) | (sq & 7); 
      
      if (ty === KING) {
        if (c === WHITE) whiteKing = sq64;
        else blackKing = sq64;
      } else if (ty === QUEEN) {
        if (c === WHITE) whiteQueens++;
        else blackQueens++;
      } else if (ty === ROOK) {
        if (c === WHITE) whiteRooks++;
        else blackRooks++;
      } else if (ty === KNIGHT) {
        if (c === WHITE) whiteKnights++;
        else blackKnights++;
      } else if (ty === BISHOP) {
        if (c === WHITE) whiteBishops++;
        else blackBishops++;
      } else if (ty === PAWN) {
        if (c === WHITE) whitePawns.push(sq64);
        else blackPawns.push(sq64);
      }
    }
    
    
    const whitePieces = whiteQueens + whiteRooks + whiteKnights + whiteBishops;
    const blackPieces = blackQueens + blackRooks + blackKnights + blackBishops;
    
    
    if (whitePieces === 0 && blackPieces === 0 && whitePawns.length + blackPawns.length === 1) {
      if (whitePawns.length === 1) {
        const pawnSq64 = whitePawns[0];
        const pFile = pawnSq64 & 7;
        const pRank = (pawnSq64 >> 3); 
        
        if (pRank >= 1 && pRank <= 6) {
          const entry = this.kpk[`f${pFile}`] && this.kpk[`f${pFile}`][pRank];
          if (entry) {
            const idx = whiteKing * 64 + blackKing;
            const result = entry[idx];
            
            let eval_score = 0;
            if (result === 2) eval_score = 500 + (6 - pRank) * 50; 
            else if (result === 1) eval_score = 0; 
            else eval_score = -500 - (6 - pRank) * 50; 
            
            return { isEndgame: true, eval: board.sd === WHITE ? eval_score : -eval_score };
          }
        }
      } else {
        
        const pawnSq64 = blackPawns[0];
        const pFile = pawnSq64 & 7;
        const pRank = 7 - (pawnSq64 >> 3); 
        
        if (pRank >= 1 && pRank <= 6) {
          const entry = this.kpk[`f${pFile}`] && this.kpk[`f${pFile}`][pRank];
          if (entry) {
            const idx = blackKing * 64 + whiteKing; 
            const result = entry[idx];
            
            let eval_score = 0;
            if (result === 2) eval_score = -(500 + (6 - pRank) * 50);
            else if (result === 1) eval_score = 0;
            else eval_score = 500 + (6 - pRank) * 50;
            
            return { isEndgame: true, eval: board.sd === WHITE ? eval_score : -eval_score };
          }
        }
      }
    }
    
    
    if (whiteQueens === 1 && whitePieces === 1 && blackPieces === 0 && whiteKing !== -1 && blackKing !== -1) {
      const idx = whiteKing * 64 + blackKing;
      const mate_distance = this.kqk[idx];
      
      const eval_score = MATE - mate_distance * 10;
      return { isEndgame: true, eval: board.sd === WHITE ? eval_score : -eval_score };
    }
    
    if (blackQueens === 1 && blackPieces === 1 && whitePieces === 0) {
      const idx = blackKing * 64 + whiteKing;
      const mate_distance = this.kqk[idx];
      const eval_score = -(MATE - mate_distance * 10);
      return { isEndgame: true, eval: board.sd === WHITE ? eval_score : -eval_score };
    }
    
    
    if (whiteRooks === 1 && whitePieces === 1 && blackPieces === 0) {
      const idx = whiteKing * 64 + blackKing;
      const mate_distance = this.krk[idx];
      const eval_score = MATE - mate_distance * 8;
      return { isEndgame: true, eval: board.sd === WHITE ? eval_score : -eval_score };
    }
    
    if (blackRooks === 1 && blackPieces === 1 && whitePieces === 0) {
      const idx = blackKing * 64 + whiteKing;
      const mate_distance = this.krk[idx];
      const eval_score = -(MATE - mate_distance * 8);
      return { isEndgame: true, eval: board.sd === WHITE ? eval_score : -eval_score };
    }
    
    
    return { isEndgame: false, eval: 0 };
  }

  calculateMateDistance(r1, r2, f1, f2) {
    return Math.max(Math.abs(r1 - r2), Math.abs(f1 - f2));
  }
}


let ENDGAME_TB = null;

function initEndgameTab() {
  if (!ENDGAME_TB) {
    ENDGAME_TB = new EndgameTable();
  }
}
