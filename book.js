class OpeningBook {
  constructor(filePath = null) {
    this.entries = new Map(); 
    this.defaultPath = filePath;
    this.stats = {
      totalPositions: 0,
      totalEntries: 0,
      hits: 0,
      misses: 0,
      bestMoves: new Map(), 
      moveDistribution: new Map() 
    };
    this.learningEnabled = false;
    this.bookDepth = 0; 
    if (filePath) {
      this.load(filePath);
    }
  }

  
  load(filePath) {
    try {
      const fs = require('fs');
      if (!fs.existsSync(filePath)) {
        console.log(`Opening book not found: ${filePath}`);
        return false;
      }

      const buffer = fs.readFileSync(filePath);
      const numEntries = Math.floor(buffer.length / 16);

      for (let i = 0; i < numEntries; i++) {
        const offset = i * 16;
        
        
        let key = 0n;
        for (let j = 0; j < 8; j++) {
          key = key | BigInt(buffer[offset + j]) << BigInt(j * 8);
        }
        
        
        const move = buffer[offset + 8] | (buffer[offset + 9] << 8);
        
        
        const weight = buffer[offset + 10] | (buffer[offset + 11] << 8);
        
        
        const learn = buffer[offset + 12] | (buffer[offset + 13] << 8) | 
                     (buffer[offset + 14] << 16) | (buffer[offset + 15] << 24);

        const keyNum = Number(key);
        
        if (!this.entries.has(keyNum)) {
          this.entries.set(keyNum, []);
        }
        
        this.entries.get(keyNum).push({
          move: move,
          weight: weight || 1,
          learn: learn
        });
      }

      this.stats.totalPositions = this.entries.size;
      this.stats.totalEntries = numEntries;
      this.bookDepth = this._calculateBookDepth();
      
      console.log(`Loaded opening book: ${this.entries.size} positions, ${numEntries} entries`);
      return true;
    } catch (e) {
      console.error('Error loading opening book:', e);
      return false;
    }
  }

  
  _calculateBookDepth() {
    let maxDepth = 0;
    
    const sampleSize = Math.min(100, this.entries.size);
    let count = 0;
    for (const [key, entries] of this.entries) {
      if (count++ >= sampleSize) break;
      
      maxDepth = Math.max(maxDepth, Math.log2(entries.length) + 1);
    }
    return Math.floor(maxDepth);
  }

  
  getRandomMove(board) {
    const key = board.hKey;
    const entries = this.entries.get(key);
    
    if (!entries || entries.length === 0) {
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    let totalWeight = 0;
    for (const entry of entries) {
      totalWeight += entry.weight;
    }

    
    let random = Math.random() * totalWeight;
    for (const entry of entries) {
      random -= entry.weight;
      if (random <= 0) {
        this._updateMoveDistribution(key, entry.move);
        return this.unpackMove(entry.move, board);
      }
    }

    
    const move = this.unpackMove(entries[0].move, board);
    this._updateMoveDistribution(key, entries[0].move);
    return move;
  }

  
  _updateMoveDistribution(key, move) {
    if (!this.learningEnabled) return;
    const dist = this.stats.moveDistribution.get(key) || { total: 0, moves: {} };
    dist.total++;
    dist.moves[move] = (dist.moves[move] || 0) + 1;
    this.stats.moveDistribution.set(key, dist);
  }

  
  getBestMove(board) {
    const key = board.hKey;
    const entries = this.entries.get(key);
    
    if (!entries || entries.length === 0) {
      return null;
    }

    
    let bestEntry = entries[0];
    let maxLearn = bestEntry.learn;
    
    for (const entry of entries) {
      if (entry.learn > maxLearn) {
        maxLearn = entry.learn;
        bestEntry = entry;
      }
    }

    
    this.stats.bestMoves.set(key, bestEntry.move);
    
    return this.unpackMove(bestEntry.move, board);
  }

  
  getMoves(board) {
    const key = board.hKey;
    const entries = this.entries.get(key);
    
    if (!entries) {
      return [];
    }

    const moves = [];
    for (const entry of entries) {
      const move = this.unpackMove(entry.move, board);
      if (move) {
        moves.push({
          move: move,
          weight: entry.weight,
          learn: entry.learn,
          
          winRate: this._estimateWinRate(entry.learn)
        });
      }
    }

    return moves;
  }

  
  _estimateWinRate(learn) {
    if (learn === 0) return 0.5;
    
    
    const normalized = 1 / (1 + Math.exp(-learn / 100000));
    return Math.max(0.01, Math.min(0.99, normalized));
  }

  
  unpackMove(packed, board) {
    const from = packed & 0x3F;
    const to = (packed >> 6) & 0x3F;
    const prom = (packed >> 12) & 0xF;
    
    
    const from88 = ((from >> 3) << 4) | (from & 7);
    const to88 = ((to >> 3) << 4) | (to & 7);
    
    let promPiece = 0;
    if (prom > 0) {
      
      const pieces = [0, KNIGHT, BISHOP, ROOK, QUEEN];
      promPiece = mkP(board.sd, pieces[prom]);
    }

    return mkM(from88, to88, board.brd[to88], promPiece, FL_N);
  }

  
  hasMoves(board) {
    return this.entries.has(board.hKey);
  }

  
  getStats() {
    return {
      positions: this.stats.totalPositions,
      entries: this.stats.totalEntries,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1) + '%'
        : 'N/A',
      depth: this.bookDepth,
      learningEnabled: this.learningEnabled
    };
  }

  
  setLearning(enabled) {
    this.learningEnabled = enabled;
  }

  
  getSuggestions(board, maxSuggestions = 5) {
    const moves = this.getMoves(board);
    if (moves.length === 0) return [];

    
    moves.sort((a, b) => {
      const scoreA = a.weight * (1 + a.learn / 1000000);
      const scoreB = b.weight * (1 + b.learn / 1000000);
      return scoreB - scoreA;
    });

    return moves.slice(0, maxSuggestions).map((m, idx) => ({
      rank: idx + 1,
      move: m.move,
      weight: m.weight,
      winRate: (m.winRate * 100).toFixed(1) + '%',
      learn: m.learn
    }));
  }

  
  close() {
    this.entries.clear();
    this.stats.bestMoves.clear();
    this.stats.moveDistribution.clear();
  }

  
  exportLearningData() {
    const data = [];
    for (const [key, entries] of this.entries) {
      for (const entry of entries) {
        data.push({
          key: key,
          move: entry.move,
          weight: entry.weight,
          learn: entry.learn
        });
      }
    }
    return data;
  }

  
  importLearningData(learningData) {
    for (const entry of learningData) {
      const existing = this.entries.get(entry.key);
      if (existing) {
        
        for (const e of existing) {
          if (e.move === entry.move) {
            e.learn = Math.max(e.learn, entry.learn);
            e.weight = Math.max(e.weight, entry.weight);
          }
        }
      }
    }
  }
}




class BookManager {
  constructor() {
    this.books = new Map();
    this.activeBook = null;
    this.bookStyles = {
      'solid': { name: 'Solid', weightBias: 1.0, learnBias: 0.5 },
      'aggressive': { name: 'Aggressive', weightBias: 0.8, learnBias: 1.0 },
      'passive': { name: 'Passive', weightBias: 1.2, learnBias: 0.3 },
      'random': { name: 'Random', weightBias: 0.5, learnBias: 0.0 }
    };
    this.currentStyle = 'solid';
  }

  
  addBook(name, filePath) {
    const book = new OpeningBook(filePath);
    this.books.set(name, book);
    if (!this.activeBook) {
      this.activeBook = name;
    }
    return book;
  }

  
  setActiveBook(name) {
    if (this.books.has(name)) {
      this.activeBook = name;
      return true;
    }
    return false;
  }

  
  setStyle(style) {
    if (this.bookStyles[style]) {
      this.currentStyle = style;
      return true;
    }
    return false;
  }

  
  getMove(board) {
    const book = this.books.get(this.activeBook);
    if (!book) return null;

    const style = this.bookStyles[this.currentStyle];
    const entries = book.entries.get(board.hKey);
    
    if (!entries || entries.length === 0) {
      return null;
    }

    
    if (this.currentStyle === 'random') {
      return book.getRandomMove(board);
    }

    
    let totalWeight = 0;
    const adjustedEntries = entries.map(e => {
      const adjustedWeight = e.weight * style.weightBias * (1 + e.learn / 1000000 * style.learnBias);
      totalWeight += adjustedWeight;
      return { entry: e, adjustedWeight };
    });

    
    let random = Math.random() * totalWeight;
    for (const ae of adjustedEntries) {
      random -= ae.adjustedWeight;
      if (random <= 0) {
        return book.unpackMove(ae.entry.move, board);
      }
    }

    return book.unpackMove(entries[0].move, board);
  }

  
  getBookInfo(name) {
    const book = this.books.get(name);
    if (!book) return null;
    return {
      name,
      stats: book.getStats(),
      style: this.bookStyles[this.currentStyle]
    };
  }

  
  listBooks() {
    return Array.from(this.books.keys());
  }
}


var book = null;
var bookManager = null;


function initBook(path = null) {
  if (book === null) {
    book = new OpeningBook(path);
  }
  return book;
}


function initBookManager() {
  if (bookManager === null) {
    bookManager = new BookManager();
  }
  return bookManager;
}


function getBookMove(board, mode = 'random') {
  if (!book) return null;
  
  switch (mode) {
    case 'random':
      return book.getRandomMove(board);
    case 'best':
      return book.getBestMove(board);
    case 'all':
      return book.getMoves(board);
    case 'suggestions':
      return book.getSuggestions(board);
    default:
      return book.getRandomMove(board);
  }
}


function bookHasMoves(board) {
  return book ? book.hasMoves(board) : false;
}


function getBookStats() {
  return book ? book.getStats() : null;
}