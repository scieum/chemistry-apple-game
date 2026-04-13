// ═══════════════════════════════════════════════════════
// ranking.js - 랭킹 시스템, 학교 검색 (NEIS API)
// 사용자 등록(코드) → 최고 기록만 유지 → 랭킹 보드
// ═══════════════════════════════════════════════════════

// 시/도 교육청 코드
const REGIONS = [
  { code: 'B10', name: '서울특별시' },
  { code: 'C10', name: '부산광역시' },
  { code: 'D10', name: '대구광역시' },
  { code: 'E10', name: '인천광역시' },
  { code: 'F10', name: '광주광역시' },
  { code: 'G10', name: '대전광역시' },
  { code: 'H10', name: '울산광역시' },
  { code: 'I10', name: '세종특별자치시' },
  { code: 'J10', name: '경기도' },
  { code: 'K10', name: '강원특별자치도' },
  { code: 'M10', name: '충청북도' },
  { code: 'N10', name: '충청남도' },
  { code: 'P10', name: '전북특별자치도' },
  { code: 'Q10', name: '전라남도' },
  { code: 'R10', name: '경상북도' },
  { code: 'S10', name: '경상남도' },
  { code: 'T10', name: '제주특별자치도' },
];

let supabaseClient = null;
let schoolCache = {}; // regionCode → schools[]

// ── 현재 로그인 사용자 ──
let rankingUser = null; // { nickname, pinHash, schoolName }

// ═══════════════════════════════════════════════════════
// Supabase 초기화
// ═══════════════════════════════════════════════════════

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!window.supabase) {
    console.warn('Supabase SDK가 로드되지 않았습니다');
    return null;
  }
  if (CONFIG.SUPABASE_URL === 'https://YOUR_PROJECT.supabase.co') {
    console.warn('Supabase 설정이 필요합니다 (config.js)');
    return null;
  }
  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return supabaseClient;
}

// ═══════════════════════════════════════════════════════
// PIN 해싱 (SHA-256, 클라이언트 사이드)
// ═══════════════════════════════════════════════════════

async function hashPin(nickname, pin) {
  const text = `chem-apple-game:${nickname.trim()}:${pin}`;
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ═══════════════════════════════════════════════════════
// RPC: 닉네임 중복 확인
// ═══════════════════════════════════════════════════════

async function checkNicknameExists(nickname) {
  const sb = initSupabase();
  if (!sb) return false;

  const { data, error } = await sb.rpc('nickname_exists', {
    p_nickname: nickname.trim(),
  });
  if (error) {
    console.error('닉네임 확인 실패:', error);
    return false;
  }
  return data === true;
}

// ═══════════════════════════════════════════════════════
// RPC: 회원가입
// ═══════════════════════════════════════════════════════

async function registerUser({ nickname, pin, schoolName, schoolCode, regionCode, regionName }) {
  const sb = initSupabase();
  if (!sb) return { error: 'Supabase 미설정' };

  const pinHash = await hashPin(nickname, pin);

  const { data, error } = await sb.rpc('register_user', {
    p_nickname: nickname.trim(),
    p_pin_hash: pinHash,
    p_school_name: schoolName || null,
    p_school_code: schoolCode || null,
    p_region_code: regionCode || null,
    p_region_name: regionName || null,
  });

  if (error) {
    console.error('회원가입 실패:', error);
    return { error: error.message };
  }

  // 로그인 상태 저장
  rankingUser = { nickname: nickname.trim(), pinHash, schoolName };
  saveUserToStorage();
  return { data };
}

// ═══════════════════════════════════════════════════════
// RPC: 로그인 (PIN 검증)
// ═══════════════════════════════════════════════════════

async function verifyUser(nickname, pin) {
  const sb = initSupabase();
  if (!sb) return { error: 'Supabase 미설정' };

  const pinHash = await hashPin(nickname, pin);

  const { data, error } = await sb.rpc('verify_user', {
    p_nickname: nickname.trim(),
    p_pin_hash: pinHash,
  });

  if (error) {
    console.error('로그인 실패:', error);
    return { error: error.message };
  }

  if (!data) {
    return { error: '닉네임 또는 식별번호가 올바르지 않습니다' };
  }

  // 로그인 상태 저장
  rankingUser = { nickname: nickname.trim(), pinHash };
  saveUserToStorage();
  return { data };
}

// ═══════════════════════════════════════════════════════
// RPC: 점수 제출 (최고 기록만 유지)
// ═══════════════════════════════════════════════════════

async function submitScore(score, compoundsFound) {
  if (!rankingUser) return { error: '로그인이 필요합니다' };

  const sb = initSupabase();
  if (!sb) return { error: 'Supabase 미설정' };

  const { data, error } = await sb.rpc('submit_score', {
    p_nickname: rankingUser.nickname,
    p_pin_hash: rankingUser.pinHash,
    p_score: score,
    p_compounds_found: compoundsFound,
  });

  if (error) {
    console.error('점수 제출 실패:', error);
    return { error: error.message };
  }

  return { data };
}

// ═══════════════════════════════════════════════════════
// RPC: 랭킹 조회
// ═══════════════════════════════════════════════════════

async function fetchRankings(limit = 50) {
  const sb = initSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_top_ranking', {
    p_limit: limit,
  });

  if (error) {
    console.error('랭킹 조회 실패:', error);
    return [];
  }
  return data || [];
}

// ═══════════════════════════════════════════════════════
// RPC: 내 주변 순위
// ═══════════════════════════════════════════════════════

async function fetchMyNeighbors(window = 3) {
  if (!rankingUser) return [];

  const sb = initSupabase();
  if (!sb) return [];

  const { data, error } = await sb.rpc('get_neighbors', {
    p_nickname: rankingUser.nickname,
    p_window: window,
  });

  if (error) {
    console.error('내 순위 조회 실패:', error);
    return [];
  }
  return data || [];
}

// ═══════════════════════════════════════════════════════
// 로컬 스토리지 (로그인 유지)
// ═══════════════════════════════════════════════════════

function saveUserToStorage() {
  if (!rankingUser) return;
  try {
    localStorage.setItem('chemGame_user', JSON.stringify(rankingUser));
  } catch (e) { /* 무시 */ }
}

function loadUserFromStorage() {
  try {
    const raw = localStorage.getItem('chemGame_user');
    if (raw) {
      rankingUser = JSON.parse(raw);
    }
  } catch (e) { /* 무시 */ }
}

function logoutUser() {
  rankingUser = null;
  try { localStorage.removeItem('chemGame_user'); } catch (e) { /* 무시 */ }
}

// 페이지 로드 시 복원
loadUserFromStorage();

// ═══════════════════════════════════════════════════════
// NEIS API 학교 검색
// ═══════════════════════════════════════════════════════

async function fetchSchools(regionCode) {
  if (schoolCache[regionCode]) return schoolCache[regionCode];

  const schools = [];
  let page = 1;
  // API 키 없으면 pSize 최대 100, 있으면 1000
  const pageSize = CONFIG.NEIS_API_KEY ? 1000 : 100;

  try {
    while (true) {
      const url = new URL('https://open.neis.go.kr/hub/schoolInfo');
      url.searchParams.set('Type', 'json');
      url.searchParams.set('pIndex', String(page));
      url.searchParams.set('pSize', String(pageSize));
      url.searchParams.set('ATPT_OFCDC_SC_CODE', regionCode);
      url.searchParams.set('SCHUL_KND_SC_NM', '고등학교');
      if (CONFIG.NEIS_API_KEY) url.searchParams.set('KEY', CONFIG.NEIS_API_KEY);

      const res = await fetch(url.toString());
      const data = await res.json();
      const rows = data?.schoolInfo?.[1]?.row;
      if (!rows || rows.length === 0) break;

      for (const r of rows) {
        const addrParts = (r.ORG_RDNMA || '').split(' ');
        schools.push({
          code: r.SD_SCHUL_CODE,
          name: r.SCHUL_NM,
          district: addrParts[1] || '기타',
        });
      }

      if (rows.length < pageSize) break;
      page++;
    }

    schools.sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
    schoolCache[regionCode] = schools;
    return schools;
  } catch (err) {
    console.error('NEIS API 오류:', err);
    return [];
  }
}

// 시/군/구 목록 추출
function getDistricts(schools) {
  const set = new Set(schools.map(s => s.district));
  return [...set].sort();
}

// ═══════════════════════════════════════════════════════
// 랭킹보드 렌더링
// ═══════════════════════════════════════════════════════

async function renderRankingBoard() {
  const list = document.getElementById('rankingList');
  if (!list) return;

  list.innerHTML = '<div class="loading-text">랭킹을 불러오는 중...</div>';

  const rankings = await fetchRankings();

  if (rankings.length === 0) {
    list.innerHTML = '<div class="empty-text">아직 등록된 기록이 없습니다</div>';
    return;
  }

  list.innerHTML = rankings.map((r) => {
    const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}`;
    const ago = getRelativeTime(r.updated_at);
    const isMe = rankingUser && r.nickname === rankingUser.nickname;
    const highlight = isMe ? 'ranking-highlight' : '';
    return `<div class="ranking-row ${highlight}">
      <span class="ranking-rank">${medal}</span>
      <div class="ranking-info">
        <span class="ranking-name">${escapeHtml(r.nickname)}${isMe ? ' (나)' : ''}</span>
        <span class="ranking-school">${escapeHtml(r.school_name || '')}</span>
      </div>
      <div class="ranking-stats">
        <span class="ranking-score">${r.score}점</span>
        <span class="ranking-meta">${r.compounds_found}개 발견 · ${ago}</span>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// 학교 검색 UI 초기화
// ═══════════════════════════════════════════════════════

let selectedSchool = null;

function initSchoolSearch(prefix = '') {
  const regionSelect = document.getElementById(prefix + 'regionSelect');
  const districtSelect = document.getElementById(prefix + 'districtSelect');
  const schoolSelect = document.getElementById(prefix + 'schoolSelect');

  if (!regionSelect) return;

  // 시/도 옵션 채우기
  regionSelect.innerHTML = '<option value="">시/도 선택</option>';
  for (const r of REGIONS) {
    regionSelect.innerHTML += `<option value="${r.code}">${r.name}</option>`;
  }

  regionSelect.addEventListener('change', async () => {
    districtSelect.innerHTML = '<option value="">불러오는 중...</option>';
    districtSelect.disabled = true;
    schoolSelect.innerHTML = '<option value="">학교 선택</option>';
    schoolSelect.disabled = true;
    selectedSchool = null;

    if (!regionSelect.value) {
      districtSelect.innerHTML = '<option value="">시/군/구 선택</option>';
      return;
    }

    const schools = await fetchSchools(regionSelect.value);
    const districts = getDistricts(schools);

    districtSelect.innerHTML = '<option value="">시/군/구 선택</option>';
    for (const d of districts) {
      districtSelect.innerHTML += `<option value="${d}">${d}</option>`;
    }
    districtSelect.disabled = false;
  });

  districtSelect.addEventListener('change', () => {
    schoolSelect.innerHTML = '<option value="">학교 선택</option>';
    schoolSelect.disabled = true;
    selectedSchool = null;

    const regionCode = regionSelect.value;
    const district = districtSelect.value;
    if (!district || !schoolCache[regionCode]) return;

    const filtered = schoolCache[regionCode].filter(s => s.district === district);
    for (const s of filtered) {
      schoolSelect.innerHTML += `<option value="${s.code}" data-name="${s.name}">${s.name}</option>`;
    }
    schoolSelect.disabled = false;
  });

  schoolSelect.addEventListener('change', () => {
    const opt = schoolSelect.selectedOptions[0];
    if (opt && opt.value) {
      const region = REGIONS.find(r => r.code === regionSelect.value);
      selectedSchool = {
        code: opt.value,
        name: opt.dataset.name,
        regionCode: regionSelect.value,
        regionName: region ? region.name : '',
      };
    } else {
      selectedSchool = null;
    }
  });
}

// ═══════════════════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════════════════

function getRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  return `${diffDays}일 전`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
