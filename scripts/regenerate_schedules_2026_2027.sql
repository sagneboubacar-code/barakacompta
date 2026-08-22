-- À exécuter APRÈS avoir configuré les tarifs 2026-2027 dans "Gestion des
-- tarifs". Régénère l'échéancier (payment_schedules) de tous les élèves pour
-- l'année scolaire active de leur école respective (school_year_label).
-- Idempotent (ON CONFLICT DO NOTHING dans generate_student_schedule) : ne
-- duplique rien si rejoué plusieurs fois.
do $$
declare
  v_student_id uuid;
begin
  for v_student_id in select id from public.students loop
    perform public.generate_student_schedule(v_student_id, null);
  end loop;
end;
$$;
