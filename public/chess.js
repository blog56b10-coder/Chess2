const PIECES = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟',
  wJ:'🃏',bJ:'🃏',  // Joker
  wZ:'🧙',bZ:'🧙',  // Wizard
};

function initBoard() {
  return [
    ['bR','bN','bB','bQ','bK','bB','bN','bR'],
    ['bP','bP','bP','bP','bP','bP','bP','bP'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['wP','wP','wP','wP','wP','wP','wP','wP'],
    ['wR','wN','wB','wQ','wK','wB','wN','wR'],
  ];
}

function pc(p)    { return p ? p[0] : null; }
function pt(p)    { return p ? p[1] : null; }
function opp(c)   { return c === 'w' ? 'b' : 'w'; }
function inB(r,c) { return r>=0&&r<8&&c>=0&&c<8; }

// ── Raw moves (no check filtering) ──
function rawMoves(b, r, c, ep) {
  const p = b[r][c]; if (!p) return [];
  const col = pc(p), typ = pt(p);
  const moves = [];
  const add = (nr,nc) => { if(inB(nr,nc)) moves.push([nr,nc]); };
  const slide = (dr,dc) => {
    let nr=r+dr,nc=c+dc;
    while(inB(nr,nc)){
      if(b[nr][nc]){ if(pc(b[nr][nc])!==col) moves.push([nr,nc]); break; }
      moves.push([nr,nc]); nr+=dr; nc+=dc;
    }
  };

  if(typ==='P'){
    const d=col==='w'?-1:1, s=col==='w'?6:1;
    if(inB(r+d,c)&&!b[r+d][c]){
      moves.push([r+d,c]);
      if(r===s&&!b[r+2*d][c]) moves.push([r+2*d,c]);
    }
    for(const dc of[-1,1]){
      if(inB(r+d,c+dc)){
        if(b[r+d][c+dc]&&pc(b[r+d][c+dc])!==col) moves.push([r+d,c+dc]);
        if(ep&&ep[0]===r+d&&ep[1]===c+dc) moves.push([r+d,c+dc]);
      }
    }
  }

  if(typ==='N') for(const[dr,dc] of[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) add(r+dr,c+dc);
  if(typ==='B'||typ==='Q'){ slide(1,1);slide(1,-1);slide(-1,1);slide(-1,-1); }
  if(typ==='R'||typ==='Q'){ slide(1,0);slide(-1,0);slide(0,1);slide(0,-1); }
  if(typ==='K') for(const[dr,dc] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) add(r+dr,c+dc);

  // ── Joker ──
  // Moves one square straight (no diagonal) by default.
  // Copies moves of all adjacent friendly pieces (ignoring other Jokers).
  if(typ==='J'){
    const baseMoves = [];
    // Base: one square orthogonal
    for(const[dr,dc] of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nr=r+dr,nc=c+dc;
      if(inB(nr,nc) && pc(b[nr][nc])!==col) baseMoves.push([nr,nc]);
    }
    // Copy moves from adjacent friendly non-Joker pieces
    const copied = new Set();
    for(const[dr,dc] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const ar=r+dr,ac=c+dc;
      if(!inB(ar,ac)) continue;
      const adj=b[ar][ac];
      if(adj && pc(adj)===col && pt(adj)!=='J' && pt(adj)!=='K'){
        // Get raw moves of that adjacent piece from the joker's position
        rawMovesForType(b, r, c, col, pt(adj), ep).forEach(([mr,mc])=>{
          copied.add(mr+','+mc);
        });
      }
    }
    copied.forEach(key=>{
      const [mr,mc]=key.split(',').map(Number);
      baseMoves.push([mr,mc]);
    });
    // Deduplicate and filter own pieces
    const seen = new Set();
    baseMoves.forEach(([mr,mc])=>{
      const k=mr+','+mc;
      if(!seen.has(k) && pc(b[mr][mc])!==col){ seen.add(k); moves.push([mr,mc]); }
    });
    return moves;
  }

  // ── Wizard ──
  // Moves like a pawn (one square forward, no double move, no promotion).
  // Captures diagonally forward WITHOUT moving to that square.
  // Capturing moves are included so the engine knows which squares it threatens,
  // but we flag them specially — see legalMoves for handling.
  if(typ==='Z'){
    const d = col==='w' ? -1 : 1;
    // Forward move (no capture)
    if(inB(r+d,c) && !b[r+d][c]) moves.push([r+d,c]);
    // Diagonal captures (piece disappears, wizard stays) — encoded as special
    for(const dc of[-1,1]){
      if(inB(r+d,c+dc) && b[r+d][c+dc] && pc(b[r+d][c+dc])!==col){
        moves.push([r+d,c+dc]); // will be treated as remote capture below
      }
    }
  }

  return moves.filter(([nr,nc])=>pc(b[nr][nc])!==col);
}

// Helper: get raw moves for a given piece TYPE as if placed at (r,c)
// Used by the Joker to copy move patterns from adjacent pieces
function rawMovesForType(b, r, c, col, typ, ep) {
  const moves = [];
  const add = (nr,nc) => { if(inB(nr,nc)) moves.push([nr,nc]); };
  const slide = (dr,dc) => {
    let nr=r+dr,nc=c+dc;
    while(inB(nr,nc)){
      if(b[nr][nc]){ if(pc(b[nr][nc])!==col) moves.push([nr,nc]); break; }
      moves.push([nr,nc]); nr+=dr; nc+=dc;
    }
  };
  if(typ==='P'){
    const d=col==='w'?-1:1, s=col==='w'?6:1;
    if(inB(r+d,c)&&!b[r+d][c]){
      moves.push([r+d,c]);
      if(r===s&&!b[r+2*d][c]) moves.push([r+2*d,c]);
    }
    for(const dc of[-1,1])
      if(inB(r+d,c+dc)&&b[r+d][c+dc]&&pc(b[r+d][c+dc])!==col) moves.push([r+d,c+dc]);
  }
  if(typ==='N') for(const[dr,dc] of[[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]) add(r+dr,c+dc);
  if(typ==='B'||typ==='Q'){ slide(1,1);slide(1,-1);slide(-1,1);slide(-1,-1); }
  if(typ==='R'||typ==='Q'){ slide(1,0);slide(-1,0);slide(0,1);slide(0,-1); }
  if(typ==='K') for(const[dr,dc] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) add(r+dr,c+dc);
  return moves.filter(([nr,nc])=>pc(b[nr][nc])!==col);
}

function isAttacked(b,r,c,by){
  for(let rr=0;rr<8;rr++) for(let cc=0;cc<8;cc++)
    if(pc(b[rr][cc])===by && rawMoves(b,rr,cc,null).some(([mr,mc])=>mr===r&&mc===c)) return true;
  return false;
}

function findKing(b,col){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(b[r][c]===col+'K') return [r,c];
}

function applyMove(b,r,c,nr,nc,ep){
  const nb=b.map(row=>[...row]);
  const p = nb[r][c];
  // Wizard remote capture: wizard stays, only target disappears
  if(pt(p)==='Z' && (nr!==r || Math.abs(nc-c)>0)){
    const d = pc(p)==='w' ? -1 : 1;
    // Check if this is a diagonal capture (wizard doesn't move)
    if(nr===r+d && nc!==c && nb[nr][nc] && pc(nb[nr][nc])!==pc(p)){
      nb[nr][nc] = null; // remove captured piece
      // wizard stays at r,c — don't move it
      return nb;
    }
  }
  nb[nr][nc]=nb[r][c]; nb[r][c]=null;
  if(pt(nb[nr][nc])==='P'&&ep&&nr===ep[0]&&nc===ep[1]) nb[r][nc]=null;
  return nb;
}

function legalMoves(b,r,c,ep,cr){
  const p=b[r][c]; if(!p) return [];
  const col=pc(p),typ=pt(p);
  let moves=rawMoves(b,r,c,ep);

  if(typ==='K'){
    const row=col==='w'?7:0;
    const oc=opp(col);
    if(r===row&&c===4){
      if(cr[col+'K']&&cr[col+'KR']&&!b[row][5]&&!b[row][6]&&
        !isAttacked(b,row,4,oc)&&!isAttacked(b,row,5,oc)&&!isAttacked(b,row,6,oc))
        moves.push([row,6]);
      if(cr[col+'K']&&cr[col+'QR']&&!b[row][3]&&!b[row][2]&&!b[row][1]&&
        !isAttacked(b,row,4,oc)&&!isAttacked(b,row,3,oc)&&!isAttacked(b,row,2,oc))
        moves.push([row,2]);
    }
  }

  return moves.filter(([nr,nc])=>{
    const nb=applyMove(b,r,c,nr,nc,ep);
    if(typ==='K'&&Math.abs(nc-c)===2){
      if(nc===6){nb[r][5]=nb[r][7];nb[r][7]=null;}
      if(nc===2){nb[r][3]=nb[r][0];nb[r][0]=null;}
    }
    const[kr,kc]=findKing(nb,col);
    return !isAttacked(nb,kr,kc,opp(col));
  });
}

function allLegal(b,col,ep,cr){
  const moves=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++)
    if(pc(b[r][c])===col) legalMoves(b,r,c,ep,cr).forEach(m=>moves.push({from:[r,c],to:m}));
  return moves;
}

// ── Piece Definitions ──
const PIECE_CATALOG = [
  { type: 'P', name: 'Pawn',   cost: 1, icon: '♙' },
  { type: 'N', name: 'Knight', cost: 3, icon: '♘' },
  { type: 'B', name: 'Bishop', cost: 3, icon: '♗' },
  { type: 'R', name: 'Rook',   cost: 5, icon: '♖' },
  { type: 'Q', name: 'Queen',  cost: 9, icon: '♕' },
  { type: 'J', name: 'Joker',  cost: 4, icon: '🃏' },
  { type: 'Z', name: 'Wizard', cost: 2, icon: '🧙' },
  // Add new special pieces here:
  // { type: 'X', name: 'Teleporter', cost: 6, icon: '✦', ability: 'teleport' },
];

const PIECE_COSTS = { P:1, N:3, B:3, R:5, Q:9, K:0, J:5, Z:2 };
const MAX_POINTS = 39;

// ── Builder ──
let builderBoard = null;
let draggedPiece = null;
let draggedFrom  = null;
let customBoard  = null;

function initBuilderBoard() {
  return [
    ['wP','wP','wP','wP','wP','wP','wP','wP'],
    ['wR','wN','wB','wQ','wK','wB','wN','wR'],
  ];
}

function calcPoints(bboard) {
  let total = 0;
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 8; c++)
      if (bboard[r][c]) total += PIECE_COSTS[pt(bboard[r][c])] || 0;
  return total;
}

function openBuilder() {
  if (customBoard) {
    builderBoard = [
      [...customBoard[6]],
      [...customBoard[7]],
    ];
  } else {
    builderBoard = initBuilderBoard();
  }
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('builder').style.display = 'flex';
  renderBuilder();
  renderCards();
}

function closeBuilder(save) {
  if (save) {
    const full = initBoard();
    for (let c = 0; c < 8; c++) {
      full[6][c] = builderBoard[0][c];
      full[7][c] = builderBoard[1][c];
    }
    customBoard = full;
  }
  document.getElementById('builder').style.display = 'none';
  document.getElementById('lobby').style.display = 'flex';
}

function renderBuilder() {
  const grid = document.getElementById('builder-board');
  grid.innerHTML = '';
  const remaining = MAX_POINTS - calcPoints(builderBoard);
  document.getElementById('points-used').textContent = remaining;

  for (let displayR = 0; displayR < 2; displayR++) {
    const builderR = displayR;
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'sq ' + (((6 + builderR) + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.r = builderR;
      sq.dataset.c = c;

      const piece = builderBoard[builderR][c];
      if (piece) {
        const span = document.createElement('span');
        span.textContent = PIECES[piece];
        span.style.color = '#ffffff';
        span.style.webkitTextStroke = '0px';
        span.style.textShadow = '-1px -1px 0 #555, 1px -1px 0 #555, -1px 1px 0 #555, 1px 1px 0 #555';
        sq.appendChild(span);

        sq.draggable = true;
        sq.addEventListener('dragstart', () => { draggedFrom = { r: builderR, c }; draggedPiece = null; });
        sq.addEventListener('dragend',   () => { draggedFrom = null; draggedPiece = null; });
      }

      sq.addEventListener('dragover',  (e) => { e.preventDefault(); sq.classList.add('drag-over'); });
      sq.addEventListener('dragleave', ()  => sq.classList.remove('drag-over'));
      sq.addEventListener('drop', (e) => {
        e.preventDefault();
        sq.classList.remove('drag-over');
        const nr = +sq.dataset.r;
        const nc = +sq.dataset.c;
        const targetPiece = builderBoard[nr][nc];

        if (draggedPiece) {
          if (targetPiece && pt(targetPiece) === 'K') return;
          const newCost = PIECE_COSTS[draggedPiece] || 0;
          const oldCost = targetPiece ? (PIECE_COSTS[pt(targetPiece)] || 0) : 0;
          if (calcPoints(builderBoard) - oldCost + newCost > MAX_POINTS) { alert('Not enough points!'); return; }
          builderBoard[nr][nc] = 'w' + draggedPiece;
          draggedPiece = null;
          renderBuilder();
          return;
        }

        if (draggedFrom) {
          const { r: sr, c: sc } = draggedFrom;
          if (sr === nr && sc === nc) { draggedFrom = null; return; }
          const sourcePiece = builderBoard[sr][sc];
          if (!sourcePiece) { draggedFrom = null; return; }
          builderBoard[nr][nc] = sourcePiece;
          builderBoard[sr][sc] = targetPiece || null;
          draggedFrom = null;
          renderBuilder();
        }
      });

      sq.addEventListener('click', () => {
        const piece = builderBoard[builderR][c];
        if (piece && pt(piece) !== 'K') { builderBoard[builderR][c] = null; renderBuilder(); }
      });

      grid.appendChild(sq);
    }
  }
}

function renderCards() {
  const container = document.getElementById('cards-container');
  container.innerHTML = '';
  PIECE_CATALOG.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'piece-card';
    card.draggable = true;
    card.innerHTML = `
      <div class="card-icon">${entry.icon}</div>
      <div class="card-name">${entry.name}</div>
      <div class="card-cost">${entry.cost} pts</div>
    `;
    card.addEventListener('dragstart', () => { draggedPiece = entry.type; draggedFrom = null; });
    card.addEventListener('dragend',   () => { draggedPiece = null; });
    container.appendChild(card);
  });
}

// ── Game State ──
let board, turn, selected, hints, lastMove, ep, cr, capW, capB, gameOver;
let myColor = null;
let socket  = null;
let gameId  = null;

function setupGame() {
  board=initBoard(); turn='w'; selected=null; hints=[]; lastMove=null;
  ep=null; cr={wK:true,wKR:true,wQR:true,bK:true,bKR:true,bQR:true};
  capW=[]; capB=[]; gameOver=false;
}

function applyCustomBoard() {
  if (!customBoard) return;
  for (let r = 4; r < 8; r++)
    for (let c = 0; c < 8; c++)
      board[r][c] = customBoard[r][c];
}

// ── Player cards ──
function updatePlayerCards() {
  const panel  = document.getElementById('panel');
  const cardW  = document.getElementById('card-w');
  const cardB  = document.getElementById('card-b');
  const btnNew = document.getElementById('btn-new-game');
  if (myColor === 'b') {
    panel.insertBefore(cardW, btnNew);
    panel.insertBefore(cardB, cardW);
  } else {
    panel.insertBefore(cardB, btnNew);
    panel.insertBefore(cardW, cardB);
  }
}

// ── Piece rendering ──
function pieceSpan(p) {
  const span = document.createElement('span');
  span.textContent = PIECES[p];
  if (pc(p) === 'w') {
    span.style.color = '#ffffff';
    span.style.textShadow = '-1px -1px 0 #333, 1px -1px 0 #333, -1px 1px 0 #333, 1px 1px 0 #333';
  } else {
    span.style.color = '#000000';
    span.style.textShadow = '-1px -1px 0 #999, 1px -1px 0 #999, -1px 1px 0 #999, 1px 1px 0 #999';
  }
  return span;
}

// ── Render ──
function render() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = myColor === 'b' ? 7-r : r;
      const dc = myColor === 'b' ? 7-c : c;

      const sq = document.createElement('div');
      sq.className = 'sq ' + ((dr+dc)%2===0 ? 'light':'dark');
      sq.dataset.r = dr; sq.dataset.c = dc;

      if (selected && selected[0]===dr && selected[1]===dc) sq.classList.add('selected');
      if (lastMove && ([lastMove[0],lastMove[2]].includes(dr)) && ([lastMove[1],lastMove[3]].includes(dc))) sq.classList.add('last-move');

      const isHint = hints.some(([hr,hc])=>hr===dr&&hc===dc);
      if (isHint) { sq.classList.add('hint'); if (board[dr][dc]) sq.classList.add('occupied'); }

      if (board[dr][dc]) sq.appendChild(pieceSpan(board[dr][dc]));

      sq.addEventListener('click', onClick);
      boardEl.appendChild(sq);
    }
  }

  document.getElementById('cap-b').textContent = capB.map(p=>PIECES[p]).join('');
  document.getElementById('cap-w').textContent = capW.map(p=>PIECES[p]).join('');
  document.getElementById('card-w').className = 'player-card'+(turn==='w'?' active':'');
  document.getElementById('card-b').className = 'player-card'+(turn==='b'?' active':'');
}

function setStatus(msg, cls='') {
  const el = document.getElementById('status-bar');
  el.textContent = msg;
  el.className = cls;
}

// ── Input ──
function onClick(e) {
  if (gameOver) return;
  if (myColor && turn !== myColor) return;

  const r=+e.currentTarget.dataset.r, c=+e.currentTarget.dataset.c;

  if (selected) {
    const [sr,sc] = selected;
    if (hints.some(([hr,hc])=>hr===r&&hc===c)) {
      doMove(sr,sc,r,c,true);
      return;
    }
  }

  if (board[r][c] && pc(board[r][c])===turn) {
    selected = [r,c];
    hints = legalMoves(board,r,c,ep,cr);
  } else {
    selected = null; hints = [];
  }
  render();
}

function doMove(r,c,nr,nc,emit=false){
  const p=board[r][c], typ_=pt(p), col=pc(p);

  // ── Wizard remote capture ──
  // If wizard moves diagonally, it stays in place and only removes the target
  if (typ_==='Z') {
    const d = col==='w' ? -1 : 1;
    if (nr===r+d && nc!==c) {
      // diagonal = remote capture
      const captured = board[nr][nc];
      if (captured) (col==='w' ? capB : capW).push(captured);
      board[nr][nc] = null;
      // wizard does NOT move
      lastMove = [r,c,nr,nc];
      selected = null; hints = [];
      if (emit && socket) socket.emit('move', { r, c, nr, nc, promo: null, wizardRemote: true });
      turn = opp(col);
      render();
      checkEnd();
      return;
    }
  }

  let captured = board[nr][nc];
  if(typ_==='P'&&ep&&nr===ep[0]&&nc===ep[1]){
    captured=board[r][nc]; board[r][nc]=null;
  }
  if(captured)(col==='w'?capB:capW).push(captured);

  board[nr][nc]=p; board[r][c]=null;

  if(typ_==='K'){
    const row=col==='w'?7:0;
    if(nc===6){board[row][5]=board[row][7];board[row][7]=null;}
    if(nc===2){board[row][3]=board[row][0];board[row][0]=null;}
    cr[col+'K']=false; cr[col+'KR']=false; cr[col+'QR']=false;
  }
  if(typ_==='R'){
    if(r===7&&c===0) cr.wQR=false;
    if(r===7&&c===7) cr.wKR=false;
    if(r===0&&c===0) cr.bQR=false;
    if(r===0&&c===7) cr.bKR=false;
  }

  // Wizard never promotes
  const isPromo = typ_==='P' && (nr===0||nr===7);

  ep=(typ_==='P'&&Math.abs(nr-r)===2)?[(r+nr)/2,c]:null;
  lastMove=[r,c,nr,nc];
  selected=null; hints=[];

  if(isPromo){
    render();
    showPromo(col, (choice)=>{
      board[nr][nc]=col+choice;
      if(emit&&socket) socket.emit('move',{r,c,nr,nc,promo:choice});
      turn=opp(col);
      render();
      checkEnd();
    });
    return;
  }

  if(emit&&socket) socket.emit('move',{r,c,nr,nc,promo:null});
  turn=opp(col);
  render();
  checkEnd();
}

function checkEnd(){
  const moves=allLegal(board,turn,ep,cr);
  const[kr,kc]=findKing(board,turn);
  const inCheck=isAttacked(board,kr,kc,opp(turn));
  const name=turn==='w'?'White':'Black';
  const oname=turn==='w'?'Black':'White';
  if(!moves.length){
    gameOver=true;
    if(inCheck) showMessage('Checkmate!', `${oname} wins the game.`);
    else showMessage('Stalemate!', "It's a draw.");
  } else if(inCheck){
    setStatus(`${name} is in check!`,'check');
  } else {
    if(myColor){
      setStatus(turn===myColor?'Your turn':"Opponent's turn", turn===myColor?'your-turn':'');
    } else {
      setStatus(`${name} to move`);
    }
  }
}

function showPromo(col, cb){
  const overlay=document.getElementById('promo-overlay');
  const choices=document.getElementById('promo-choices');
  choices.innerHTML='';
  overlay.classList.add('show');
  for(const t of['Q','R','B','N']){
    const btn=document.createElement('div');
    btn.className='promo-btn';
    btn.textContent=PIECES[col+t];
    btn.onclick=()=>{ overlay.classList.remove('show'); cb(t); };
    choices.appendChild(btn);
  }
}

function showMessage(title, msg){
  const overlay=document.getElementById('message-overlay');
  document.getElementById('msg-title').textContent=title;
  document.getElementById('msg-body').textContent=msg;
  overlay.classList.add('show');
}

// ── Online multiplayer ──
function initSocket(){
  socket = io();

  socket.on('game_created',({gameId: id, color})=>{
    gameId=id; myColor=color;
    document.getElementById('game-code-display').innerHTML =
      'Share this code with your friend:<span>' + id + '</span>';
    document.getElementById('btn-create').style.display = 'none';
    document.getElementById('join-area').style.display  = 'none';
    document.getElementById('btn-local').style.display  = 'none';
    document.getElementById('btn-build').style.display  = 'none';
  });

  socket.on('game_joined',({color})=>{ myColor=color; });

  socket.on('game_start', ({whiteBoard, blackBoard}) => {
    setupGame();
    if (whiteBoard) for (let r=4;r<8;r++) for (let c=0;c<8;c++) board[r][c]=whiteBoard[r][c];
    if (blackBoard) for (let r=0;r<4;r++) for (let c=0;c<8;c++) board[r][c]=blackBoard[r][c];
    // Also apply local custom board for this player if server didn't send one
    if (!whiteBoard && myColor==='w') applyCustomBoard();
    if (!blackBoard && myColor==='b') applyCustomBoard();
    showGame();
    updatePlayerCards();
    setStatus(myColor==='w'?'Your turn':"Opponent's turn", myColor==='w'?'your-turn':'');
    render();
  });

  socket.on('opponent_move',({r,c,nr,nc,promo,wizardRemote})=>{
    if (wizardRemote) {
      // Wizard remote capture: just remove the target piece
      const captured = board[nr][nc];
      if (captured) (pc(board[r][c])==='w' ? capB : capW).push(captured);
      board[nr][nc] = null;
      lastMove = [r,c,nr,nc];
      turn = opp(turn);
      render();
      checkEnd();
      return;
    }
    doMove(r,c,nr,nc,false);
    if(promo){ board[nr][nc]=pc(board[nr][nc])+promo; render(); }
    checkEnd();
  });

  socket.on('turn_change',({turn: t})=>{
    turn=t;
    if(!gameOver) setStatus(t===myColor?'Your turn':"Opponent's turn", t===myColor?'your-turn':'');
    render();
  });

  socket.on('opponent_disconnected',()=>{
    showMessage('Opponent left','Your opponent disconnected.');
    gameOver=true;
  });

  socket.on('error',(msg)=>{ alert(msg); });
}

// ── UI wiring ──
window.addEventListener('DOMContentLoaded', ()=>{
  initSocket();
  setupGame();

  document.getElementById('btn-create').addEventListener('click',()=>{
    socket.emit('create_game', { customBoard: customBoard || null });
  });

  document.getElementById('btn-join').addEventListener('click',()=>{
    const code=document.getElementById('join-input').value.trim().toUpperCase();
    if(!code){ alert('Enter a game code'); return; }
    setupGame();
    socket.emit('join_game', { gameId: code, customBoard: customBoard || null });
  });

  document.getElementById('btn-local').addEventListener('click',()=>{
    myColor=null;
    setupGame();
    applyCustomBoard();
    showGame();
    updatePlayerCards();
    setStatus('White to move');
    render();
  });

  document.getElementById('btn-build').addEventListener('click',()=>{ openBuilder(); });
  document.getElementById('btn-builder-back').addEventListener('click',()=>{ closeBuilder(false); });
  document.getElementById('btn-builder-save').addEventListener('click',()=>{ closeBuilder(true); });
  document.getElementById('btn-new-game').addEventListener('click',()=>{ showLobby(); });
  document.getElementById('message-overlay').addEventListener('click',()=>{
    document.getElementById('message-overlay').classList.remove('show');
  });
});

function showGame(){
  document.getElementById('lobby').style.display   = 'none';
  document.getElementById('builder').style.display = 'none';
  document.getElementById('game').style.display    = 'flex';
  render();
}

function showLobby(){
  document.getElementById('lobby').style.display   = 'flex';
  document.getElementById('game').style.display    = 'none';
  document.getElementById('builder').style.display = 'none';
  document.getElementById('game-code-display').innerHTML = '';
  document.getElementById('btn-create').style.display = '';
  document.getElementById('join-area').style.display  = '';
  document.getElementById('btn-local').style.display  = '';
  document.getElementById('btn-build').style.display  = '';
  myColor=null; gameId=null;
  setupGame();
}
