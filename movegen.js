class MoveGen {
  
  static N_D = [-33, -31, -18, -14, 14, 18, 31, 33];
  static B_D = [-17, -15, 15, 17];
  static R_D = [-16, -1, 1, 16];
  static K_D = [-17, -16, -15, -1, 1, 15, 16, 17];
  
  static WPAWN_CAPTURES = [15, 17];
  static BPAWN_CAPTURES = [-17, -15];
  
  static genMoves(board, capsOnly = false){
    const mv = [];
    const us = board.sd, th = us ^ 1;
    const pawnCaptures = us === WHITE ? MoveGen.WPAWN_CAPTURES : MoveGen.BPAWN_CAPTURES;
    
    // Generate pawn moves
    for(const sq of board.pieceList[us][PAWN]){
      const dir = us === WHITE ? 16 : -16;
      const sr = us === WHITE ? 1 : 6;
      const pr = us === WHITE ? 7 : 0;
      const fw = sq + dir;
      
      if(onB(fw) && !board.brd[fw]){
        if(rk(fw) === pr){
          mv.push(mkM(sq, fw, 0, mkP(us, QUEEN), FL_N));
          mv.push(mkM(sq, fw, 0, mkP(us, ROOK), FL_N));
          mv.push(mkM(sq, fw, 0, mkP(us, BISHOP), FL_N));
          mv.push(mkM(sq, fw, 0, mkP(us, KNIGHT), FL_N));
        }
        else if(!capsOnly){
          mv.push(mkM(sq, fw, 0, 0, FL_N));
          
          const dd = sq + dir * 2;
          if(rk(sq) === sr && !board.brd[dd])
            mv.push(mkM(sq, dd, 0, 0, FL_P));
        }
      }
      
      for(const cd2 of pawnCaptures){
        const t = sq + cd2;
        if(!onB(t)) continue;
        const cap = board.brd[t];
        if(cap && pC(cap) === th){
          if(rk(t) === pr){
            mv.push(mkM(sq, t, cap, mkP(us, QUEEN), FL_N));
            mv.push(mkM(sq, t, cap, mkP(us, ROOK), FL_N));
            mv.push(mkM(sq, t, cap, mkP(us, BISHOP), FL_N));
            mv.push(mkM(sq, t, cap, mkP(us, KNIGHT), FL_N));
          }else{
            mv.push(mkM(sq, t, cap, 0, FL_N));
          }
        }
        
        if(t === board.epSq)
          mv.push(mkM(sq, t, mkP(th, PAWN), 0, FL_E));
      }
    }
    
    // Generate knight moves
    for(const sq of board.pieceList[us][KNIGHT]){
      for(const d of MoveGen.N_D){
        const t = sq + d;
        if(!onB(t)) continue;
        const tp = board.brd[t];
        if(tp && pC(tp) === us) continue;
        if(capsOnly && !tp) continue;
        mv.push(mkM(sq, t, tp, 0, FL_N));
      }
    }
    
    // Generate bishop moves
    for(const sq of board.pieceList[us][BISHOP]){
      for(const d of MoveGen.B_D){
        let t = sq + d;
        while(onB(t)){
          const tp = board.brd[t];
          if(tp){
            if(pC(tp) !== us) mv.push(mkM(sq, t, tp, 0, FL_N));
            break;
          }
          if(!capsOnly) mv.push(mkM(sq, t, 0, 0, FL_N));
          t += d;
        }
      }
    }
    
    // Generate rook moves
    for(const sq of board.pieceList[us][ROOK]){
      for(const d of MoveGen.R_D){
        let t = sq + d;
        while(onB(t)){
          const tp = board.brd[t];
          if(tp){
            if(pC(tp) !== us) mv.push(mkM(sq, t, tp, 0, FL_N));
            break;
          }
          if(!capsOnly) mv.push(mkM(sq, t, 0, 0, FL_N));
          t += d;
        }
      }
    }
    
    // Generate queen moves
    for(const sq of board.pieceList[us][QUEEN]){
      for(const d of [...MoveGen.B_D, ...MoveGen.R_D]){
        let t = sq + d;
        while(onB(t)){
          const tp = board.brd[t];
          if(tp){
            if(pC(tp) !== us) mv.push(mkM(sq, t, tp, 0, FL_N));
            break;
          }
          if(!capsOnly) mv.push(mkM(sq, t, 0, 0, FL_N));
          t += d;
        }
      }
    }
    
    // Generate king moves
    const kingSq = board.kSq[us];
    for(const d of MoveGen.K_D){
      const t = kingSq + d;
      if(!onB(t)) continue;
      const tp = board.brd[t];
      if(tp && pC(tp) === us) continue;
      if(capsOnly && !tp) continue;
      mv.push(mkM(kingSq, t, tp, 0, FL_N));
    }
    
    // Generate castling moves
    if(!capsOnly && !board.isAttacked(kingSq, th)){
      if(us === WHITE){
        if((board.cas & CWK) && !board.brd[s88(0,5)] && !board.brd[s88(0,6)] && board.brd[s88(0,7)] === mkP(WHITE, ROOK) && !board.isAttacked(s88(0,5), BLACK) && !board.isAttacked(s88(0,6), BLACK))
          mv.push(mkM(kingSq, s88(0,6), 0, 0, FL_C));
        if((board.cas & CWQ) && !board.brd[s88(0,3)] && !board.brd[s88(0,2)] && !board.brd[s88(0,1)] && board.brd[s88(0,0)] === mkP(WHITE, ROOK) && !board.isAttacked(s88(0,3), BLACK) && !board.isAttacked(s88(0,2), BLACK))
          mv.push(mkM(kingSq, s88(0,2), 0, 0, FL_C));
      }else{
        if((board.cas & CBK) && !board.brd[s88(7,5)] && !board.brd[s88(7,6)] && board.brd[s88(7,7)] === mkP(BLACK, ROOK) && !board.isAttacked(s88(7,5), WHITE) && !board.isAttacked(s88(7,6), WHITE))
          mv.push(mkM(kingSq, s88(7,6), 0, 0, FL_C));
        if((board.cas & CBQ) && !board.brd[s88(7,3)] && !board.brd[s88(7,2)] && !board.brd[s88(7,1)] && board.brd[s88(7,0)] === mkP(BLACK, ROOK) && !board.isAttacked(s88(7,3), WHITE) && !board.isAttacked(s88(7,2), WHITE))
          mv.push(mkM(kingSq, s88(7,2), 0, 0, FL_C));
      }
    }
    
    return mv;
  }

  static genLegal(board){
    const ps = MoveGen.genMoves(board, false);
    const lg = [];
    for(const m of ps){
      if(board.doMove(m)){
        lg.push(m);
        board.undoMove(m);
      }
    }
    return lg;
  }
}