-- ============================================================
-- withdraw_lot(season) — take the live lot off the block WITHOUT a verdict.
-- Run once in the Supabase SQL Editor.
--
-- pass_lot() records the player as UNSOLD, which is a result: it belongs in
-- the auction record and reads as "nobody wanted him". Deferring a player to
-- sell later is a different thing entirely — the auctioneer simply isn't
-- taking him now. This returns the lot to idle and leaves the player exactly
-- as he was, free to be put up again.
--
-- Still logged, like every other lot action, so the audit trail shows why a
-- player left the block.
-- ============================================================

-- 'withdraw' is a new event kind; widen the constraint before inserting one.
alter table auction_event drop constraint if exists auction_event_kind_check;
alter table auction_event add constraint auction_event_kind_check
  check (kind in ('put_up', 'raise', 'sell', 'unsold', 'undo', 'withdraw'));

create or replace function withdraw_lot(p_season uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot auction_lot%rowtype;
begin
  select * into v_lot from auction_lot where season_id = p_season for update;
  if not found or v_lot.status <> 'live' then
    raise exception 'No lot is live';
  end if;

  insert into auction_event (season_id, player_id, kind)
  values (p_season, v_lot.player_id, 'withdraw');

  -- Back to idle and fully cleared. Deliberately NOT 'unsold': the player has
  -- no verdict recorded against him and can be put up again at any time.
  update auction_lot
     set status          = 'idle',
         player_id       = null,
         base_price      = null,
         current_bid     = null,
         leading_team_id = null,
         updated_at      = now()
   where season_id = p_season;
end;
$$;

revoke all on function withdraw_lot(uuid) from public;
grant execute on function withdraw_lot(uuid) to authenticated;
