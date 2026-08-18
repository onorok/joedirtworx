# Joe Dirt Worx

Website for Joe Dirt Worx — land clearing and dirt work out of Russellville, AR.

## Public site

- Home: `/`
- Our work / View more projects: `/work`

Project photos are stored in the `joedirtworx` S3 bucket. Anyone can view them. Only an admin can add or remove them.

## Admin

Sign in at `/admin` (not linked from the public site). Use the `ADMIN_PASSWORD` config var.

Uploads go to `s3://joedirtworx/projects/`. Quote requests are emailed to the contact address.

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

That starts the Express server on http://localhost:3000 and reloads when server files change.
