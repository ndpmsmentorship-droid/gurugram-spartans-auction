-- Manual position-slot tag for building the real auction squad.
-- Values used today: 'bowler', 'middle_order' (null = unassigned).
alter table scout_players add column if not exists squad_slot text;
