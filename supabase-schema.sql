-- ============================================================
-- Chemistry Apple Game - Supabase 스키마
-- 사용자 등록(코드) → 최고 기록만 유지 → 랭킹 보드
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. 테이블                                                │
-- └─────────────────────────────────────────────────────────┘

-- 사용자 테이블 (닉네임 + PIN 해시)
create table chem_users (
  id          uuid primary key default gen_random_uuid(),
  nickname    text unique not null
                check (char_length(btrim(nickname)) between 1 and 20),
  pin_hash    text not null,
  school_name text,
  school_code text,
  region_code text,
  region_name text,
  created_at  timestamptz not null default now()
);

create index chem_users_nickname_idx on chem_users (nickname);

-- 랭킹 테이블 (유저당 1행 — 최고 기록만 보관)
create table chem_rankings (
  user_id         uuid primary key references chem_users(id) on delete cascade,
  nickname        text not null,
  school_name     text,
  region_name     text,
  score           int not null default 0 check (score >= 0),
  compounds_found int not null default 0 check (compounds_found >= 0),
  compounds       jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

-- 랭킹 정렬: 점수 높은 순 → 화합물 많은 순 → 먼저 달성한 순
create index chem_rankings_order_idx
  on chem_rankings (score desc, compounds_found desc, updated_at asc);


-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. RLS (Row Level Security)                              │
-- └─────────────────────────────────────────────────────────┘

alter table chem_users    enable row level security;
alter table chem_rankings enable row level security;

-- 랭킹은 누구나 조회 가능
create policy "랭킹 조회 허용"
  on chem_rankings for select using (true);

-- 직접 INSERT/UPDATE/DELETE 차단 → RPC만 허용
-- (chem_users에는 아예 정책 없음 = 직접 접근 불가)


-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. RPC 함수 (SECURITY DEFINER — RLS 우회)                │
-- └─────────────────────────────────────────────────────────┘

-- ── 3-1. 닉네임 중복 확인 ──
create or replace function nickname_exists(p_nickname text)
returns boolean
language sql stable security definer
as $$
  select exists(
    select 1 from chem_users where nickname = btrim(p_nickname)
  );
$$;


-- ── 3-2. 회원가입 ──
create or replace function register_user(
  p_nickname    text,
  p_pin_hash    text,
  p_school_name text default null,
  p_school_code text default null,
  p_region_code text default null,
  p_region_name text default null
)
returns uuid
language plpgsql security definer
as $$
declare
  v_id uuid;
begin
  -- 닉네임 정리
  p_nickname := btrim(p_nickname);

  if char_length(p_nickname) < 1 or char_length(p_nickname) > 20 then
    raise exception '닉네임은 1~20자여야 합니다';
  end if;

  if char_length(p_pin_hash) < 10 then
    raise exception '유효하지 않은 PIN 해시';
  end if;

  insert into chem_users (nickname, pin_hash, school_name, school_code, region_code, region_name)
  values (p_nickname, p_pin_hash, p_school_name, p_school_code, p_region_code, p_region_name)
  returning id into v_id;

  return v_id;

exception
  when unique_violation then
    raise exception '이미 사용 중인 닉네임입니다';
end;
$$;


-- ── 3-3. 로그인 (PIN 검증) ──
create or replace function verify_user(
  p_nickname text,
  p_pin_hash text
)
returns uuid
language sql stable security definer
as $$
  select id from chem_users
  where nickname = btrim(p_nickname)
    and pin_hash = p_pin_hash;
$$;


-- ── 3-4. 점수 제출 (최고 기록만 유지) ──
create or replace function submit_score(
  p_nickname        text,
  p_pin_hash        text,
  p_score           int,
  p_compounds_found int,
  p_compounds       jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer
as $$
declare
  v_user_id  uuid;
  v_nick     text;
  v_school   text;
  v_region   text;
  v_prev_score int;
  v_prev_compounds int;
  v_best_score int;
  v_best_compounds int;
  v_updated  boolean := false;
begin
  -- 1) 사용자 인증
  v_nick := btrim(p_nickname);

  select id, school_name, region_name
    into v_user_id, v_school, v_region
    from chem_users
   where nickname = v_nick and pin_hash = p_pin_hash;

  if v_user_id is null then
    raise exception '닉네임 또는 식별번호가 올바르지 않습니다';
  end if;

  -- 2) 입력 검증
  if p_score < 0 or p_score > 999999 then
    raise exception '점수 범위 초과';
  end if;

  -- 3) 기존 최고 기록 조회
  select score, compounds_found
    into v_prev_score, v_prev_compounds
    from chem_rankings
   where user_id = v_user_id;

  -- 4) 비교 & INSERT/UPDATE
  if v_prev_score is null then
    -- 첫 기록
    insert into chem_rankings (user_id, nickname, school_name, region_name,
                                score, compounds_found, compounds, updated_at)
    values (v_user_id, v_nick, v_school, v_region,
            p_score, p_compounds_found, p_compounds, now());
    v_updated := true;
    v_best_score := p_score;
    v_best_compounds := p_compounds_found;

  elsif (p_score > v_prev_score)
     or (p_score = v_prev_score and p_compounds_found > v_prev_compounds) then
    -- 새 기록이 더 좋음
    update chem_rankings
       set score           = p_score,
           compounds_found = p_compounds_found,
           compounds       = p_compounds,
           nickname        = v_nick,
           school_name     = v_school,
           region_name     = v_region,
           updated_at      = now()
     where user_id = v_user_id;
    v_updated := true;
    v_best_score := p_score;
    v_best_compounds := p_compounds_found;

  else
    -- 기존 기록이 더 좋음: 갱신 안 함
    v_best_score := v_prev_score;
    v_best_compounds := v_prev_compounds;
  end if;

  return jsonb_build_object(
    'updated',          v_updated,
    'prev_score',       v_prev_score,
    'prev_compounds',   v_prev_compounds,
    'best_score',       v_best_score,
    'best_compounds',   v_best_compounds
  );
end;
$$;


-- ── 3-5. 랭킹 Top N 조회 ──
create or replace function get_top_ranking(p_limit int default 50)
returns table (
  rank            int,
  nickname        text,
  school_name     text,
  region_name     text,
  score           int,
  compounds_found int,
  compounds       jsonb,
  updated_at      timestamptz
)
language sql stable security definer
as $$
  select
    row_number() over (
      order by score desc, compounds_found desc, updated_at asc
    )::int as rank,
    nickname,
    school_name,
    region_name,
    score,
    compounds_found,
    compounds,
    updated_at
  from chem_rankings
  order by score desc, compounds_found desc, updated_at asc
  limit p_limit;
$$;


-- ── 3-6. 내 주변 순위 조회 ──
create or replace function get_neighbors(
  p_nickname text,
  p_window   int default 3
)
returns table (
  rank            int,
  nickname        text,
  school_name     text,
  region_name     text,
  score           int,
  compounds_found int,
  is_me           boolean,
  my_rank         int,
  total           int
)
language sql stable security definer
as $$
  with ranked as (
    select
      row_number() over (
        order by r.score desc, r.compounds_found desc, r.updated_at asc
      )::int as rk,
      r.nickname,
      r.school_name,
      r.region_name,
      r.score,
      r.compounds_found
    from chem_rankings r
  ),
  me as (
    select rk from ranked where nickname = btrim(p_nickname) limit 1
  ),
  cnt as (
    select count(*)::int as total from ranked
  )
  select
    ranked.rk         as rank,
    ranked.nickname,
    ranked.school_name,
    ranked.region_name,
    ranked.score,
    ranked.compounds_found,
    (ranked.nickname = btrim(p_nickname)) as is_me,
    (select rk from me)                  as my_rank,
    (select total from cnt)              as total
  from ranked, me
  where ranked.rk between me.rk - p_window and me.rk + p_window
  order by ranked.rk;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. 권한 부여 (anon 키로 RPC 호출 가능)                    │
-- └─────────────────────────────────────────────────────────┘

grant execute on function nickname_exists(text)                    to anon, authenticated;
grant execute on function register_user(text, text, text, text, text, text) to anon, authenticated;
grant execute on function verify_user(text, text)                  to anon, authenticated;
grant execute on function submit_score(text, text, int, int, jsonb) to anon, authenticated;
grant execute on function get_top_ranking(int)                     to anon, authenticated;
grant execute on function get_neighbors(text, int)                 to anon, authenticated;
