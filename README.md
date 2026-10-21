# Minbar Mosque Screen

Multi-tenant mosque prayer-time administration and public display built with Next.js, Prisma, and MongoDB.

## Requirements

- Node.js 20 or newer and npm
- MongoDB Atlas, or a MongoDB replica set for local development

The application uses Prisma transactions for account provisioning and atomic timetable imports. MongoDB transactions require a replica set; a standalone MongoDB server is not sufficient.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your MongoDB connection string. For Atlas, use the connection string from your cluster and include a database name, for example `mosque_screen`. URL-encode reserved characters in the database username or password.

3. Set `AUTH_SECRET` to a long, random secret. Set `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, and `SUPER_ADMIN_PASSWORD`; the seed script requires a password of at least 12 characters.

4. To email a newly created mosque administrator their screen link, set `APP_URL` to the public site origin and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Keep SMTP credentials only in `.env`. Without SMTP settings, mosque creation still succeeds and the super administrator can copy the generated link from the confirmation dialog.

5. Validate the Prisma schema, generate the client, and apply the schema to your MongoDB database:

   ```bash
   npx prisma validate
   npx prisma generate
   npm run db:push
   ```

6. Create or update the super-administrator account:

   ```bash
   npm run db:seed
   ```

7. Start the development server:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000/login`. The super administrator can create mosque-admin accounts from `/admin`. Mosque administrators manage their mosque at `/dashboard`. Each public display has one unique ID-based link at `/screen/<tenant-id>`; the app emails this link to the mosque administrator when the account is created.

## Database Notes

- Prisma uses MongoDB with CUID string IDs mapped to MongoDB `_id` fields.
- Relations are managed by Prisma (`relationMode = "prisma"`); database writes should go through Prisma so relation behavior is applied consistently.
- MongoDB `db push` creates the schema indexes. Use a dedicated database when first applying this schema.
- Do not commit `.env` or real database credentials. If a credential has been exposed, rotate it in the database provider and update the local environment.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```