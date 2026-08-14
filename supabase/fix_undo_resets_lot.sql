-- Fix: undo_last_sale reversed the player row but left auction_lot at status
-- 'sold', so the reversed player kept showing on the live board (e.g. "Vikas"
-- stayed on the block after the sale was cancelled). Now the undo also clears
-- the lot back to idle when the board is still showing that sold player.
-- Run in the Supabase SQL editor (DDL can't go through PostgREST).

create or replace function undo_last_sale(p_season uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev auction_event%rowtype;
begin
  select * into v_ev
    from auction_event
   where season_id = p_season and kind = 'sell'
   order by id desc limit 1;

  if not found then
    raise exception 'No sale to undo';
  end if;

  if exists (select 1 from auction_event
              where season_id = p_season and kind = 'undo' and player_id = v_ev.player_id
                and id > v_ev.id) then
    raise exception 'That sale has already been undone';
  end if;

  update scout_players
     set team_id = null, sold_price = null, acquired = null
   where id = v_ev.player_id;

  -- NEW: clear the lot if it's still showing this now-reversed sale.
  update auction_lot
     set player_id = null, status = 'idle', base_price = null,
         current_bid = null, leading_team_id = null, updated_at = now()
   where season_id = p_season and player_id = v_ev.player_id;

  insert into auction_event (season_id, player_id, team_id, kind, amount)
  values (p_season, v_ev.player_id, v_ev.team_id, 'undo', v_ev.amount);
end;
$$;
