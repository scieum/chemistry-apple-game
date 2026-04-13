// ═══════════════════════════════════════════════════════
// game.js - 그리드 기반 화학 결합 퍼즐 게임
// (사과게임 스타일: 격자에서 인접 원소를 드래그 연결하여 제거)
// ═══════════════════════════════════════════════════════

const COLS = 17;
const ROWS = 10;
const CELL_SIZE = 44;
const PADDING = 6;
const GRID_OFFSET_X = 20;
const GRID_OFFSET_Y = 20;
const CANVAS_WIDTH = GRID_OFFSET_X * 2 + COLS * CELL_SIZE;
const CANVAS_HEIGHT = GRID_OFFSET_Y * 2 + ROWS * CELL_SIZE;

const TIME_LIMIT = 120; // 초 (2분)

// ── 게임 상태 ──
let canvas, ctx;
let grid = [];           // grid[row][col] = { element, selected, removing, id }
let selectedCells = [];  // [{row, col}, ...]
let isDragging = false;
let dragStartCell = null; // 직사각형 드래그 시작점
let dragEndCell = null;   // 직사각형 드래그 끝점
let score = 0;
let combo = 0;
let compoundsFound = [];
let animating = false;
let hoverCell = null;
let timeRemaining = TIME_LIMIT;
let timerInterval = null;
let gameOver = false;

// ── 초기화 ──
function initGame() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('mouseleave', onPointerUp);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onPointerDown(getTouchPos(e)); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onPointerMove(getTouchPos(e)); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); onPointerUp(); }, { passive: false });

  resetGame();
  requestAnimationFrame(render);
}

function resetGame() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = createCell();
    }
  }
  selectedCells = [];
  isDragging = false;
  score = 0;
  combo = 0;
  compoundsFound = [];
  animating = false;
  gameOver = false;
  timeRemaining = TIME_LIMIT;
  document.getElementById('gameOverOverlay').classList.remove('show');
  document.querySelector('.game-over-box h2').textContent = 'GAME OVER';
  updateUI();
  updateCompoundList();
  startTimer();
}

function createCell() {
  return {
    element: getRandomElement(),
    selected: false,
    removing: false,
    opacity: 1,
    scale: 1,
    id: Math.random().toString(36).substr(2, 9),
  };
}

function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0] || e.changedTouches[0];
  return {
    offsetX: (touch.clientX - rect.left) * (canvas.width / rect.width),
    offsetY: (touch.clientY - rect.top) * (canvas.height / rect.height),
  };
}

// ═══════════════════════════════════════════════════════
// 그리드 좌표 변환
// ═══════════════════════════════════════════════════════

function getCellFromPos(x, y) {
  const col = Math.floor((x - GRID_OFFSET_X) / CELL_SIZE);
  const row = Math.floor((y - GRID_OFFSET_Y) / CELL_SIZE);
  if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
    return { row, col };
  }
  return null;
}

function getCellCenter(row, col) {
  return {
    x: GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2,
    y: GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

// ═══════════════════════════════════════════════════════
// 입력 처리 (직사각형 드래그 선택)
// ═══════════════════════════════════════════════════════

function onPointerDown(e) {
  if (animating || gameOver) return;
  const x = e.offsetX;
  const y = e.offsetY;
  const cell = getCellFromPos(x, y);

  if (cell) {
    isDragging = true;
    dragStartCell = cell;
    dragEndCell = cell;
    clearSelection();
    updateRectSelection();
  }
}

function onPointerMove(e) {
  const x = e.offsetX;
  const y = e.offsetY;
  const cell = getCellFromPos(x, y);
  hoverCell = cell;

  if (!isDragging || animating || gameOver || !cell) return;

  dragEndCell = cell;
  updateRectSelection();
}

function onPointerUp() {
  if (!isDragging) return;
  isDragging = false;

  if (selectedCells.length >= 2) {
    tryMakeCompound();
  } else {
    clearSelection();
  }
  dragStartCell = null;
  dragEndCell = null;
}

// 직사각형 영역 내 모든 셀 선택
function updateRectSelection() {
  clearSelection();
  if (!dragStartCell || !dragEndCell) return;

  const r1 = Math.min(dragStartCell.row, dragEndCell.row);
  const r2 = Math.max(dragStartCell.row, dragEndCell.row);
  const c1 = Math.min(dragStartCell.col, dragEndCell.col);
  const c2 = Math.max(dragStartCell.col, dragEndCell.col);

  // 실제 원소가 있는 셀만 수집
  const candidates = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (grid[r][c]) candidates.push({ row: r, col: c });
    }
  }

  // 최대 6원소 제한 (빈 칸은 세지 않음)
  if (candidates.length > 6) return;

  for (const cell of candidates) {
    grid[cell.row][cell.col].selected = true;
    selectedCells.push(cell);
  }
  updateHintDisplay();
}

function clearSelection() {
  for (const c of selectedCells) {
    if (grid[c.row] && grid[c.row][c.col]) {
      grid[c.row][c.col].selected = false;
    }
  }
  selectedCells = [];
  updateHintDisplay();
}

// ═══════════════════════════════════════════════════════
// 화합물 생성
// ═══════════════════════════════════════════════════════

function tryMakeCompound() {
  const elements = selectedCells.map(c => grid[c.row][c.col].element);
  const compound = findCompound(elements);

  if (compound) {
    // 성공!
    combo++;
    const isNew = !compoundsFound.some(c => c.formula === compound.formula);
    const noveltyMultiplier = isNew ? 1.5 : 0.5;
    const comboMultiplier = 1 + (combo - 1) * 0.3;
    const ionicBonus = compound.bondType === 'ionic' ? 1.5 : 1;
    const earnedPoints = Math.floor(compound.points * noveltyMultiplier * comboMultiplier * ionicBonus);
    score += earnedPoints;

    // 애니메이션: 제거
    animating = true;
    for (const c of selectedCells) {
      grid[c.row][c.col].removing = true;
    }

    // 메시지
    const newTag = isNew ? ' NEW!' : '';
    const comboText = combo > 1 ? ` ${combo}콤보!` : '';
    showFloatingMessage(`${compound.formula} ${compound.name}${newTag} +${earnedPoints}${comboText}`);

    // 발견 기록
    if (isNew) {
      compoundsFound.push(compound);
      updateCompoundList();
    }

    updateUI();

    // 제거만 하고 나머지는 그 자리 유지
    setTimeout(() => {
      removeCells();
      animating = false;
      checkAllCleared();
    }, 300);

  } else {
    // 분할 시도 (H4 → H₂ × 2 등)
    const split = findSplitCompounds(elements);
    if (split) {
      combo++;
      const { compound, count } = split;
      const isNew = !compoundsFound.some(c => c.formula === compound.formula);
      const noveltyMultiplier = isNew ? 1.5 : 0.5;
      const comboMultiplier = 1 + (combo - 1) * 0.3;
      const earnedPoints = Math.floor(compound.points * count * noveltyMultiplier * comboMultiplier);
      score += earnedPoints;

      animating = true;
      for (const c of selectedCells) {
        grid[c.row][c.col].removing = true;
      }

      const newTag = isNew ? ' NEW!' : '';
      const comboText = combo > 1 ? ` ${combo}콤보!` : '';
      showFloatingMessage(`${compound.formula} ×${count}${newTag} +${earnedPoints}${comboText}`);

      if (isNew) {
        compoundsFound.push(compound);
        updateCompoundList();
      }

      updateUI();
      setTimeout(() => {
        removeCells();
        animating = false;
        checkAllCleared();
      }, 300);
      return;
    }

    // 실패
    combo = 0;
    const counts = countAtoms(selectedCells.map(c => grid[c.row][c.col].element));
    const formulaStr = Object.entries(counts).map(([sym, cnt]) => cnt > 1 ? sym + cnt : sym).join('');
    showFloatingMessage(`${formulaStr} → 유효한 화합물이 아닙니다`);
    clearSelection();
    updateUI();
  }
}

// ═══════════════════════════════════════════════════════
// 셀 제거 (빈 자리 그대로 유지)
// ═══════════════════════════════════════════════════════

function removeCells() {
  for (const c of selectedCells) {
    grid[c.row][c.col] = null;
  }
  selectedCells = [];
}

// ═══════════════════════════════════════════════════════
// 타이머
// ═══════════════════════════════════════════════════════

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameOver || animating) return;
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) {
      timeRemaining = 0;
      endGame('TIME UP!');
    }
  }, 1000);
}

function updateTimerDisplay() {
  const gauge = document.getElementById('timeGaugeFill');
  if (!gauge) return;
  const pct = (timeRemaining / TIME_LIMIT) * 100;
  gauge.style.height = pct + '%';

  // 색상 변경
  gauge.classList.remove('warning', 'danger');
  if (timeRemaining <= 30) {
    gauge.classList.add('danger');
  } else if (timeRemaining <= 60) {
    gauge.classList.add('warning');
  }
}

let onGameEnd = null; // 외부 콜백

function endGame(title) {
  gameOver = true;
  if (timerInterval) clearInterval(timerInterval);

  // 외부 콜백이 있으면 호출 (phase 전환용)
  if (typeof onGameEnd === 'function') {
    onGameEnd({
      score,
      compoundsFound: compoundsFound.length,
      compoundsList: compoundsFound.map(c => ({ formula: c.formula, name: c.name, bondType: c.bondType })),
      title: title || 'GAME OVER',
    });
    return;
  }

  // 콜백 없으면 기존 오버레이 표시
  const overlay = document.getElementById('gameOverOverlay');
  document.getElementById('finalScore').textContent = score;
  document.getElementById('finalCompounds').textContent = compoundsFound.length;
  document.querySelector('.game-over-box h2').textContent = title || 'GAME OVER';
  overlay.classList.add('show');
}

function checkAllCleared() {
  // 모든 칸이 비었으면 클리어!
  let remaining = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== null) remaining++;
    }
  }
  const totalCells = ROWS * COLS;
  const cleared = totalCells - remaining;
  document.getElementById('foundCount').textContent = compoundsFound.length;

  if (remaining === 0) {
    showFloatingMessage('ALL CLEAR! +5000');
    score += 5000;
    updateUI();
    setTimeout(() => endGame('ALL CLEAR!'), 1000);
  }
}

// ═══════════════════════════════════════════════════════
// 떠다니는 메시지
// ═══════════════════════════════════════════════════════

let floatingMessages = [];

function showFloatingMessage(text) {
  floatingMessages.push({ text, life: 1, y: CANVAS_HEIGHT / 2 });
}

function updateFloatingMessages() {
  for (let i = floatingMessages.length - 1; i >= 0; i--) {
    const m = floatingMessages[i];
    m.life -= 0.015;
    m.y -= 0.5;
    if (m.life <= 0) floatingMessages.splice(i, 1);
  }
}

// ═══════════════════════════════════════════════════════
// 렌더링
// ═══════════════════════════════════════════════════════

function render() {
  updateFloatingMessages();
  draw();
  requestAnimationFrame(render);
}

function draw() {
  // 배경 (밝은 파스텔)
  ctx.fillStyle = '#f0eef6';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 그리드 배경
  ctx.fillStyle = '#e8e5f0';
  const gx = GRID_OFFSET_X - PADDING;
  const gy = GRID_OFFSET_Y - PADDING;
  const gw = COLS * CELL_SIZE + PADDING * 2;
  const gh = ROWS * CELL_SIZE + PADDING * 2;
  roundRect(ctx, gx, gy, gw, gh, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 직사각형 선택 영역 표시
  if (dragStartCell && dragEndCell && selectedCells.length > 0) {
    const r1 = Math.min(dragStartCell.row, dragEndCell.row);
    const r2 = Math.max(dragStartCell.row, dragEndCell.row);
    const c1 = Math.min(dragStartCell.col, dragEndCell.col);
    const c2 = Math.max(dragStartCell.col, dragEndCell.col);
    const rx = GRID_OFFSET_X + c1 * CELL_SIZE - 2;
    const ry = GRID_OFFSET_Y + r1 * CELL_SIZE - 2;
    const rw = (c2 - c1 + 1) * CELL_SIZE + 4;
    const rh = (r2 - r1 + 1) * CELL_SIZE + 4;

    ctx.fillStyle = 'rgba(108,99,255,0.08)';
    roundRect(ctx, rx, ry, rw, rh, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(108,99,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 셀 그리기
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (!cell) continue;

      const center = getCellCenter(r, c);
      const el = cell.element;
      const radius = (CELL_SIZE / 2 - 3) * cell.scale;

      if (radius <= 0) continue;

      ctx.save();

      // 제거 중이면 페이드아웃 + 축소
      if (cell.removing) {
        cell.opacity -= 0.06;
        cell.scale -= 0.03;
        if (cell.opacity < 0) cell.opacity = 0;
        if (cell.scale < 0) cell.scale = 0;
        ctx.globalAlpha = cell.opacity;
      }

      // 호버 효과
      const isHover = hoverCell && hoverCell.row === r && hoverCell.col === c && !cell.selected;

      // 그림자 (더 부드럽게)
      ctx.beginPath();
      ctx.arc(center.x + 2, center.y + 3, radius + 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();

      // 공 본체 (3D 효과 강화)
      const gradient = ctx.createRadialGradient(
        center.x - radius * 0.35, center.y - radius * 0.35, radius * 0.05,
        center.x + radius * 0.1, center.y + radius * 0.1, radius
      );
      gradient.addColorStop(0, lightenColor(el.color, 80));
      gradient.addColorStop(0.4, lightenColor(el.color, 20));
      gradient.addColorStop(1, darkenColor(el.color, 30));

      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 하이라이트 점 (상단)
      const hlGrad = ctx.createRadialGradient(
        center.x - radius * 0.25, center.y - radius * 0.3, 0,
        center.x - radius * 0.25, center.y - radius * 0.3, radius * 0.4
      );
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
      hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = hlGrad;
      ctx.fill();

      // 선택 시 하이라이트
      if (cell.selected) {
        ctx.shadowColor = '#6C63FF';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = 'rgba(108,99,255,0.7)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (isHover) {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // 원소 기호
      ctx.fillStyle = el.textColor;
      const fontSize = el.symbol.length > 1 ? radius * 0.7 : radius * 0.85;
      ctx.font = `bold ${fontSize}px 'KBO Dia Gothic', 'Noto Sans KR', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 텍스트 그림자
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(el.symbol, center.x, center.y + 0.5);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.restore();
    }
  }

  // 떠다니는 메시지
  for (const m of floatingMessages) {
    ctx.save();
    const alpha = Math.min(1, m.life * 2.5);
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 15px "Noto Sans KR", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    // 배경 패널
    const tw = ctx.measureText(m.text).width;
    ctx.fillStyle = `rgba(108,99,255,${0.85 * alpha})`;
    roundRect(ctx, CANVAS_WIDTH / 2 - tw / 2 - 14, m.y - 13, tw + 28, 30, 10);
    ctx.fill();
    // 텍스트
    ctx.fillStyle = '#fff';
    ctx.fillText(m.text, CANVAS_WIDTH / 2, m.y + 2);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════
// UI 업데이트
// ═══════════════════════════════════════════════════════

function updateUI() {
  const scoreEl = document.getElementById('scoreValue');
  const comboEl = document.getElementById('comboValue');
  if (scoreEl) scoreEl.textContent = score;
  if (comboEl) {
    comboEl.textContent = combo > 1 ? `${combo} COMBO!` : '';
  }
  updateTimerDisplay();
}

function updateHintDisplay() {
  const hintEl = document.getElementById('hintText');
  if (!hintEl) return;

  if (selectedCells.length === 0) {
    hintEl.textContent = '인접한 원소를 드래그하여 화합물을 만드세요!';
    return;
  }

  const elements = selectedCells.map(c => grid[c.row][c.col].element);
  const counts = countAtoms(elements);
  const currentFormula = Object.entries(counts)
    .map(([sym, cnt]) => cnt > 1 ? sym + subscript(cnt) : sym)
    .join('');

  // 완성 가능한 화합물 체크
  const compound = findCompound(elements);
  if (compound) {
    const bondLabel = compound.bondType === 'ionic' ? '이온 결합' : '공유 결합';
    hintEl.innerHTML = `<b>${compound.formula} ${compound.name}</b> (${bondLabel}) - 손을 떼면 완성!`;
    return;
  }

  const matches = findPartialMatches(elements);
  if (matches.length > 0) {
    const hints = matches.slice(0, 3).map(m => {
      const remaining = Object.entries(m.remaining);
      if (remaining.length === 0) return `${m.compound.formula}`;
      const needed = remaining.map(([s, c]) => `${s}${c > 1 ? '×' + c : ''}`).join('+');
      return `${m.compound.formula}(+${needed})`;
    });
    hintEl.innerHTML = `<b>${currentFormula}</b> → ${hints.join(' | ')}`;
  } else {
    hintEl.innerHTML = `<span style="color:#FF3B30"><b>${currentFormula}</b> - 가능한 화합물 없음</span>`;
  }
}

function updateCompoundList() {
  const listEl = document.getElementById('compoundList');
  if (!listEl) return;
  if (compoundsFound.length === 0) {
    listEl.innerHTML = '<div class="empty-text">아직 발견한 화합물이 없습니다</div>';
    return;
  }
  listEl.innerHTML = compoundsFound.map(c => {
    const badge = c.bondType === 'ionic'
      ? '<span class="badge ionic">이온</span>'
      : '<span class="badge covalent">공유</span>';
    return `<div class="compound-item">${badge} ${c.formula} <span class="compound-name">${c.name}</span></div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════════════════

function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
  const b = Math.max(0, (num & 0x0000FF) - percent);
  return `rgb(${r},${g},${b})`;
}

function subscript(n) {
  const subs = { 0: '\u2080', 1: '\u2081', 2: '\u2082', 3: '\u2083', 4: '\u2084', 5: '\u2085', 6: '\u2086', 7: '\u2087', 8: '\u2088', 9: '\u2089' };
  return String(n).split('').map(d => subs[d] || d).join('');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function restartGame() {
  document.getElementById('gameOverOverlay').classList.remove('show');
  resetGame();
}

// 게임 시작은 startGame()에서 호출 (index.html)
// initGame()을 자동 호출하지 않음
