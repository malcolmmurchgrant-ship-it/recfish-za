-- renumber_competition_days(competition_id)
-- SADSAA convention: Day 1 is the first day actually fished. Days that were
-- cancelled (weather, rest day) carry no fishing-day number of their own.
-- This renumbers a competition's days so the fishing days are 1, 2, 3...
-- in date order, with any cancelled days numbered after the last fishing day
-- (the app labels those "Cancelled", never by number).
-- Everything else that stores a day number is moved with it, so nothing
-- comes apart: boat times (competition_fishing_sessions.day_number) and
-- day-specific prize categories (competitions.report_settings).
-- Catches and boat draws link to a day by its id, which never changes.
-- Safe to run any number of times.
create or replace function public.renumber_competition_days(p_competition_id uuid)
returns table(day_id uuid, day_date date, is_cancelled boolean, old_day_number int, new_day_number int)
language plpgsql
as $$
declare
  m jsonb;
begin
  select coalesce(jsonb_object_agg(x.day_number::text, x.new_n), '{}'::jsonb) into m
  from (
    select d.day_number,
           row_number() over (order by coalesce(d.cancelled, false), d.date, d.day_number) as new_n
    from competition_days d
    where d.competition_id = p_competition_id
  ) x;

  -- Two steps (park high, then set) so the unique day number per
  -- competition is never broken part-way through.
  update competition_days set day_number = day_number + 1000
   where competition_id = p_competition_id;
  update competition_days d set day_number = (m ->> (d.day_number - 1000)::text)::int
   where d.competition_id = p_competition_id;

  update competition_fishing_sessions set day_number = day_number + 1000
   where competition_id = p_competition_id;
  update competition_fishing_sessions s
     set day_number = coalesce((m ->> (s.day_number - 1000)::text)::int, s.day_number - 1000)
   where s.competition_id = p_competition_id and s.day_number > 1000;

  update competitions c
     set report_settings = jsonb_set(c.report_settings, '{prize_categories}', (
       select coalesce(jsonb_agg(
                case when t.e ->> 'day_number' is not null and m ? (t.e ->> 'day_number')
                     then jsonb_set(t.e, '{day_number}', to_jsonb((m ->> (t.e ->> 'day_number'))::int))
                     else t.e end
                order by t.ord), '[]'::jsonb)
       from jsonb_array_elements(c.report_settings -> 'prize_categories') with ordinality as t(e, ord)))
   where c.id = p_competition_id
     and jsonb_typeof(c.report_settings -> 'prize_categories') = 'array';

  return query
    select d.id, d.date, coalesce(d.cancelled, false),
           (select (k)::int from jsonb_each_text(m) as j(k, v) where (j.v)::int = d.day_number limit 1),
           d.day_number
    from competition_days d
    where d.competition_id = p_competition_id
    order by d.day_number;
end;
$$;

grant execute on function public.renumber_competition_days(uuid) to authenticated;
