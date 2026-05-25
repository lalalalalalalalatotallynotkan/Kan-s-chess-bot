




const FEN_PIECE_MAP = {
  'P': mkP(WHITE, PAWN), 'N': mkP(WHITE, KNIGHT), 'B': mkP(WHITE, BISHOP),
  'R': mkP(WHITE, ROOK), 'Q': mkP(WHITE, QUEEN), 'K': mkP(WHITE, KING),
  'p': mkP(BLACK, PAWN), 'n': mkP(BLACK, KNIGHT), 'b': mkP(BLACK, BISHOP),
  'r': mkP(BLACK, ROOK), 'q': mkP(BLACK, QUEEN), 'k': mkP(BLACK, KING)
};

class Board {
  constructor(){
    this.brd = new Array(128).fill(0);
    this.sd = WHITE;
    this.cas = 15;
    this.epSq = -1;
    this.hmc = 0;
    this.kSq = [0, 0];
    this.sStk = [];
    this.hKey = 0;
    this.CM = new Array(128).fill(15);
    this.pieceCount = [0, 0];
    
    // === PIECE LISTS (Like Stockfish) ===
    // Track piece positions directly instead of scanning 128-element array
    // Format: pieceList[color][pieceType] = array of square indices
    this.pieceList = [
      [[], [], [], [], [], [], []],  // WHITE: EMPTY, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING
      [[], [], [], [], [], [], []]   // BLACK: EMPTY, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING
    ];
    
    this.initCastleMask();
  }

  // === PIECE LIST MANAGEMENT (Stockfish-style) ===
  // Rebuild piece lists from current board state
  rebuildPieceLists(){
    // Clear all piece lists
    for(let c = 0; c < 2; c++){
      for(let t = 0; t < 7; t++){
        this.pieceList[c][t].length = 0;  // Fast clear
      }
    }
    // Scan board and populate piece lists - only 32 pieces max!
    for(let sq = 0; sq < 128; sq++){
      if(!onB(sq)) continue;
      const p = this.brd[sq];
      if(!p) continue;
      const c = pC(p);
      const t = pT(p);
      this.pieceList[c][t].push(sq);
    }
  }

  addPiece(sq, piece){
    const c = pC(piece);
    const t = pT(piece);
    this.pieceList[c][t].push(sq);
  }

  removePiece(sq, piece){
    const c = pC(piece);
    const t = pT(piece);
    const list = this.pieceList[c][t];
    const idx = list.indexOf(sq);
    if(idx !== -1) list.splice(idx, 1);
  }

  initCastleMask(){
    for(let s = 0; s < 128; s++) this.CM[s] = 15;
    this.CM[s88(0, 0)] = ~CWQ & 15;
    this.CM[s88(0, 4)] = ~(CWK | CWQ) & 15;
    this.CM[s88(0, 7)] = ~CWK & 15;
    this.CM[s88(7, 0)] = ~CBQ & 15;
    this.CM[s88(7, 4)] = ~(CBK | CBQ) & 15;
    this.CM[s88(7, 7)] = ~CBK & 15;
  }

  reset(){
    this.brd.fill(0);
    const pcs = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
    for(let f = 0; f < 8; f++){
      this.brd[s88(0, f)] = mkP(WHITE, pcs[f]);
      this.brd[s88(1, f)] = mkP(WHITE, PAWN);
      this.brd[s88(6, f)] = mkP(BLACK, PAWN);
      this.brd[s88(7, f)] = mkP(BLACK, pcs[f]);
    }
    this.sd = WHITE;
    this.cas = 15;
    this.epSq = -1;
    this.hmc = 0;
    this.kSq[WHITE] = s88(0, 4);
    this.kSq[BLACK] = s88(7, 4);
    this.sStk = [];
    this.hKey = compH(this.brd, this.sd, this.cas, this.epSq);
    
    this.pieceCount = [16, 16];
    
    // === REBUILD PIECE LISTS ===
    this.rebuildPieceLists();
  }

  loadFEN(fenStr){
    this.brd.fill(0);
    const parts = fenStr.split(' ');
    const board = parts[0];
    this.sd = parts[1] === 'b' ? BLACK : WHITE;
    const opp = this.sd ^ 1;  
    this.cas = 0;
    const castStr = parts[2];
    if(castStr.includes('K')) this.cas |= CWK;
    if(castStr.includes('Q')) this.cas |= CWQ;
    if(castStr.includes('k')) this.cas |= CBK;
    if(castStr.includes('q')) this.cas |= CBQ;
    this.epSq = parts[3] === '-' ? -1 : ((parseInt(parts[3][1]) - 1) << 4) | (parts[3].charCodeAt(0) - 97);
    
    if(this.epSq !== -1){
      const epRank = rk(this.epSq);
      const epFile = fl(this.epSq);
      const pushDir = this.sd === WHITE ? -16 : 16;
      const pawnPos = this.epSq + pushDir;
      const capturePos = this.epSq - pushDir * 2;
      
      if(!onB(pawnPos) || !onB(capturePos) || this.brd[capturePos] !== 0 || this.brd[pawnPos] !== mkP(opp, PAWN)){
        this.epSq = -1; 
      }
    }
    this.hmc = parseInt(parts[4]) || 0;
    
    let r = 7, f = 0;
    this.pieceCount = [0, 0];
    
    for(const ch of board){
      if(ch === '/'){
        r--;
        f = 0;
      }
      else if(ch >= '0' && ch <= '9'){
        f += ch.charCodeAt(0) - 48;  
      }
      else{
        const p = FEN_PIECE_MAP[ch];
        this.brd[s88(r, f)] = p;
        
        
        if(ch === 'K') this.kSq[WHITE] = s88(r, f);
        else if(ch === 'k') this.kSq[BLACK] = s88(r, f);
        
        
        const isUpper = ch < 'a';
        const color = isUpper ? WHITE : BLACK;
        if(ch !== 'P' && ch !== 'p') this.pieceCount[color]++;
        
        f++;
      }
    }
    this.sStk = [];
    this.hKey = compH(this.brd, this.sd, this.cas, this.epSq);
    
    // === REBUILD PIECE LISTS ===
    this.rebuildPieceLists();
  }

doMove(m){
    const f = mF(m), t = mT(m), cap = mC(m), prom = mP(m), flag = mFL(m), pc = this.brd[f];
    
    this.sStk.push({cas: this.cas, ep: this.epSq, hmc: this.hmc, hKey: this.hKey, pc, pc0: this.pieceCount[0], pc1: this.pieceCount[1]});
    
    // 1. ALWAYS remove the moving piece from its source square first
    this.removePiece(f, pc);
    this.brd[f] = EMPTY;
    
    // 2. If it's a capture, ALWAYS remove the captured piece from its square first
    if (cap && flag !== FL_E) {
      this.removePiece(t, cap);
    }
    
    if(flag === FL_E){
      const es = this.sd === WHITE ? t - 16 : t + 16;
      const ep = this.brd[es];
      this.brd[es] = EMPTY;
      this.brd[t] = pc;
      
      this.removePiece(es, ep);
      this.addPiece(t, pc);
    }
    else if(flag === FL_C){
      this.brd[t] = pc;
      let rf, rt;
      if(t > f){ rf = t + 1; rt = t - 1; }
      else{ rf = t - 2; rt = t + 1; }
      const rook = this.brd[rf];
      this.brd[rt] = rook;
      this.brd[rf] = EMPTY;
      
      this.addPiece(t, pc);        
      this.removePiece(rf, rook);  
      this.addPiece(rt, rook);     
    }
    else if(prom){
      this.brd[t] = prom;
      // Do NOT remove 'pc' from 't'. It was already removed from 'f'.
      this.addPiece(t, prom);      // Just add the new promoted piece
      this.pieceCount[this.sd]++;
    }
    else{
      this.brd[t] = pc;
      this.addPiece(t, pc);
    }
    
    if(cap && pT(cap) !== PAWN){
      this.pieceCount[this.sd ^ 1]--;
    }
    
    if(pT(pc) === KING) this.kSq[this.sd] = t;
    
    this.cas &= this.CM[f] & this.CM[t];
    this.epSq = flag === FL_P ? (this.sd === WHITE ? f + 16 : f - 16) : -1;
    this.hmc = (pT(pc) === PAWN || cap) ? 0 : this.hmc + 1;
    
    this.sd ^= 1;
    this.hKey = compH(this.brd, this.sd, this.cas, this.epSq);
    
    return !this.isAttacked(this.kSq[this.sd ^ 1], this.sd);
  }

  undoMove(m){
    this.sd ^= 1;
    const f = mF(m), t = mT(m), cap = mC(m), prom = mP(m), flag = mFL(m);
    const st = this.sStk.pop();
    
    // 1. Clean up the destination square pieces from pieceList first
    if (prom) {
      this.removePiece(t, prom);
    } else {
      this.removePiece(t, st.pc);
    }
    
    this.brd[f] = st.pc;
    this.addPiece(f, st.pc); // Return moving piece to source
    
    if(flag === FL_E){
      this.brd[t] = EMPTY;
      const es = this.sd === WHITE ? t - 16 : t + 16;
      const epPc = mkP(this.sd ^ 1, PAWN);
      this.brd[es] = epPc;
      this.addPiece(es, epPc);
    }
    else if(flag === FL_C){
      this.brd[t] = EMPTY;
      let rf, rt;
      if(t > f){ rf = t + 1; rt = t - 1; }
      else{ rf = t - 2; rt = t + 1; }
      const rook = this.brd[rt];
      this.brd[rf] = rook;
      this.brd[rt] = EMPTY;
      
      this.removePiece(rt, rook);  
      this.addPiece(rf, rook);     
    }
    else {
      this.brd[t] = cap || EMPTY;
      if(cap) {
        this.addPiece(t, cap); // Return standard captured piece to board state lists
      }
    }
    
    if(pT(st.pc) === KING) this.kSq[this.sd] = f;
    
    this.cas = st.cas;
    this.epSq = st.ep;
    this.hmc = st.hmc;
    this.hKey = st.hKey;
    this.pieceCount[0] = st.pc0;
    this.pieceCount[1] = st.pc1;
  }

  doNull(){
    this.sStk.push({cas: this.cas, ep: this.epSq, hmc: this.hmc, hKey: this.hKey, pc: 0});
    this.epSq = -1;
    this.sd ^= 1;
    this.hKey = compH(this.brd, this.sd, this.cas, this.epSq);
  }

  undoNull(){
    this.sd ^= 1;
    const st = this.sStk.pop();
    this.cas = st.cas;
    this.epSq = st.ep;
    this.hmc = st.hmc;
    this.hKey = st.hKey;
  }

  isAttacked(sq, by){
    
    for(const d of N_D){
      const t = sq + d;
      if(onB(t) && this.brd[t] === mkP(by, KNIGHT)) return true;
    }
    
    
    for(const d of K_D){
      const t = sq + d;
      if(onB(t) && this.brd[t] === mkP(by, KING)) return true;
    }
    
    
    const pawnPc = mkP(by, PAWN);
    const pd = by === WHITE ? -16 : 16;
    if(onB(sq + pd - 1) && this.brd[sq + pd - 1] === pawnPc) return true;
    if(onB(sq + pd + 1) && this.brd[sq + pd + 1] === pawnPc) return true;
    
    
    for(const d of B_D){
      let t = sq + d;
      while(onB(t)){
        const p = this.brd[t];
        if(p){
          if(pC(p) === by && (pT(p) === BISHOP || pT(p) === QUEEN)) return true;
          break;
        }
        t += d;
      }
    }
    
    
    for(const d of R_D){
      let t = sq + d;
      while(onB(t)){
        const p = this.brd[t];
        if(p){
          if(pC(p) === by && (pT(p) === ROOK || pT(p) === QUEEN)) return true;
          break;
        }
        t += d;
      }
    }
    
    return false;
  }

  inCheck(){
    return this.isAttacked(this.kSq[this.sd], this.sd ^ 1);
  }
}
