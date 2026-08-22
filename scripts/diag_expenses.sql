-- Diagnostic : pourquoi "Dépenses de l'année" affiche 0 malgré une dépense du 09/08/2026.
select school_year_label, school_year_start_month, school_year_end_month
from schools;

select id, expense_date, category, amount, created_at
from expenses
order by created_at desc
limit 5;
