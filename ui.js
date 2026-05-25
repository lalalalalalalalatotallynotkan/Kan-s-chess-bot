



class GameUI {
  constructor(){
    this.board = new Board();
    this.search = new Search();
    this.cv = document.getElementById('cv');
    this.SQ = 60;
    this.ctx = this.cv.getContext('2d');
    
    
    const resizeCanvas = () => {
      const maxSize = Math.min(window.innerWidth - 350, window.innerHeight - 20, 480);
      this.SQ = Math.max(40, Math.floor(maxSize / 8));
      this.cv.width = this.SQ * 8;
      this.cv.height = this.SQ * 8;
      this.drawBoard();
    };
    
    window.addEventListener('resize', resizeCanvas);
    setTimeout(() => resizeCanvas(), 20);
    
    
    this.domStatus = document.getElementById('status');
    this.domInfo = document.getElementById('info');
    this.domMoveList = document.getElementById('moveList');
    this.domTTime = document.getElementById('ttime');
    this.domColor = document.getElementById('color');
    this.domFEN = document.getElementById('fen');
    this.flipped = false;
    this.selSq = -1;
    this.legalDests = [];
    this.promData = null;
    this.gameOver = false;
    this.moveListArr = [];
    this.playerSide = WHITE;
    this.engineThinking = false;
    this.redrawScheduled = false;
    
    
    this.sprites = {};
    const pieceNames = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
    const colors = ['w', 'b'];
    for(let c of colors) {
      for(let p of pieceNames) {
        const img = new Image();
        img.src = `cpsprites/${c}${p}.png`;
        this.sprites[c + p] = img;
      }
    }
    
    this.board.reset();
    this.board.hHist = [];
    this.board.hHist.push(this.board.hKey);
    
    this.setup();
    this.drawBoard();
  }
  
  getPieceSprite(piece) {
    const pieces = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
    const color = pC(piece) === WHITE ? 'w' : 'b';
    const type = pieces[pT(piece)];
    return this.sprites[color + type];
  }

  setup(){
    this.cv.addEventListener('click', e => this.handleClick(e));
    this.cv.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      this.handleClick({clientX: t.clientX, clientY: t.clientY});
    }, {passive: false});
    
    this.domTTime.addEventListener('change', () => {});
    this.domColor.addEventListener('change', (e) => {
      this.playerSide = e.target.value === 'white' ? WHITE : BLACK;
      this.newGame();
    });
    this.domFEN.addEventListener('keypress', (e) => {
      if(e.key === 'Enter') this.loadFEN();
    });
  }
  
  loadFEN(){
    const fenStr = this.domFEN.value.trim();
    if(!fenStr) return;
    this.board.loadFEN(fenStr);
    this.board.hHist = [this.board.hKey];
    this.selSq = -1;
    this.legalDests = [];
    this.promData = null;
    this.gameOver = false;
    this.moveListArr = [];
    this.search = new Search();
    this.updateStatus('Position loaded from FEN');
    this.updateFENDisplay();
    this.drawBoard();
  }

  updateStatus(msg){
    this.domStatus.textContent = msg;
  }

  updateInfo(){
    this.domInfo.textContent = this.search.srchNfo;
  }

  updateMoveList(){
    let s = '';
    for(let i = 0; i < this.moveListArr.length; i += 2){
      const mn = Math.floor(i / 2) + 1;
      s += mn + '. ' + this.moveListArr[i].san;
      if(i + 1 < this.moveListArr.length) s += ' ' + this.moveListArr[i + 1].san;
      s += '\n';
    }
    this.domMoveList.textContent = s;
    this.domMoveList.scrollTop = this.domMoveList.scrollHeight;
  }

  sqToXY(sq){
    let r = rk(sq), f = fl(sq);
    if(this.flipped){ r = 7 - r; f = 7 - f; }
    return {x: f * this.SQ, y: (7 - r) * this.SQ};
  }

  xyToSq(x, y){
    let f = Math.floor(x / this.SQ), r = 7 - Math.floor(y / this.SQ);
    if(this.flipped){ f = 7 - f; r = 7 - r; }
    if(f < 0 || f > 7 || r < 0 || r > 7) return -1;
    return s88(r, f);
  }

  drawBoard(){
    const light = '#f0d9b5', dark = '#b58863', selC = 'rgba(255,255,100,0.5)', destC = 'rgba(100,200,100,0.5)', lastC = 'rgba(100,150,255,0.3)';
    
    for(let r = 0; r < 8; r++){
      for(let f = 0; f < 8; f++){
        const sq = this.flipped ? s88(7 - r, 7 - f) : s88(7 - r, f);
        const x = f * this.SQ, y = r * this.SQ;
        this.ctx.fillStyle = ((r + f) % 2 === 0) ? light : dark;
        this.ctx.fillRect(x, y, this.SQ, this.SQ);
        
        
        if(this.moveListArr.length > 0){
          const lm = this.moveListArr[this.moveListArr.length - 1].mv;
          if(sq === mF(lm) || sq === mT(lm)){
            this.ctx.fillStyle = lastC;
            this.ctx.fillRect(x, y, this.SQ, this.SQ);
          }
        }
        
        if(sq === this.selSq){
          this.ctx.fillStyle = selC;
          this.ctx.fillRect(x, y, this.SQ, this.SQ);
        }
        
        if(this.legalDests.includes(sq)){
          this.ctx.fillStyle = destC;
          this.ctx.fillRect(x, y, this.SQ, this.SQ);
        }
      }
    }
    
    
    this.ctx.font = 'bold 10px sans-serif';
    for(let f = 0; f < 8; f++){
      const ff = this.flipped ? 7 - f : f;
      this.ctx.fillStyle = f % 2 === 0 ? dark : light;
      this.ctx.fillText(String.fromCharCode(97 + ff), f * this.SQ + 2, this.SQ * 8 - 2);
    }
    for(let r = 0; r < 8; r++){
      const rr = this.flipped ? r : 7 - r;
      this.ctx.fillStyle = r % 2 === 0 ? light : dark;
      this.ctx.fillText(String(rr + 1), this.SQ * 8 - 10, r * this.SQ + 12);
    }
    
    
    for(let sq = 0; sq < 128; sq++){
      if(!onB(sq) || !this.board.brd[sq]) continue;
      const {x, y} = this.sqToXY(sq);
      const p = this.board.brd[sq];
      const sprite = this.getPieceSprite(p);
      if(sprite && sprite.complete) {
        const padding = 4;
        this.ctx.drawImage(sprite, x + padding, y + padding, this.SQ - 2 * padding, this.SQ - 2 * padding);
      }
    }
    
    
    if(this.promData){
      const {sq: psq, pieces} = this.promData;
      const {x: px} = this.sqToXY(psq);
      const py0 = this.flipped ? (pC(pieces[0]) === WHITE ? this.SQ * 4 : 0) : (pC(pieces[0]) === WHITE ? 0 : this.SQ * 4);
      
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(0, 0, this.SQ * 8, this.SQ * 8);
      
      for(let i = 0; i < 4; i++){
        const yy = py0 + i * this.SQ;
        this.ctx.fillStyle = '#e8e8e8';
        this.ctx.fillRect(px, yy, this.SQ, this.SQ);
        this.ctx.strokeStyle = '#333';
        this.ctx.strokeRect(px, yy, this.SQ, this.SQ);
        
        const sprite = this.getPieceSprite(pieces[i]);
        if(sprite && sprite.complete) {
          const padding = 4;
          this.ctx.drawImage(sprite, px + padding, yy + padding, this.SQ - 2 * padding, this.SQ - 2 * padding);
        }
      }
    }
    
    
    if(!this.gameOver && this.board.isAttacked(this.board.kSq[this.board.sd], this.board.sd ^ 1)){
      const {x, y} = this.sqToXY(this.board.kSq[this.board.sd]);
      this.ctx.strokeStyle = 'red';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x + 2, y + 2, this.SQ - 4, this.SQ - 4);
      this.ctx.lineWidth = 1;
    }
  }

  tryMove(from, to, promPc){
    const legal = MoveGen.genLegal(this.board);
    for(const m of legal){
      if(mF(m) === from && mT(m) === to){
        if(mP(m)){
          if(promPc && pT(mP(m)) === pT(promPc)) return m;
          continue;
        }
        return m;
      }
    }
    return 0;
  }

  moveToSAN(m){
    const f = mF(m), t = mT(m), flag = mFL(m), pc = this.board.brd[f];
    const ty = pT(pc);
    const cap = mC(m);
    const prom = mP(m);
    
    let s = '';
    if(flag === FL_C) {
      s = t > f ? 'O-O' : 'O-O-O';
    } else {
      if(ty !== PAWN) {
        s += PCNAMES[ty] || '';
        
        
        const samePieceMoves = [];
        const legalMoves = MoveGen.genLegal(this.board);
        for(const altM of legalMoves){
          if(mF(altM) !== f && pT(this.board.brd[mF(altM)]) === ty && mT(altM) === t){
            samePieceMoves.push(altM);
          }
        }
        
        if(samePieceMoves.length > 0){
          
          let needFile = false, needRank = false;
          for(const altM of samePieceMoves){
            if(fl(mF(altM)) !== fl(f)) needFile = true;
            else needRank = true;
          }
          if(needFile){
            s += String.fromCharCode(97 + fl(f));
          } else if(needRank){
            s += (rk(f) + 1);
          }
        }
      } else if(cap){
        s += String.fromCharCode(97 + fl(f));
      }
      
      if(cap) s += 'x';
      s += String.fromCharCode(97 + fl(t)) + (rk(t) + 1);
      if(prom) s += '=' + PCNAMES[pT(prom)];
    }
    return s;
  }

  updateFENDisplay(){
    
    const b = this.board.brd;
    let fen = '';
    for(let r = 0; r < 8; r++){
      let empty = 0;
      for(let f = 0; f < 8; f++){
        const sq = s88(r, f);
        const p = b[sq];
        if(!p) empty++;
        else{
          if(empty) fen += empty;
          empty = 0;
          const ch = PCHARSl[p];
          fen += p < 8 ? ch.toUpperCase() : ch.toLowerCase();
        }
      }
      if(empty) fen += empty;
      if(r < 7) fen += '/';
    }
    fen += this.board.sd === WHITE ? ' w' : ' b';
    
    
    let castling = '';
    if(this.board.cas & CWK) castling += 'K';
    if(this.board.cas & CWQ) castling += 'Q';
    if(this.board.cas & CBK) castling += 'k';
    if(this.board.cas & CBQ) castling += 'q';
    fen += ' ' + (castling || '-');
    
    
    fen += this.board.epSq !== -1 ? ' ' + String.fromCharCode(97 + fl(this.board.epSq)) + (rk(this.board.epSq) + 1) : ' -';
    
    
    fen += ' ' + this.board.hmc + ' ' + this.moveListArr.length / 2 + 1;
    
    this.domFEN.value = fen;
  }

  makeGameMove(m){
    const san = this.moveToSAN(m);
    console.log(`📍 Attempting move: ${san}`);
    
    if(!this.board.doMove(m)){
      console.error('❌ Illegal move attempted:', m);
      return false;
    }
    this.board.hHist.push(this.board.hKey);
    
    const legal = MoveGen.genLegal(this.board);
    let suffix = '';
    if(legal.length === 0){
      suffix = this.board.isAttacked(this.board.kSq[this.board.sd], this.board.sd ^ 1) ? '#' : '';
    }else if(this.board.isAttacked(this.board.kSq[this.board.sd], this.board.sd ^ 1)){
      suffix = '+';
    }
    
    this.moveListArr.push({mv: m, san: san + suffix});
    this.updateMoveList();
    this.updateFENDisplay();
    
    if(suffix === '#') console.log(`🏁 CHECKMATE! ${suffix}`);
    else if(suffix === '+') console.log(`⚡ CHECK! ${suffix}`);
    
    return true;
  }

  checkGameOver(){
    const legal = MoveGen.genLegal(this.board);
    if(legal.length === 0){
      this.gameOver = true;
      if(this.board.isAttacked(this.board.kSq[this.board.sd], this.board.sd ^ 1))
        this.updateStatus(this.board.sd === WHITE ? 'Black wins by checkmate!' : 'White wins by checkmate!');
      else
        this.updateStatus('Draw by stalemate!');
      return true;
    }
    
    if(this.board.hmc >= 100){
      this.gameOver = true;
      this.updateStatus('Draw by 50-move rule!');
      return true;
    }
    
    
    let rc = 0;
    for(let i = this.board.hHist.length - 2; i >= Math.max(0, this.board.hHist.length - this.board.hmc); i -= 2)
      if(this.board.hHist[i] === this.board.hKey) rc++;
    
    if(rc >= 2){
      this.gameOver = true;
      this.updateStatus('Draw by repetition!');
      return true;
    }
    
    return false;
  }

  handleClick(e){
    if(this.gameOver || this.engineThinking) return;
    if(this.board.sd !== this.playerSide) return;
    
    const rect = this.cv.getBoundingClientRect();
    const scale = this.cv.width / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    const my = (e.clientY - rect.top) * scale;
    
    if(this.promData){
      const {sq: psq, pieces, from: pf, to: pt} = this.promData;
      const {x: px} = this.sqToXY(psq);
      const py0 = this.flipped ? (pC(pieces[0]) === WHITE ? this.SQ * 4 : 0) : (pC(pieces[0]) === WHITE ? 0 : this.SQ * 4);
      
      for(let i = 0; i < 4; i++){
        const yy = py0 + i * this.SQ;
        if(mx >= px && mx < px + this.SQ && my >= yy && my < yy + this.SQ){
          const m = this.tryMove(pf, pt, pieces[i]);
          if(m){
            this.makeGameMove(m);
            this.selSq = -1;
            this.legalDests = [];
            this.promData = null;
            this.drawBoard();
            if(!this.checkGameOver()) this.triggerEngine();
          }
          this.promData = null;
          this.drawBoard();
          return;
        }
      }
      this.promData = null;
      this.selSq = -1;
      this.legalDests = [];
      this.drawBoard();
      return;
    }
    
    const sq = this.xyToSq(mx, my);
    if(sq === -1) return;
    
    if(this.selSq !== -1){
      if(this.legalDests.includes(sq)){
        const legal = MoveGen.genLegal(this.board);
        let isPromo = false;
        for(const m of legal){
          if(mF(m) === this.selSq && mT(m) === sq && mP(m)){
            isPromo = true;
            break;
          }
        }
        
        if(isPromo){
          this.promData = {sq, pieces: [mkP(this.board.sd, QUEEN), mkP(this.board.sd, ROOK), mkP(this.board.sd, BISHOP), mkP(this.board.sd, KNIGHT)], from: this.selSq, to: sq};
          this.drawBoard();
          return;
        }
        
        const m = this.tryMove(this.selSq, sq, null);
        if(m){
          this.makeGameMove(m);
          this.selSq = -1;
          this.legalDests = [];
          this.drawBoard();
          if(!this.checkGameOver()) this.triggerEngine();
          return;
        }
      }
      this.selSq = -1;
      this.legalDests = [];
    }
    
    if(this.board.brd[sq] && pC(this.board.brd[sq]) === this.board.sd){
      this.selSq = sq;
      const legal = MoveGen.genLegal(this.board);
      this.legalDests = legal.filter(m => mF(m) === sq).map(m => mT(m));
      this.legalDests = [...new Set(this.legalDests)];
    }else{
      this.selSq = -1;
      this.legalDests = [];
    }
    
    this.drawBoard();
  }

  triggerEngine(){
    if(this.gameOver) return;
    
    this.engineThinking = true;
    this.updateStatus('🤖 Engine thinking...');
    this.updateInfo();
    this.drawBoard();
    
    const tm = parseInt(document.getElementById('ttime').value) || 3000;
    console.log(`🤖 Engine starting search (${tm}ms)...`);
    
    setTimeout(() => {
      const m = this.search.engineSearch(this.board, tm);
      if(m){
        const san = this.moveToSAN(m);
        const moveNum = Math.floor(this.moveListArr.length / 2) + 1;
        const fullMove = this.board.sd === WHITE ? `${moveNum}. ${san}` : `${moveNum}... ${san}`;
        
        console.log(`\n🎯 Engine Move: ${fullMove}`);
        console.log('📊 Search Info:', this.search.srchNfo.replace(/\n/g, ' | '));
        
        this.makeGameMove(m);
        
        
        const statsLines = this.search.srchNfo.split('\n');
        const displayStats = statsLines.join(' • ');
        this.updateStatus(`✓ ${san} | ${displayStats}`);
        this.updateInfo();
        
        console.log(`\n✓ Move executed: ${san}`);
      }else{
        console.warn('⚠️ Engine failed to find a move!');
        this.updateStatus('❌ Engine failed to find move');
      }
      this.engineThinking = false;
      
      if(!this.checkGameOver()){
        if(this.board.sd === this.playerSide){
          this.updateStatus('Your turn');
        }else{
          setTimeout(() => this.triggerEngine(), 10);
        }
      }
      
      this.drawBoard();
    }, 50);
  }

  newGame(){
    this.board = new Board();
    this.board.reset();
    this.board.hHist = [this.board.hKey];
    this.search = new Search();
    this.selSq = -1;
    this.legalDests = [];
    this.promData = null;
    this.gameOver = false;
    this.engineThinking = false;
    this.moveListArr = [];
    this.flipped = false;
    this.search.srchNfo = 'Ready to play.';
    const sideStr = this.playerSide === WHITE ? 'White' : 'Black';
    this.updateStatus(this.board.sd === this.playerSide ? `Your turn (${sideStr})` : 'Engine thinking...');
    this.updateMoveList();
    this.updateInfo();
    this.updateFENDisplay();
    this.drawBoard();
    if(this.board.sd !== this.playerSide) this.triggerEngine();
  }

  undoTwo(){
    if(this.engineThinking || this.moveListArr.length < 2) return;
    
    for(let i = 0; i < 2 && this.moveListArr.length > 0; i++){
      const entry = this.moveListArr.pop();
      this.board.hHist.pop();
      this.board.undoMove(entry.mv);
    }
    
    this.selSq = -1;
    this.legalDests = [];
    this.gameOver = false;
    this.updateStatus('Your turn');
    this.updateMoveList();
    this.updateFENDisplay();
    this.drawBoard();
  }

  flipBoard(){
    this.flipped = !this.flipped;
    this.drawBoard();
  }
}


let gameUI;

// === RUN INITIALIZATION ON ENGINE BOOTSTRAP ===
initEndgameTab(); // Initialize tablebases once here!

window.newGame = () => gameUI.newGame();
window.undoTwo = () => gameUI.undoTwo();
window.flipBrd = () => gameUI.flipBoard();
window.copyFEN = () => {
  const fen = document.getElementById('fen').value;
  if(!fen) return;
  navigator.clipboard.writeText(fen).then(() => {
    console.log('✓ FEN copied to clipboard');
  }).catch(() => {
    const fenInput = document.getElementById('fen');
    fenInput.select();
    document.execCommand('copy');
    console.log('✓ FEN copied (fallback)');
  });
};


initZobrist();
gameUI = new GameUI();
