select category, count(*), sum(amount)
from expenses
group by category;

select school_year_label, school_year_start_month, school_year_end_month
from schools;
