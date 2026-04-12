// ═══════════════════════════════════════════════════════
// chemistry.js - 원소 데이터 및 옥텟 규칙 기반 화합물 검증
// ═══════════════════════════════════════════════════════

const ELEMENTS = {
  H:  { symbol: 'H',  name: '수소',     atomicNum: 1,  valence: 1, bonds: 1, type: 'nonmetal', color: '#E8E8E8', textColor: '#333' },
  He: { symbol: 'He', name: '헬륨',     atomicNum: 2,  valence: 2, bonds: 0, type: 'noble',    color: '#D9F7FF', textColor: '#333' },
  B:  { symbol: 'B',  name: '붕소',     atomicNum: 5,  valence: 3, bonds: 3, type: 'metalloid',color: '#FFB5B5', textColor: '#333' },
  C:  { symbol: 'C',  name: '탄소',     atomicNum: 6,  valence: 4, bonds: 4, type: 'nonmetal', color: '#555555', textColor: '#FFF' },
  N:  { symbol: 'N',  name: '질소',     atomicNum: 7,  valence: 5, bonds: 3, type: 'nonmetal', color: '#3050F8', textColor: '#FFF' },
  O:  { symbol: 'O',  name: '산소',     atomicNum: 8,  valence: 6, bonds: 2, type: 'nonmetal', color: '#FF0D0D', textColor: '#FFF' },
  F:  { symbol: 'F',  name: '플루오린', atomicNum: 9,  valence: 7, bonds: 1, type: 'nonmetal', color: '#90E050', textColor: '#333' },
  Na: { symbol: 'Na', name: '나트륨',   atomicNum: 11, valence: 1, bonds: 1, type: 'metal',    color: '#AB5CF2', textColor: '#FFF' },
  Mg: { symbol: 'Mg', name: '마그네슘', atomicNum: 12, valence: 2, bonds: 2, type: 'metal',    color: '#8AFF00', textColor: '#333' },
  Al: { symbol: 'Al', name: '알루미늄', atomicNum: 13, valence: 3, bonds: 3, type: 'metal',    color: '#BFA6A6', textColor: '#333' },
  Si: { symbol: 'Si', name: '규소',     atomicNum: 14, valence: 4, bonds: 4, type: 'metalloid',color: '#F0C8A0', textColor: '#333' },
  P:  { symbol: 'P',  name: '인',       atomicNum: 15, valence: 5, bonds: 3, type: 'nonmetal', color: '#FF8000', textColor: '#FFF' },
  S:  { symbol: 'S',  name: '황',       atomicNum: 16, valence: 6, bonds: 2, type: 'nonmetal', color: '#FFFF30', textColor: '#333' },
  Cl: { symbol: 'Cl', name: '염소',     atomicNum: 17, valence: 7, bonds: 1, type: 'nonmetal', color: '#1FF01F', textColor: '#333' },
  K:  { symbol: 'K',  name: '칼륨',     atomicNum: 19, valence: 1, bonds: 1, type: 'metal',    color: '#8F40D4', textColor: '#FFF' },
  Ca: { symbol: 'Ca', name: '칼슘',     atomicNum: 20, valence: 2, bonds: 2, type: 'metal',    color: '#3DFF00', textColor: '#333' },
};

// 게임 모드: 'all' = 이온+공유, 'covalent' = 공유결합만
let gameMode = 'covalent';

// 모드별 등장 원소
const GAME_ELEMENTS_ALL = [
  { symbol: 'H',  weight: 20 },
  { symbol: 'C',  weight: 10 },
  { symbol: 'N',  weight: 8  },
  { symbol: 'O',  weight: 15 },
  { symbol: 'F',  weight: 8  },
  { symbol: 'Na', weight: 6  },
  { symbol: 'Mg', weight: 4  },
  { symbol: 'Al', weight: 3  },
  { symbol: 'Si', weight: 3  },
  { symbol: 'P',  weight: 4  },
  { symbol: 'S',  weight: 6  },
  { symbol: 'Cl', weight: 10 },
  { symbol: 'K',  weight: 4  },
  { symbol: 'Ca', weight: 4  },
  { symbol: 'B',  weight: 3  },
];

const GAME_ELEMENTS_COVALENT = [
  { symbol: 'H',  weight: 25 },
  { symbol: 'C',  weight: 12 },
  { symbol: 'N',  weight: 10 },
  { symbol: 'O',  weight: 18 },
  { symbol: 'F',  weight: 10 },
  { symbol: 'Si', weight: 4  },
  { symbol: 'P',  weight: 6  },
  { symbol: 'S',  weight: 8  },
  { symbol: 'Cl', weight: 12 },
  { symbol: 'B',  weight: 4  },
];

// 현재 모드에 따라 원소 목록 반환
function getGameElements() {
  return gameMode === 'covalent' ? GAME_ELEMENTS_COVALENT : GAME_ELEMENTS_ALL;
}

// 하위 호환용
const GAME_ELEMENTS = GAME_ELEMENTS_ALL;

// ═══════════════════════════════════════════════════════
// 이름이 있는 화합물 사전 (이름 조회용)
// 알고리즘으로 유효성은 별도 판단하므로, 여기는 이름만
// ═══════════════════════════════════════════════════════

const COMPOUND_NAMES = {
  // 공유 결합
  'H2': { formula: 'H₂', name: '수소' },
  'O2': { formula: 'O₂', name: '산소' },
  'N2': { formula: 'N₂', name: '질소' },
  'F2': { formula: 'F₂', name: '플루오린' },
  'Cl2': { formula: 'Cl₂', name: '염소' },
  'H1O1': { formula: 'OH', name: '하이드록실' },
  'H2O1': { formula: 'H₂O', name: '물' },
  'C1O2': { formula: 'CO₂', name: '이산화 탄소' },
  'C1O1': { formula: 'CO', name: '일산화 탄소' },
  'N1H3': { formula: 'NH₃', name: '암모니아' },
  'C1H4': { formula: 'CH₄', name: '메테인' },
  'H1Cl1': { formula: 'HCl', name: '염화 수소' },
  'H1F1': { formula: 'HF', name: '플루오린화 수소' },
  'H2S1': { formula: 'H₂S', name: '황화 수소' },
  'S1O2': { formula: 'SO₂', name: '이산화 황' },
  'S1O3': { formula: 'SO₃', name: '삼산화 황' },
  'N2O1': { formula: 'N₂O', name: '아산화 질소' },
  'N1O1': { formula: 'NO', name: '일산화 질소' },
  'N1O2': { formula: 'NO₂', name: '이산화 질소' },
  'N2O4': { formula: 'N₂O₄', name: '사산화 이질소' },
  'N2O5': { formula: 'N₂O₅', name: '오산화 이질소' },
  'C2O1': { formula: 'C₂O', name: '이산화 이탄소' },
  'P2O5': { formula: 'P₂O₅', name: '오산화 이인' },
  'P4O10': { formula: 'P₄O₁₀', name: '십산화 사인' },
  'C1S2': { formula: 'CS₂', name: '이황화 탄소' },
  'B1F3': { formula: 'BF₃', name: '삼플루오린화 붕소' },
  'N1F3': { formula: 'NF₃', name: '삼플루오린화 질소' },
  'O1F2': { formula: 'OF₂', name: '이플루오린화 산소' },
  'C1Cl4': { formula: 'CCl₄', name: '사염화 탄소' },
  'C1F4': { formula: 'CF₄', name: '사플루오린화 탄소' },
  'P1Cl3': { formula: 'PCl₃', name: '삼염화 인' },
  'P1H3': { formula: 'PH₃', name: '포스핀' },
  'P1F3': { formula: 'PF₃', name: '삼플루오린화 인' },
  'Si1H4': { formula: 'SiH₄', name: '실레인' },
  'Si1F4': { formula: 'SiF₄', name: '사플루오린화 규소' },
  'Si1Cl4': { formula: 'SiCl₄', name: '사염화 규소' },
  'S1Cl2': { formula: 'SCl₂', name: '이염화 황' },
  'S1F2': { formula: 'SF₂', name: '이플루오린화 황' },
  'O1Cl2': { formula: 'Cl₂O', name: '이염화 일산소' },
  'Cl1F1': { formula: 'ClF', name: '플루오린화 염소' },
  'H1C1N1': { formula: 'HCN', name: '시안화 수소' },
  'C1H2O1': { formula: 'CH₂O', name: '폼알데하이드' },
  'C1Cl2O1': { formula: 'COCl₂', name: '포스겐' },
  'H2O2': { formula: 'H₂O₂', name: '과산화 수소' },
  'C2H2': { formula: 'C₂H₂', name: '에타인' },
  'C2H4': { formula: 'C₂H₄', name: '에텐' },
  'C2H6': { formula: 'C₂H₆', name: '에테인' },
  'N2F2': { formula: 'N₂F₂', name: '이플루오린화 이질소' },
  'N2F4': { formula: 'N₂F₄', name: '사플루오린화 이질소' },
  'O2F2': { formula: 'O₂F₂', name: '이플루오린화 이산소' },
  'C2F2': { formula: 'C₂F₂', name: '디플루오로에타인' },
  'Cl1N1O1': { formula: 'NOCl', name: '염화 나이트로실' },
  'C1F1N1': { formula: 'FCN', name: '플루오린화 사이아노젠' },
  'F1N1O1': { formula: 'FNO', name: '플루오린화 나이트로실' },
  'H1N1O1': { formula: 'HNO', name: '나이트록실' },
  'B1Cl3': { formula: 'BCl₃', name: '삼염화 붕소' },
  'B1H3': { formula: 'BH₃', name: '보레인' },
  'N1Cl3': { formula: 'NCl₃', name: '삼염화 질소' },
  'S1F6': { formula: 'SF₆', name: '육플루오린화 황' },
  'P1F5': { formula: 'PF₅', name: '오플루오린화 인' },

  // 이온 결합 (대표적)
  'Cl1Na1': { formula: 'NaCl', name: '염화 나트륨' },
  'F1Na1': { formula: 'NaF', name: '플루오린화 나트륨' },
  'H1Na1': { formula: 'NaH', name: '수소화 나트륨' },
  'Cl1K1': { formula: 'KCl', name: '염화 칼륨' },
  'F1K1': { formula: 'KF', name: '플루오린화 칼륨' },
  'H1K1': { formula: 'KH', name: '수소화 칼륨' },
  'Ca1O1': { formula: 'CaO', name: '산화 칼슘' },
  'Mg1O1': { formula: 'MgO', name: '산화 마그네슘' },
  'Ca1S1': { formula: 'CaS', name: '황화 칼슘' },
  'Mg1S1': { formula: 'MgS', name: '황화 마그네슘' },
  'Ca1Cl2': { formula: 'CaCl₂', name: '염화 칼슘' },
  'Cl2Mg1': { formula: 'MgCl₂', name: '염화 마그네슘' },
  'Ca1F2': { formula: 'CaF₂', name: '플루오린화 칼슘' },
  'F2Mg1': { formula: 'MgF₂', name: '플루오린화 마그네슘' },
  'Ca1H2': { formula: 'CaH₂', name: '수소화 칼슘' },
  'H2Mg1': { formula: 'MgH₂', name: '수소화 마그네슘' },
  'Na2O1': { formula: 'Na₂O', name: '산화 나트륨' },
  'K2O1': { formula: 'K₂O', name: '산화 칼륨' },
  'Na2S1': { formula: 'Na₂S', name: '황화 나트륨' },
  'K2S1': { formula: 'K₂S', name: '황화 칼륨' },
  'Al2O3': { formula: 'Al₂O₃', name: '산화 알루미늄' },
  'Al1Cl3': { formula: 'AlCl₃', name: '염화 알루미늄' },
  'Al1F3': { formula: 'AlF₃', name: '플루오린화 알루미늄' },
  'Al1H3': { formula: 'AlH₃', name: '수소화 알루미늄' },
  'Al2S3': { formula: 'Al₂S₃', name: '황화 알루미늄' },
  'Ca3N2': { formula: 'Ca₃N₂', name: '질화 칼슘' },
  'Mg3N2': { formula: 'Mg₃N₂', name: '질화 마그네슘' },
  'Na3N1': { formula: 'Na₃N', name: '질화 나트륨' },
};

// ═══════════════════════════════════════════════════════
// 원소 카운트 유틸
// ═══════════════════════════════════════════════════════

function countAtoms(selectedElements) {
  const counts = {};
  for (const el of selectedElements) {
    counts[el.symbol] = (counts[el.symbol] || 0) + 1;
  }
  return counts;
}

// 카운트맵 → 정렬된 키 문자열 (사전 조회용)
function atomKey(counts) {
  return Object.keys(counts).sort().map(s => s + counts[s]).join('');
}

// ═══════════════════════════════════════════════════════
// 이온 결합 검증: 전하 균형
// 금속이 잃는 전자 수 = 비금속이 얻는 전자 수
// ═══════════════════════════════════════════════════════

function checkIonicBond(counts) {
  let totalLost = 0;   // 금속이 잃는 전자
  let totalGained = 0;  // 비금속이 얻는 전자
  let hasMetal = false;
  let hasNonmetal = false;

  for (const [sym, cnt] of Object.entries(counts)) {
    const el = ELEMENTS[sym];
    if (!el) return false;

    if (el.type === 'metal') {
      hasMetal = true;
      totalLost += el.valence * cnt; // 원자가전자를 모두 잃음
    } else if (el.type === 'nonmetal' || el.type === 'metalloid') {
      hasNonmetal = true;
      if (sym === 'H') {
        totalGained += 1 * cnt; // H는 1개 전자를 얻어 듀엣 완성 (H⁻)
      } else {
        totalGained += (8 - el.valence) * cnt; // 옥텟까지 부족한 만큼 얻음
      }
    }
  }

  return hasMetal && hasNonmetal && totalLost === totalGained && totalLost > 0;
}

// ═══════════════════════════════════════════════════════
// 공유 결합 검증: 결합 수 균형
// 총 결합 슬롯이 짝수이고, 각 원자의 옥텟을 만족
// ═══════════════════════════════════════════════════════

// 같은 원소 2개로만 이루어진 이원자 분자 중 실제 존재하는 것
const VALID_HOMONUCLEAR_DIATOMIC = new Set(['H', 'N', 'O', 'F', 'Cl']);

function checkCovalentBond(counts) {
  let totalBondSlots = 0;
  let atomCount = 0;
  let hasMetal = false;
  const symbols = Object.keys(counts);

  for (const [sym, cnt] of Object.entries(counts)) {
    const el = ELEMENTS[sym];
    if (!el) return false;
    if (el.type === 'metal') hasMetal = true;
    totalBondSlots += el.bonds * cnt;
    atomCount += cnt;
  }

  // 금속이 포함되면 공유결합 아님
  if (hasMetal) return false;
  // 원자 1개만으론 분자 아님
  if (atomCount < 2) return false;
  // 총 결합 슬롯이 짝수여야 함 (각 결합은 양쪽에서 1개씩)
  if (totalBondSlots % 2 !== 0) return false;
  // 결합이 하나 이상 있어야 함
  if (totalBondSlots < 2) return false;

  // 같은 원소 2개짜리 (X₂)는 화이트리스트만 허용 (S₂, P₂, B₂ 등 차단)
  if (symbols.length === 1 && atomCount === 2) {
    if (!VALID_HOMONUCLEAR_DIATOMIC.has(symbols[0])) return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════
// 화합물 찾기 메인 함수
// ═══════════════════════════════════════════════════════

function findCompound(selectedElements) {
  if (selectedElements.length < 2) return null;

  const counts = countAtoms(selectedElements);
  const key = atomKey(counts);

  // 1. 이온 결합 체크 (공유결합 전용 모드에서는 건너뜀)
  if (gameMode !== 'covalent' && checkIonicBond(counts)) {
    const nameEntry = COMPOUND_NAMES[key];
    const formula = nameEntry ? nameEntry.formula : generateFormula(counts, 'ionic');
    const name = nameEntry ? nameEntry.name : '이온 화합물';
    const points = selectedElements.length * 100 + (selectedElements.length > 3 ? 200 : 0);
    return { atoms: counts, formula, name, bondType: 'ionic', points };
  }

  // 2. 공유 결합 체크
  if (checkCovalentBond(counts)) {
    const nameEntry = COMPOUND_NAMES[key];
    const formula = nameEntry ? nameEntry.formula : generateFormula(counts, 'covalent');
    const name = nameEntry ? nameEntry.name : '공유 화합물';
    const points = selectedElements.length * 100 + (selectedElements.length > 3 ? 200 : 0);
    return { atoms: counts, formula, name, bondType: 'covalent', points };
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// 화학식 자동 생성
// ═══════════════════════════════════════════════════════

const FORMULA_ORDER = ['C','Si','B','Al','Mg','Ca','Na','K','N','P','S','O','H','F','Cl'];

function generateFormula(counts, bondType) {
  let parts = [];

  if (bondType === 'ionic') {
    // 이온: 양이온(금속) 먼저, 음이온 나중
    const metals = [];
    const nonmetals = [];
    for (const sym of Object.keys(counts)) {
      if (ELEMENTS[sym].type === 'metal') metals.push(sym);
      else nonmetals.push(sym);
    }
    for (const sym of metals) {
      parts.push(sym + (counts[sym] > 1 ? subscriptStr(counts[sym]) : ''));
    }
    for (const sym of nonmetals) {
      parts.push(sym + (counts[sym] > 1 ? subscriptStr(counts[sym]) : ''));
    }
  } else {
    // 공유: Hill order (C먼저, H다음, 나머지 알파벳)
    const ordered = Object.keys(counts).sort((a, b) => {
      const ia = FORMULA_ORDER.indexOf(a);
      const ib = FORMULA_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    for (const sym of ordered) {
      parts.push(sym + (counts[sym] > 1 ? subscriptStr(counts[sym]) : ''));
    }
  }

  return parts.join('');
}

function subscriptStr(n) {
  const subs = { 0: '\u2080', 1: '\u2081', 2: '\u2082', 3: '\u2083', 4: '\u2084', 5: '\u2085', 6: '\u2086', 7: '\u2087', 8: '\u2088', 9: '\u2089' };
  return String(n).split('').map(d => subs[d] || d).join('');
}

// ═══════════════════════════════════════════════════════
// 힌트: 부분 매칭 (이온 결합 + 공유 결합 모두)
// ═══════════════════════════════════════════════════════

function findPartialMatches(selectedElements) {
  if (selectedElements.length === 0) return [];
  const counts = countAtoms(selectedElements);

  // 현재 선택에서 어떤 원소를 1~2개 더 추가하면 완성되는지 힌트
  const hints = [];

  // 이온결합 힌트: 전하 차이 계산
  let hasMetal = false, hasNonmetal = false;
  let totalLost = 0, totalGained = 0;
  for (const [sym, cnt] of Object.entries(counts)) {
    const el = ELEMENTS[sym];
    if (el.type === 'metal') {
      hasMetal = true;
      totalLost += el.valence * cnt;
    } else {
      hasNonmetal = true;
      totalGained += (sym === 'H' ? 1 : 8 - el.valence) * cnt;
    }
  }

  if (hasMetal && totalLost > totalGained) {
    const diff = totalLost - totalGained;
    // 어떤 비금속을 추가하면 되는지
    for (const ge of GAME_ELEMENTS) {
      const el = ELEMENTS[ge.symbol];
      if (el.type !== 'nonmetal') continue;
      const gain = ge.symbol === 'H' ? 1 : 8 - el.valence;
      if (diff % gain === 0 && diff / gain <= 3) {
        const need = diff / gain;
        hints.push({ formula: '+ ' + ge.symbol + (need > 1 ? '×' + need : ''), remaining: { [ge.symbol]: need } });
      }
    }
  }
  if (hasNonmetal && !hasMetal && totalGained > totalLost) {
    const diff = totalGained - totalLost;
    for (const ge of GAME_ELEMENTS) {
      const el = ELEMENTS[ge.symbol];
      if (el.type !== 'metal') continue;
      if (diff % el.valence === 0 && diff / el.valence <= 3) {
        const need = diff / el.valence;
        hints.push({ formula: '+ ' + ge.symbol + (need > 1 ? '×' + need : ''), remaining: { [ge.symbol]: need } });
      }
    }
  }

  // 공유결합 힌트: 남은 결합 슬롯
  if (!hasMetal) {
    let slots = 0;
    for (const [sym, cnt] of Object.entries(counts)) {
      slots += ELEMENTS[sym].bonds * cnt;
    }
    if (slots % 2 !== 0) {
      // 홀수 슬롯 → 1개짜리 결합 원소 추가하면 됨
      for (const sym of ['H', 'F', 'Cl', 'Br', 'I']) {
        hints.push({ formula: '+ ' + sym, remaining: { [sym]: 1 } });
      }
    }
  }

  return hints.slice(0, 4);
}

// ═══════════════════════════════════════════════════════
// 랜덤 원소 선택
// ═══════════════════════════════════════════════════════

function getRandomElement() {
  const elements = getGameElements();
  const totalWeight = elements.reduce((sum, e) => sum + e.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const entry of elements) {
    rand -= entry.weight;
    if (rand <= 0) return ELEMENTS[entry.symbol];
  }
  return ELEMENTS[elements[0].symbol];
}
