










class HyperfishClient {
  constructor(baseUrl = 'http://127.0.0.1:3050') {
    this.baseUrl = baseUrl;
    this.connected = false;
    this.engineName = 'Hyperfish';
    this.port = 3050;
    this.lastError = null;
    this.stats = {
      evaluations: 0,
      searches: 0,
      failures: 0,
      avgResponseTime: 0
    };
  }

  
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        this.connected = true;
        this.engineName = data.engine || 'Hyperfish';
        this.port = data.port || 3050;
        return { status: 'ok', ...data };
      }
      
      this.connected = false;
      return { status: 'error', message: 'Health check failed' };
    } catch (e) {
      this.connected = false;
      this.lastError = e.message;
      return { status: 'error', message: e.message };
    }
  }

  
  async evaluate(fen, options = {}) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: fen,
          depth: options.depth || 20,
          time_ms: options.timeMs || 10000,
          multiPV: options.multiPV || 1,
          threads: options.threads || 1,
          hash: options.hash || 256
        }),
        signal: AbortSignal.timeout(options.timeout || 30000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      this.stats.evaluations++;
      this.stats.avgResponseTime = (
        (this.stats.avgResponseTime * (this.stats.evaluations - 1)) + 
        (Date.now() - startTime)
      ) / this.stats.evaluations;
      
      return {
        status: 'ok',
        result: {
          best_move: data.bestMove,
          score: data.score,
          score_type: data.scoreType || 'cp', 
          depth: data.depth,
          nodes: data.nodes || 0,
          nps: data.nps || 0,
          time_ms: data.timeMs,
          pv: data.pv || [],
          info: data.info || '',
          multipv: data.multipv || []
        }
      };
    } catch (e) {
      this.stats.failures++;
      this.lastError = e.message;
      return { status: 'error', message: e.message };
    }
  }

  
  async search(fen, options = {}) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: fen,
          depth: options.depth || 20,
          time_ms: options.timeMs || 10000,
          movetime: options.moveTime || 0,
          nodes: options.nodes || 0,
          infinite: options.infinite || false,
          mate: options.mate || 0,
          movestogo: options.movesToGo || 0
        }),
        signal: AbortSignal.timeout(options.timeout || 60000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      this.stats.searches++;
      this.stats.avgResponseTime = (
        (this.stats.avgResponseTime * (this.stats.searches - 1)) + 
        (Date.now() - startTime)
      ) / this.stats.searches;
      
      return {
        status: 'ok',
        result: {
          best_move: data.bestMove,
          score: data.score,
          score_type: data.scoreType || 'cp',
          depth: data.depth,
          seldepth: data.selDepth || data.depth,
          nodes: data.nodes || 0,
          nps: data.nps || 0,
          time_ms: data.timeMs,
          pv: data.pv || [],
          refutation: data.refutation || [],
          info: data.info || ''
        }
      };
    } catch (e) {
      this.stats.failures++;
      this.lastError = e.message;
      return { status: 'error', message: e.message };
    }
  }

  
  async getMultiPV(fen, numPV = 3, options = {}) {
    return this.evaluate(fen, { ...options, multiPV: numPV });
  }

  
  parsePosition(input) {
    
    if (input.includes('/') && input.includes(' ')) {
      return input;
    }
    
    
    if (input.match(/^[a-h][1-8][a-h][1-8]/)) {
      return this.sanToFen(input);
    }
    
    
    if (input === 'startpos' || input === 'start') {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    
    return null;
  }

  
  sanToFen(moves) {
    
    let board = new Board();
    board.reset();
    
    const moveParts = moves.split(' ');
    for (const san of moveParts) {
      if (!san) continue;
      
      
    }
    
    return board.toFEN();
  }

  
  getStats() {
    return {
      ...this.stats,
      connected: this.connected,
      engine: this.engineName,
      port: this.port,
      lastError: this.lastError
    };
  }

  
  resetStats() {
    this.stats = {
      evaluations: 0,
      searches: 0,
      failures: 0,
      avgResponseTime: 0
    };
  }
}






class HyperfishUCI {
  constructor(client) {
    this.client = client;
    this.position = null;
    this.goOptions = {};
    this.debugMode = false;
  }

  
  async position(fen, moves = []) {
    if (moves.length > 0) {
      
      
      this.position = fen; 
    } else {
      this.position = fen;
    }
    return { ok: true };
  }

  
  async go(options = {}) {
    if (!this.position) {
      return { status: 'error', message: 'No position set' };
    }
    
    const goOptions = {
      depth: options.depth || 20,
      timeMs: options.timeMs || options.time || 10000,
      nodes: options.nodes || 0,
      mate: options.mate || 0,
      infinite: options.infinite || false,
      ...options
    };
    
    return this.client.search(this.position, goOptions);
  }

  
  async eval(options = {}) {
    if (!this.position) {
      return { status: 'error', message: 'No position set' };
    }
    
    return this.client.evaluate(this.position, options);
  }

  
  async isReady() {
    return this.client.checkHealth();
  }

  
  async newGame() {
    this.position = null;
    this.goOptions = {};
    this.client.resetStats();
    return { ok: true };
  }

  
  async quit() {
    
    this.position = null;
    return { ok: true };
  }

  
  setDebug(enabled) {
    this.debugMode = enabled;
  }

  log(message) {
    if (this.debugMode) {
      console.log(`[HyperfishUCI] ${message}`);
    }
  }
}





var hyperfishClient = null;
var hyperfishUCI = null;


function initHyperfish(baseUrl = 'http://127.0.0.1:3050') {
  if (!hyperfishClient) {
    hyperfishClient = new HyperfishClient(baseUrl);
  }
  if (!hyperfishUCI) {
    hyperfishUCI = new HyperfishUCI(hyperfishClient);
  }
  return { client: hyperfishClient, uci: hyperfishUCI };
}


async function checkHyperfishStatus() {
  if (!hyperfishClient) {
    initHyperfish();
  }
  return hyperfishClient.checkHealth();
}


async function hyperfishEvaluate(fen, options = {}) {
  if (!hyperfishClient) {
    initHyperfish();
  }
  return hyperfishClient.evaluate(fen, options);
}


async function hyperfishSearch(fen, options = {}) {
  if (!hyperfishClient) {
    initHyperfish();
  }
  return hyperfishClient.search(fen, options);
}


function getHyperfishStats() {
  return hyperfishClient ? hyperfishClient.getStats() : null;
}


if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HyperfishClient,
    HyperfishUCI,
    initHyperfish,
    checkHyperfishStatus,
    hyperfishEvaluate,
    hyperfishSearch,
    getHyperfishStats
  };
}