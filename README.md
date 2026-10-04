# take-home-test

At Healthtech-1, one of our core responsibilities is to ingest registration forms, transform them, update some external systems and get them ready for future processing (by the FORM-BOT).
We are sent these forms by a particularly unreliable 3rd party - we should expect them to make schema changes without informing us, send duplicate forms, or generally just be badly behaved!
As this is important healthcare data, we need to design our systems to be resilient to these kinds of errors.

Your task is to code a system for ingesting and processing these forms. For a form to become ready for our bots, it will need to:
- Be ingested into a database (via an `/ingest` endpoint). 
- Conform to the schema we've currently agreed with the external provider. This schema is found in `ingested_schema.ts` (but unfortunately the data source isn't 100% reliable and schema changes aren't always communicated in a timely fashion!)
- Have a longitude and latitude so that we have specific address information for the FORM-BOT. A mock implementation of a geocoding API (to transform the postcode into lat/long) is provided.
- Be transformed into the schema found in `transformed_schema.ts`.

In addition to this, if the transformation/another step is unsuccessful, we'd ideally like to be able to capture the error/data, ship a code change and then handle this form once that change has been deployed (e.g some kind of `/retry` endpoint)

Some additional notes on the system
- The third party external provider does not guarantee exactly once delivery
- We should never give the FORM-BOT the same form twice
- If the transform is successful, we should send a guaranteed email to our team happyforms@bots.com that a form was ingested

Some notes on this take home
- We expect you to add some basic tests to your code
- We expect you to use an actual database, as we'd like to see your schema design
- You can use AI to aid you in this task but please do not just ask Claude to do the whole thing for you
- You are free to pick another server technology (e.g. NestJS) if you wish and even pick another language though please check with us first on language.

How to submit
- The email sent to you has a unique submission link, which will take you to a submission portal
- Please submit on the portal: a link to your repository and a link to a 5 minute (max) loom which explains your code and some of your design decisions
- If possible, please submit within 4-5 days of receiving the task

## Running

```bash
npm install
npm test          # unit + integration tests (in-memory PGlite, stubbed geocoder)
npm run dev       # dev server on :3000
npm run build && npm start
```

## Design

- [`CONTEXT.md`](CONTEXT.md): domain terms, rules, lossy mappings and known limitations
- [`docs/adr/`](docs/adr): database choice, why raw forms are stored separately, the deduplication key, and how the team email is sent
- `POST /ingest` responses:
  - `201 { id }` when the form is transformed. A Transformed Notification to happyforms@bots.com is recorded in the same transaction and sent in the background, with up to 3 attempts. Its outcome (`sent` or `failed`) is stored and never changes the response. See ADR-0004.
  - `400` for invalid JSON, a missing `application_reference`, or a form that fails validation (it is stored as `invalid`)
  - `409` for a duplicate or a form still being processed
  - `503` when geocoding fails after 3 attempts (the form is stored as `failed`, and resending it reprocesses it)


## Notes for Review / Design Choices

#### application_reference as the unique key. 
Without more details it is unclear what session_id and application_reference mean. I made the assumption that session_id refers to the users session whereas the application_reference refers to a unique application for a single patient. Therefore, I assumed session_id could be one to many with application_reference e.g. if a GP was completing 5 applications on behalf of their patients. 

#### I did not implement /retry. 
I was unclear on that being needed, or if we were just to build a system that can easily be extended to support that concept. I opted for the latter. Since we store the raw ingested request, ingestion statuses and errors we have all the data required to trigger retries. The complexity from retry comes from a lack of requirements, but an implementation would be easy for most options, for example:
- Endpoint /:id/retry - enable retrying a single form
- /retry - enable retrying all failed forms

#### Emails are not gaurenteed without the /retry endpoint. 
The mock email service fails 5% of the time, it performs 3 retries so we expect a failure rate of 1/8000. The /retry endpoint could capture retrying emails to solve this. 

#### Other
- A typicaly code architecture I would follow would be Controller -> Service -> Repository, with an optional extra service layer depending on system size. I have not added this here since we only have a single endpoint.
- Typically I would use an ORM to manage the DB schemas, migrations and queries. I've kept it as raw SQL for now, but would make that change asap if this were a real application.
- Other missing elements that would be essential to productionise this: authentication, openAPI spec, observability, auto scaling