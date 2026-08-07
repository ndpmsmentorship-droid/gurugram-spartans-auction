-- SCCL Season 6 — teams + owners migration & seed. Run once in the Supabase SQL editor.
-- Idempotent. Does NOT touch players/retentions (waiting on the organizers' final list).

begin;

-- 1) Rename the active season
update seasons set name = 'SARDA Corporate Cricket League — Season 6' where is_active = true;

-- 2) Extend teams: division + purse ceiling
alter table teams add column if not exists division text;
alter table teams add column if not exists purse_max numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='teams_season_name_unique') then
    alter table teams add constraint teams_season_name_unique unique (season_id, name);
  end if; end $$;

-- 3) team_owners (multi-owner per team; NP = non-playing)
create table if not exists team_owners (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null, grade text, is_playing boolean not null default true,
  profile_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now());
alter table team_owners enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='team_owners' and policyname='team_owners_select') then
    create policy team_owners_select on team_owners for select using (auth.uid() is not null); end if;
  if not exists (select 1 from pg_policies where tablename='team_owners' and policyname='team_owners_write') then
    create policy team_owners_write on team_owners for all using (is_admin()) with check (is_admin()); end if;
end $$;

-- 4) Retention link on the live pool (scout_players); matched to players later
alter table scout_players add column if not exists retained_by_team_id uuid references teams(id) on delete set null;

-- 5) Remove mock teams (clear leftover test-data references first)
update auction_state
  set current_leading_team_id = null, current_bid_amount = null, current_player_id = null, status = 'not_started'
  where season_id = (select id from seasons where is_active limit 1);
delete from bids           where team_id in (select id from teams where is_mock = true);
delete from roster_entries where team_id in (select id from teams where is_mock = true);
delete from teams          where is_mock = true and season_id = (select id from seasons where is_active limit 1);

-- 6) Upsert the 24 real teams (purse 2L base, 3.5L max)
insert into teams (season_id, name, division, is_mock, purse_total, purse_remaining, purse_max)
select (select id from seasons where is_active limit 1), v.name, v.division, false, 200000, 200000, 350000
from (values
    ('Patna Panthers','Challengers'),
    ('Goa Monks','Elite'),
    ('Bengal Tigers','Elite'),
    ('Chennai Thalaiva','Challengers'),
    ('NCR Turbo Chargers','Challengers'),
    ('UP Warriors','Elite'),
    ('Japani Tsunami','Elite'),
    ('Uttarakhand Yoddhas','Challengers'),
    ('Gurugram Spartans','Elite'),
    ('ACCI','Elite'),
    ('Delhi Knights','Challengers'),
    ('Jaipur Royals','Elite'),
    ('TDI Phoenix Giants','Fighters'),
    ('Bangalore KS Blasters','Challengers'),
    ('London Legends','Challengers'),
    ('Mumbai Titans','Fighters'),
    ('Chandigarh Lions','Fighters'),
    ('Haryana Titans','Fighters'),
    ('JNK Homelenders','Fighters'),
    ('Srinagar Sultan','Fighters'),
    ('Punjab Royals','Elite'),
    ('Bharat Hunters','Challengers'),
    ('Texas Holdem','Fighters'),
    ('KEI India Warriors','Fighters')
) as v(name, division)
on conflict (season_id, name) do update set division=excluded.division, is_mock=false,
  purse_total=excluded.purse_total, purse_remaining=excluded.purse_remaining, purse_max=excluded.purse_max;

-- 7) Owners (re-seed for the active season)
delete from team_owners where team_id in (select id from teams where season_id=(select id from seasons where is_active limit 1));
insert into team_owners (team_id, name, grade, is_playing)
select t.id, v.oname, v.grade, v.playing
from (values
    ('Patna Panthers','Gaurav Sethi','B',true),
    ('Patna Panthers','Sajal Sharma','B',true),
    ('Patna Panthers','Anubhav “Manik”','A',true),
    ('Goa Monks','Sameer Bhalla','B',true),
    ('Goa Monks','Aditya Sharma','B',true),
    ('Goa Monks','Rahul Batra','B',true),
    ('Bengal Tigers','Dipak K Singh','B',true),
    ('Bengal Tigers','K Raj B','B',true),
    ('Bengal Tigers','Peeyush Sharma','Legend',true),
    ('Chennai Thalaiva','Vasanth','Legend',true),
    ('Chennai Thalaiva','M. Sathya Ram','B',true),
    ('Chennai Thalaiva','Adil','A',true),
    ('NCR Turbo Chargers','Sanjeev Ananthakrishnan','B',true),
    ('NCR Turbo Chargers','Nitin Ruhela','B',true),
    ('NCR Turbo Chargers','Arvind Kumar','NP',false),
    ('UP Warriors','Sandeep Kumar','B',true),
    ('UP Warriors','Bharat Sharma','B',true),
    ('UP Warriors','Mandeep Sangwan','A',true),
    ('Japani Tsunami','Shashank Verma','B',true),
    ('Japani Tsunami','Naitik Gupta','B',true),
    ('Japani Tsunami','Sanchit Tanwar','B',true),
    ('Uttarakhand Yoddhas','Anil Khatri','B',true),
    ('Uttarakhand Yoddhas','Rajeev Dagar','B',true),
    ('Uttarakhand Yoddhas','Dheeraj Pathak','A',true),
    ('Gurugram Spartans','Kanishk Sheel','Legend',true),
    ('Gurugram Spartans','Nikhil Dhingra','B',true),
    ('Gurugram Spartans','Vikas Grover','A',true),
    ('ACCI','Russell Stamets','Legend',true),
    ('ACCI','Vishal Salgotra','B',true),
    ('ACCI','Pradeep Mahlawat','A',true),
    ('Delhi Knights','Rajan Sharma','B',true),
    ('Delhi Knights','Ankit B.','B',true),
    ('Delhi Knights','Nitesh Lohchab','A',true),
    ('Jaipur Royals','Dharmendra Shekhawat','Legend',true),
    ('Jaipur Royals','Saurav Suneja','Legend',true),
    ('Jaipur Royals','Hemant Kumar','B',true),
    ('TDI Phoenix Giants','Jaspreet Singh Kapur','B',true),
    ('TDI Phoenix Giants','Karan Minocha','A',true),
    ('TDI Phoenix Giants','Jaikush Singh Hoon','B',true),
    ('Bangalore KS Blasters','Anubhav Malhotra','B',true),
    ('Bangalore KS Blasters','Ishneet Singh','B',true),
    ('London Legends','Vished','A',true),
    ('London Legends','Aman Sahni','B',true),
    ('London Legends','Devashish','B',true),
    ('Mumbai Titans','Ayush Soni','B',true),
    ('Mumbai Titans','Aneesh Gautam','Legend',true),
    ('Mumbai Titans','Aman Raj','A',true),
    ('Chandigarh Lions','Asheet Taneja','B',true),
    ('Chandigarh Lions','Gaganpreet Singh','B',true),
    ('Chandigarh Lions','Gurmeet Singh','A',true),
    ('Haryana Titans','Rahul Choudhary','Legend',true),
    ('Haryana Titans','Somnath Bhattacharyya','B',true),
    ('Haryana Titans','Atinderpal Singh','B',true),
    ('JNK Homelenders','Nitin Bakshi','B',true),
    ('JNK Homelenders','Saleem Khan','B',true),
    ('Srinagar Sultan','Parakh Kapoor','B',true),
    ('Srinagar Sultan','Nirav Sachdeva','A',true),
    ('Srinagar Sultan','Chetan Sharma','A',true),
    ('Punjab Royals','Tarun','Legend',true),
    ('Punjab Royals','Sunil Bansal','B',true),
    ('Punjab Royals','Ravinder Nandal','B',true),
    ('Punjab Royals','Anand Pathak','NP',false),
    ('Bharat Hunters','Manish Batra','Legend',true),
    ('Bharat Hunters','Gaurav Tamta','Legend',true),
    ('Bharat Hunters','Nitin Gandhi','NP',false),
    ('Bharat Hunters','Deepanshu Rustagi','NP',false),
    ('Texas Holdem','Paras Gupta','B',true),
    ('Texas Holdem','Himanshu Saxena','B',true),
    ('Texas Holdem','Kumar Gaurav','B',true),
    ('Texas Holdem','Harsh Gill','NP',false),
    ('KEI India Warriors','Akshit Diviaj Gupta','Legend',true)
) as v(tname, oname, grade, playing)
join teams t on t.season_id=(select id from seasons where is_active limit 1) and t.name=v.tname;

commit;