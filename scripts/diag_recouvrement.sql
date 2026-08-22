select due_date, status, amount_remaining, student_id
from payment_schedules
where status <> 'cancelled'
  and amount_remaining > 0
order by due_date desc
limit 20;
