CREATE TABLE reservations (
  id uuid PRIMARY KEY,
  resource_id text NOT NULL,
  request_id text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX one_active_reservation_per_resource
  ON reservations(resource_id) WHERE active;

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  request_id text NOT NULL,
  payload jsonb NOT NULL
);
