// ============================================================================
// ChessLens v6 - Plataforma profissional de análise de xadrez
// ============================================================================

// ============ UTILIDADES & INICIALIZAÇÃO ============
const $=id=>document.getElementById(id),showPbar=w=>{const p=$('pbar');p.style.width=w+'%';p.style.opacity=w<100?'1':'0'};

// ============ ESTADO GLOBAL ============
const PREF={},TRAPS=[],ANL={},RAW={},FILTERED=[],TREE={path:[],color:'w',moves:{}};
let Chart={defaults:{color:''}},engine=null,engineReady=false,evalMode=false,lastScore=null;

// Temas de tabuleiro
const THEMES={
  esmeralda:['#f0d9b5','#baca44'],
  madeira:['#ead6ca','#8b6f47'],
  oceano:['#d5f4f1','#27948a'],
  roxo:['#e8d5ef','#9b7ba9'],
  noturno:['#2a2a2a','#1a1a1a']
};

const GLYPH={p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'},LETTER={p:'P',n:'N',b:'B',r:'R',q:'Q',k:'K'};
const PIECE_CDN='https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/';
const SVG_SETS=['cburnett','merida','alpha','maestro','staunty','tatiana'];
const pieceUrl=(setName,pc)=>PIECE_CDN+setName+'/'+pc.color+pc.type.toUpperCase()+'.svg';
let svgFail=false;

// ============ GERENCIAR UI ============
function setupUI(){
  const menuBtn=$('menuBtn'),drawer=$('drawer'),scrim=$('scrim');
  menuBtn.onclick=()=>{drawer.classList.toggle('open');scrim.classList.toggle('on')};
  scrim.onclick=()=>{drawer.classList.remove('open');scrim.classList.remove('on')};
  
  document.querySelectorAll('[data-go]').forEach(a=>{
    a.onclick=e=>{
      e.preventDefault();
      const page=a.dataset.go;
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('act'));
      $(page).classList.add('act');
      document.querySelectorAll('[data-go]').forEach(x=>x.classList.remove('act'));
      a.classList.add('act');
      drawer.classList.remove('open');
      scrim.classList.remove('on');
      window.scrollTo(0,0);
    };
  });
}

// ============ PREFERÊNCIAS & ARMAZENAMENTO ============
function savePref(key,val){
  PREF[key]=val;
  localStorage.setItem('cl_pref',JSON.stringify(PREF));
}

function loadPref(){
  const saved=localStorage.getItem('cl_pref');
  if(saved)Object.assign(PREF,JSON.parse(saved));
  PREF.uiTheme=PREF.uiTheme||'dark';
  PREF.uiFont=PREF.uiFont||'Inter';
  PREF.recent=PREF.recent||[];
  applyUiPrefs();
}

function applyUiPrefs(){
  document.documentElement.setAttribute('data-theme',PREF.uiTheme);
  document.documentElement.style.setProperty('--font',"'"+(PREF.uiFont||'Inter')+"'");
  Chart.defaults.color=(PREF.uiTheme==='light')?'#5b6478':'#94a3b8';
}

function recentUpdate(user,plat){
  const rec=(PREF.recent||[]).filter(x=>!(x.u===user&&x.p===plat));
  rec.unshift({u:user,p:plat});
  savePref('recent',rec.slice(0,6));
  renderRecent();
}

function renderRecent(){
  const r=PREF.recent||[];
  $('recentBox').classList.toggle('hide',!r.length);
  $('recentChips').innerHTML=r.map(x=>`<span class="chip" onclick="quickGo('${x.u}','${x.p}')">${x.u} · ${x.p==='chesscom'?'♔ Chess.com':'♘ Lichess'}</span>`).join('');
}

// ============ TEMAS & FONTE ============
function setupThemeControls(){
  const theme=$('uiTheme'),font=$('uiFont');
  
  theme.value=PREF.uiTheme;
  font.value=PREF.uiFont;
  
  theme.onchange=()=>{
    savePref('uiTheme',theme.value);
    applyUiPrefs();
    if(FILTERED.length)analyze(FILTERED,RAW.user);
  };
  
  font.onchange=()=>{
    savePref('uiFont',font.value);
    applyUiPrefs();
  };
}

// ============ TABULEIRO & VISUALIZAÇÃO ============
function drawBoard(el,gm,opts={}){
  el.innerHTML='';
  const th=THEMES[$('boardTheme')?.value||'esmeralda']||THEMES.esmeralda;
  let set=$('pieceSet')?.value||'cburnett';
  if(set==='svg')set='cburnett';
  if(svgFail&&SVG_SETS.includes(set))set='uni';
  
  const files=['a','b','c','d','e','f','g','h'];
  const ranks=opts.bottom==='w'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  const fs=opts.bottom==='w'?files:[...files].reverse();
  const frag=document.createDocumentFragment();
  
  for(const r of ranks){
    for(const f of fs){
      const sqName=f+r;
      const d=document.createElement('div');
      const isLight=(files.indexOf(f)+r)%2!==0;
      d.className='sq';
      d.style.background=isLight?th[0]:th[1];
      
      if(opts.sel===sqName)d.classList.add('sel');
      if(opts.legal?.includes(sqName))d.classList.add('dot');
      if(opts.lastMove?.[0]===sqName||opts.lastMove?.[1]===sqName)d.classList.add('last');
      if(opts.hint?.[0]===sqName||opts.hint?.[1]===sqName)d.classList.add('hint');
      
      const pc=gm.get(sqName);
      if(pc){
        if(SVG_SETS.includes(set)){
          const img=document.createElement('img');
          img.src=pieceUrl(set,pc);
          img.alt=pc.type;
          img.onerror=()=>{if(!svgFail){svgFail=true;drawBoard(el,gm,opts);}};
          d.appendChild(img);
        }else if(set==='txt'){
          d.textContent=LETTER[pc.type];
          d.classList.add('txtset',pc.color==='w'?'wp':'bp');
        }else{
          d.textContent=GLYPH[pc.type];
          d.classList.add(pc.color==='w'?'wp':'bp');
        }
      }
      
      if(opts.click)d.onclick=()=>opts.click(sqName);
      frag.appendChild(d);
    }
  }
  el.appendChild(frag);
}

// ============ TABULEIRO DE ANÁLISE ============
function setupAnalysisBoard(){
  ANL.game=new Chess();
  ANL.moves=[];
  ANL.idx=0;
  ANL.flip=false;
  ANL.last=null;

  const gameSelect=$('anlGame');
  if(FILTERED.length){
    gameSelect.innerHTML=FILTERED.slice(-100).reverse().map((g,i)=>{
      const d=g.ts?new Date(g.ts).toLocaleDateString('pt-BR'):'—';
      const res=g.result==='w'?'✅ V':(g.result==='l'?'❌ D':'➖ E');
      return `<option value="${FILTERED.length-1-i}">${d} · ${g.color==='w'?'♔':'♚'} vs ${g.opName||'?'} (${g.opRating||'—'}) · ${res}</option>`;
    }).join('');
  }

  $('anlLoad').onclick=()=>{
    const g=FILTERED[+gameSelect.value];
    if(!g){$('anlStatus').textContent='Analise um jogador primeiro.';return;}
    ANL.flip=g.color==='b';
    anlSet(g.moves,'Partida vs '+g.opName);
  };

  $('anlLoadFen').onclick=()=>{
    const v=$('anlFen').value.trim();
    if(!v)return;
    if(/^([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+\s+[wb]\s/.test(v)){
      const g=new Chess();
      if(g.load(v)){
        ANL.game=g;ANL.moves=[];ANL.idx=0;ANL.last=null;
        $('anlStatus').textContent='FEN carregado.';
        renderAnal();
      }else{
        $('anlStatus').textContent='FEN inválido.';
      }
    }else{
      ANL.flip=false;
      anlSet(movesFromPgn(v),'Lances colados');
    }
  };

  $('anlStart').onclick=()=>anlGoto(0);
  $('anlPrev').onclick=()=>anlGoto(ANL.idx-1);
  $('anlNext').onclick=()=>anlGoto(ANL.idx+1);
  $('anlEnd').onclick=()=>anlGoto(ANL.moves.length);
  $('anlFlip').onclick=()=>{ANL.flip=!ANL.flip;renderAnal();};

  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if($('results')?.classList.contains('hide'))return;
    if(e.key==='ArrowLeft'){anlGoto(ANL.idx-1);e.preventDefault();}
    if(e.key==='ArrowRight'){anlGoto(ANL.idx+1);e.preventDefault();}
  });

  $('anlEval').onclick=evalPosition;
}

function anlSet(moves,label){
  const t=new Chess(),ok=[];
  for(const s of moves){
    if(!t.move(s,{sloppy:true}))break;
    ok.push(s);
  }
  ANL.moves=ok;
  ANL.idx=0;
  ANL.last=null;
  ANL.game=new Chess();
  $('evalTxt').textContent='';
  renderAnal();
  $('anlStatus').textContent=`${label} — ${ok.length} meios-lances. Navegue com ◀ ▶ ou setas.`;
}

function anlGoto(i){
  i=Math.max(0,Math.min(ANL.moves.length,i));
  const g=new Chess();
  let last=null;
  for(let k=0;k<i;k++){
    const m=g.move(ANL.moves[k],{sloppy:true});
    if(m)last=[m.from,m.to];
  }
  ANL.game=g;
  ANL.idx=i;
  ANL.last=last;
  $('evalTxt').textContent='';
  renderAnal();
}

function renderAnal(){
  if(!$('aboard'))return;
  drawBoard($('aboard'),ANL.game,{bottom:ANL.flip?'b':'w',lastMove:ANL.last});
  if(ANL.moves.length){
    const done=ANL.moves.slice(0,ANL.idx);
    $('anlStatus').textContent=(done.length?done.map((m,i)=>i%2===0?`${i/2+1}. ${m}`:m).join('  '):'Posição inicial')+`   (${ANL.idx}/${ANL.moves.length})`;
  }
}

// ============ MOTOR DE XADREZ ============
async function initEngine(){
  if(engineReady)return Promise.resolve();
  return new Promise((resolve)=>{
    const wasmUrl='https://cdn.jsdelivr.net/npm/stockfish@16/dist/stockfish.wasm';
    importScripts=url=>new Worker(url);
    Stockfish().then(sf=>{
      engine=sf;
      engine.onmessage=e=>{
        const d=e.data;
        if(d==='uciok')engineReady=true;
        if(evalMode&&d.startsWith('info ')){
          const m=d.match(/score (cp|mate) (-?\d+)/);
          if(m)lastScore={type:m[1],v:+m[2]};
        }
        if(d.startsWith('bestmove')){
          evalMode=false;
          showEval(d.split(' ')[1]);
        }
      };
      engine.postMessage('uci');
      setTimeout(resolve,500);
    }).catch(()=>resolve());
  });
}

function evalPosition(){
  if(engine&&engineReady){
    evalMode=true;
    lastScore=null;
    engine.postMessage('setoption name Skill Level value 20');
    engine.postMessage('position fen '+ANL.game.fen());
    engine.postMessage('go depth 14');
    $('evalTxt').textContent='⏳ Avaliando…';
    $('evalTxt').style.color='var(--mut)';
  }else{
    $('evalTxt').textContent='⏳ Carregando motor…';
    $('evalTxt').style.color='var(--mut)';
    initEngine().then(()=>{
      setTimeout(evalPosition,300);
    });
  }
}

function showEval(bestUci){
  let txt='',num=NaN;
  if(lastScore){
    const sign=ANL.game.turn()==='b'?-1:1;
    if(lastScore.type==='mate'){
      const mv=lastScore.v*sign;
      txt='M'+Math.abs(lastScore.v)+(mv>0?' (♔)':' (♚)');
      num=mv>0?99:-99;
    }else{
      num=lastScore.v*sign/100;
      txt=(num>=0?'+':'')+num.toFixed(2);
    }
  }
  $('evalTxt').textContent=(txt||'—');
  $('evalTxt').style.color=isNaN(num)?'var(--mut)':(num>0.3?'var(--good)':(num<-0.3?'var(--bad)':'var(--txt)'));
}

// ============ ÁRVORE DE ABERTURAS ============
function buildOpeningTree(){
  TREE.moves={};
  for(const game of FILTERED){
    const color=game.color;
    const moves=game.moves;
    let path='';
    for(const m of moves){
      path+=m+' ';
      if(!TREE.moves[path])TREE.moves[path]={w:0,d:0,l:0,pct:0};
      const entry=TREE.moves[path];
      if(game.result==='w'&&color==='w'||game.result==='b'&&color==='b')entry.w++;
      else if(game.result==='d')entry.d++;
      else entry.l++;
      const total=entry.w+entry.d+entry.l;
      entry.pct=Math.round(100*(entry.w+entry.d*0.5)/total);
    }
  }
}

function renderOpeningTree(){
  const treeBody=$('treeBody');
  if(!FILTERED.length){
    treeBody.innerHTML='<p style="color:var(--mut)">Analise um jogador.</p>';
    return;
  }
  
  buildOpeningTree();
  const rootMoves=new Map();
  
  for(const game of FILTERED){
    const fm=game.moves[0];
    if(fm){
      if(!rootMoves.has(fm))rootMoves.set(fm,{w:0,d:0,l:0});
      const m=rootMoves.get(fm);
      if(game.result==='w'&&game.color==='w')m.w++;
      else if(game.result==='d')m.d++;
      else m.l++;
    }
  }
  
  let html='<table style="font-size:.85rem"><tr><th>Lance</th><th>V/E/D</th><th>%</th></tr>';
  for(const [mv,s] of rootMoves){
    const total=s.w+s.d+s.l;
    const pct=Math.round(100*(s.w+s.d*0.5)/total);
    const color=pct>=55?'good':pct<=45?'bad':'warn';
    html+=`<tr class="mv" onclick="treeNav('${mv}')" style="cursor:pointer"><td>${mv}</td><td>${s.w}/${s.d}/${s.l}</td><td class="${color}">${pct}%</td></tr>`;
  }
  html+='</table>';
  treeBody.innerHTML=html;
}

function treeNav(move){
  TREE.path.push(move);
  const g=new Chess();
  let lm=null;
  for(const m of TREE.path){
    const mm=g.move(m,{sloppy:true});
    if(mm)lm=[mm.from,mm.to];else break;
  }
  drawBoard($('tboard'),g,{bottom:TREE.color,lastMove:lm});
}

// ============ ANÁLISE & PROCESSAMENTO ============
function fmt(n){
  if(n===undefined||n===null)return '—';
  return typeof n==='number'?n.toLocaleString('pt-BR'):String(n);
}

function pctc(p){
  if(p>=55)return 'good';
  if(p<=45)return 'bad';
  return 'warn';
}

function famName(opening){
  if(!opening)return '—';
  return opening.split(':')[0];
}

function movesFromPgn(pgn){
  if(!pgn||pgn.trim()==='')return [];
  const lines=pgn.split('\n');
  const moveStr=lines.filter(l=>!l.startsWith('[')).join(' ');
  return moveStr.match(/[a-h][1-8][a-h][1-8][a-h1-8]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8][a-h1-8]?[+#]?|O-O-O|O-O/g)||[];
}

async function analyze(games,user){
  if(games.length===0){
    $('status').textContent='Nenhuma partida para analisar.';
    return;
  }

  RAW.user=user;
  FILTERED=games;
  buildOpeningTree();
  
  // Visão geral
  renderOverview();
  
  // Gráficos
  renderCharts();
  
  // Aberturas
  renderOpeningTree();
  
  // Show results
  $('results').classList.remove('hide');
  $('status').textContent='✓ Análise concluída!';
  showPbar(100);
}

function renderOverview(){
  const games=FILTERED;
  if(games.length===0)return;
  
  const w=games.filter(g=>g.result==='w').length;
  const d=games.filter(g=>g.result==='d').length;
  const l=games.filter(g=>g.result==='l').length;
  const total=games.length;
  const pct=Math.round(100*(w+d*0.5)/total);
  const ratingAvg=Math.round(games.reduce((a,g)=>a+(g.opRating||0),0)/total);
  
  const overview=$('overview');
  overview.innerHTML=`
    <div class="stat">
      <div class="v">${total}</div>
      <div class="l">Partidas</div>
    </div>
    <div class="stat">
      <div class="v">${w}</div>
      <div class="l">Vitórias</div>
    </div>
    <div class="stat">
      <div class="v">${d}</div>
      <div class="l">Empates</div>
    </div>
    <div class="stat">
      <div class="v">${l}</div>
      <div class="l">Derrotas</div>
    </div>
    <div class="stat">
      <div class="v">${pct}%</div>
      <div class="l">Aproveitamento</div>
    </div>
    <div class="stat">
      <div class="v">+${Math.round(pct-50)}</div>
      <div class="l">Acima da média</div>
    </div>
    <div class="stat">
      <div class="v">${ratingAvg}</div>
      <div class="l">Rating médio oponente</div>
    </div>
    <div class="stat">
      <div class="v">${Math.round(games.reduce((a,g)=>a+(g.moves?.length||0),0)/total/2)}</div>
      <div class="l">Lances médios</div>
    </div>
  `;
  
  $('ovNote').innerHTML=`
    <b>Como calcular:</b> Aproveitamento = (Vitórias + ½ × Empates) ÷ Total de partidas.<br>
    Neste caso: (${w} + ${d}÷2) ÷ ${total} = <b>${pct}%</b>
  `;
}

function renderCharts(){
  // W/D/L
  const games=FILTERED;
  const w=games.filter(g=>g.result==='w').length;
  const d=games.filter(g=>g.result==='d').length;
  const l=games.filter(g=>g.result==='l').length;
  
  if($('chWDL')){
    const ctx=$('chWDL').getContext('2d');
    new Chart(ctx,{
      type:'doughnut',
      data:{
        labels:['Vitórias','Empates','Derrotas'],
        datasets:[{data:[w,d,l],backgroundColor:['#34d399','#fbbf24','#fb7185']}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true}}}
    });
  }
}

// ============ API - CHESS.COM ============
async function fetchChesscomGames(user,limit=500){
  try{
    showPbar(10);
    const stats=await fetch(`https://api.chess.com/pub/player/${user}`).then(r=>r.json());
    const statsBlitz=await fetch(`https://api.chess.com/pub/player/${user}/stats`).then(r=>r.json());
    
    showPbar(20);
    const archivesReq=await fetch(`https://api.chess.com/pub/player/${user}/games/archives`).then(r=>r.json());
    const archives=archivesReq.archives||[];
    
    let allGames=[];
    for(const url of archives.slice(-3)){
      const monthGames=await fetch(url).then(r=>r.json());
      allGames.push(...monthGames.games||[]);
    }
    
    allGames=allGames.slice(-limit);
    showPbar(50);
    
    const games=allGames.map(g=>{
      const isWhite=g.white.username.toLowerCase()===user.toLowerCase();
      const isBot=g.white.username.toLowerCase().includes('bot')||g.black.username.toLowerCase().includes('bot');
      if(isBot)return null;
      
      const moves=g.pgn.match(/1\.|2\.|[a-zA-Z0-9]+/g)||[];
      return {
        url:g.url,
        ts:g.end_time*1000,
        color:isWhite?'w':'b',
        opName:isWhite?g.black.username:g.white.username,
        opRating:isWhite?g.black.rating:g.white.rating,
        result:g.status==='checkmate'?(g.winner===g.white.username?'w':'l'):(g.status==='stalemate'?'d':'d'),
        tc:g.time_class||'rapid',
        moves:movesFromPgn(g.pgn)||[],
        opening:g.opening||{},
        fen:g.fen||''
      };
    }).filter(g=>g!==null);
    
    showPbar(100);
    return games;
  }catch(e){
    console.error('Erro Chess.com:',e);
    return [];
  }
}

// ============ API - LICHESS ============
async function fetchLichessGames(user,limit=500){
  try{
    showPbar(10);
    const games=await fetch(`https://lichess.org/api/games/user/${user}?max=${limit}&perfType=blitz,rapid,classical`).then(r=>r.text());
    
    showPbar(50);
    const parsed=games.split('\n\n').filter(g=>g.trim()).map(pgn=>{
      const moves=movesFromPgn(pgn);
      const event=pgn.match(/\[Event\s"([^"]+)"/)?.[1]||'';
      const white=pgn.match(/\[White\s"([^"]+)"/)?.[1]||'';
      const black=pgn.match(/\[Black\s"([^"]+)"/)?.[1]||'';
      const result=pgn.match(/\[Result\s"([^"]+)"/)?.[1]||'1/2-1/2';
      
      return {
        color:white.toLowerCase()===user.toLowerCase()?'w':'b',
        opName:white.toLowerCase()===user.toLowerCase()?black:white,
        opRating:0,
        result:result==='1-0'?'w':(result==='0-1'?'l':'d'),
        moves:moves,
        opening:event,
        pgn:pgn
      };
    });
    
    showPbar(100);
    return parsed;
  }catch(e){
    console.error('Erro Lichess:',e);
    return [];
  }
}

// ============ INICIALIZAÇÃO ============
window.addEventListener('load',()=>{
  loadPref();
  setupUI();
  setupThemeControls();
  setupAnalysisBoard();
  renderRecent();
  
  // Exemplo rápido
  window.quickGo=(u,p)=>{
    $('user').value=u;
    $('plat').value=p;
    $('go').click();
  };
  
  // Botão analisar
  $('go').onclick=async()=>{
    const user=$('user').value.trim();
    const plat=$('plat').value;
    const maxGames=parseInt($('maxg').value);
    
    if(!user){
      $('status').textContent='Digite um username.';
      return;
    }
    
    $('status').textContent='⏳ Carregando partidas…';
    $('results').classList.add('hide');
    
    let games=[];
    if(plat==='chesscom'){
      games=await fetchChesscomGames(user,maxGames);
    }else if(plat==='lichess'){
      games=await fetchLichessGames(user,maxGames);
    }
    
    if(games.length===0){
      $('status').textContent='❌ Nenhuma partida encontrada. Verifique o username.';
      return;
    }
    
    recentUpdate(user,plat);
    await analyze(games,user);
  };
});
