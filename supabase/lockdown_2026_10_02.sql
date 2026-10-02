-- USCL soft launch lockdown (2026-10-02). Fourteen franchise owners now have
-- logins, so "any signed-in user may write" is no longer safe.
--
-- 1. scout_players (the live pool + every sale): owners READ, only admins WRITE.
--    Sales, undo, RTM and the pad all go through the server with the service
--    role, which is unaffected.
drop policy if exists "scout_players_write" on scout_players;
create policy "scout_players_write" on scout_players for all
  using (is_admin()) with check (is_admin());

-- 2. Live-lot functions run as SECURITY DEFINER with no role check inside, so
--    they must not be callable from the browser. The app calls them only from
--    server actions with the service-role key.
do $$
declare f text;
begin
  foreach f in array array[
    'put_up_lot(uuid, uuid)',
    'place_raise(uuid, uuid, numeric)',
    'hammer_lot(uuid)',
    'pass_lot(uuid)',
    'undo_last_sale(uuid)',
    'withdraw_lot(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;
