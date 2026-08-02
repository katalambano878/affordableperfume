#!/usr/bin/env bash
set -eu
PW=$(sudo docker exec fleet-postgres printenv POSTGRES_PASSWORD)
APP_USER=$(sudo docker exec "$(sudo docker ps -q --filter name=slrbujar | head -1)" \
  printenv DATABASE_URL | sed -n 's#.*://\([^:]*\):.*#\1#p')
echo "App DB user: ${APP_USER:-unknown}"

MIG_DIR=/tmp/sql-migrations
sudo docker exec -e PGPASSWORD="$PW" fleet-postgres \
  psql -U postgres -d affordableperfume -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

for f in 000_schema_migrations.sql 001_contact_submissions.sql 002_payment_attempts.sql \
         003_payment_callback_events.sql 004_orders_integrity.sql 005_supporting_indexes.sql; do
  id="${f%.sql}"
  exists=$(sudo docker exec -e PGPASSWORD="$PW" fleet-postgres \
    psql -U postgres -d affordableperfume -t -A \
    -c "SELECT 1 FROM public.schema_migrations WHERE id='${id}' LIMIT 1;" || true)
  if [ "$exists" = "1" ]; then
    echo "SKIP $id"
    continue
  fi
  echo "APPLY $id"
  sudo docker exec -i -e PGPASSWORD="$PW" fleet-postgres \
    psql -U postgres -d affordableperfume -v ON_ERROR_STOP=1 < "$MIG_DIR/$f"
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres \
    psql -U postgres -d affordableperfume -v ON_ERROR_STOP=1 \
    -c "INSERT INTO public.schema_migrations (id) VALUES ('${id}') ON CONFLICT DO NOTHING;"
  echo "OK $id"
done

if [ -n "${APP_USER:-}" ] && [ "$APP_USER" != "postgres" ]; then
  echo "GRANT to $APP_USER"
  sudo docker exec -e PGPASSWORD="$PW" fleet-postgres \
    psql -U postgres -d affordableperfume -v ON_ERROR_STOP=1 -c "
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_submissions TO \"${APP_USER}\";
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_attempts TO \"${APP_USER}\";
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_callback_events TO \"${APP_USER}\";
      GRANT SELECT, INSERT ON public.schema_migrations TO \"${APP_USER}\";
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO \"${APP_USER}\";
    " || echo "GRANT note: may already have privileges via PUBLIC/role"
fi

echo "=== applied ==="
sudo docker exec -e PGPASSWORD="$PW" fleet-postgres \
  psql -U postgres -d affordableperfume -c "SELECT id, applied_at FROM public.schema_migrations ORDER BY applied_at;"
sudo docker exec -e PGPASSWORD="$PW" fleet-postgres \
  psql -U postgres -d affordableperfume -c "
    SELECT to_regclass('public.contact_submissions') AS contact,
           to_regclass('public.payment_attempts') AS attempts,
           to_regclass('public.payment_callback_events') AS callbacks;"
