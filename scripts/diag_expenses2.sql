select school_year_label, school_year_start_month, school_year_end_month
from schools;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.expenses'::regclass and contype = 'c';

select category, count(*), pg_typeof(category)
from expenses
group by category;
