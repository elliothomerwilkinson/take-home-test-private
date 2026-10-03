CREATE TABLE ingested_forms (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	application_reference text NOT NULL UNIQUE,
	session_id text,
	raw_body jsonb NOT NULL,
	status text NOT NULL CHECK (status IN ('received', 'invalid', 'failed', 'transformed')),
	error jsonb,
	attempts int NOT NULL DEFAULT 1,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transformed_forms (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	ingested_form_id uuid NOT NULL UNIQUE REFERENCES ingested_forms (id),
	session_id text NOT NULL,
	application_reference text NOT NULL UNIQUE,
	first_name text NOT NULL,
	last_name text NOT NULL,
	email text NOT NULL,
	gender text NOT NULL CHECK (gender IN ('male', 'female', 'prefer-not-to-say')),
	date_of_birth date NOT NULL,
	phone_number text,
	mobile_number text NOT NULL,
	address_line_1 text NOT NULL,
	address_line_2 text NOT NULL,
	address_line_3 text,
	postcode text NOT NULL,
	country text NOT NULL,
	longitude double precision NOT NULL,
	latitude double precision NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transformed_notifications (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	transformed_form_id uuid NOT NULL UNIQUE REFERENCES transformed_forms (id),
	status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
	attempts int NOT NULL DEFAULT 0,
	error jsonb,
	sent_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);
