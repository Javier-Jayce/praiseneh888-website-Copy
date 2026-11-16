# Praiseneh888 catalogue website

A lightweight, responsive public amulet catalogue with a Supabase-powered private admin dashboard. It has no cart, checkout, online payment or customer accounts. Enquiries go to the Praiseneh888 Facebook page.

## 1. Connect Supabase
1. Open your Singapore Supabase project.
2. Go to **SQL Editor** → **New query**.
3. Paste all of `database.sql` and click **Run**.
4. Go to **Project Settings** → **API** (or **Data API / API Keys**, depending on dashboard version).
5. Copy the **Project URL** and the **anon / publishable public key**. Never use or expose the `service_role` / secret key.
6. Open `supabase.js` and replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY`.

## 2. Create your private admin login
1. In Supabase, open **Authentication** → **Users**.
2. Click **Add user** and create your own email/password.
3. Keep public sign-ups disabled. Only users you add in the dashboard should be able to sign in.
4. Open `/admin.html` after deployment to manage listings.

The SQL policies let anyone read published catalogue rows, while only signed-in users can add, edit or delete rows and upload photos. For a single-owner site, only create your own Auth user. Do not share the admin password.

## 3. Test locally
This is a static site using browser ES modules. Run a local web server from this folder, for example:
- `python -m http.server 8000`
- Visit `http://localhost:8000`

Opening `index.html` directly as a file may block module imports; use a local web server.

## 4. Deploy to Vercel
1. Put the contents of this folder in a GitHub repository.
2. In Vercel, choose **Add New → Project**, import that repository.
3. Framework preset: **Other**. Build command: leave blank. Output directory: `.` (project root).
4. Deploy. Vercel will provide a public URL.
5. Test the public catalogue and `/admin.html`.

## 5. Manage catalogue
- Add or edit the name, master, category, description and availability.
- Price display can be **Show price (SGD)** or **PM FOR PRICE**.
- Upload multiple photos per listing.
- Mark pieces as Available, Reserved or Past collection.
- Customers can browse/search/filter and send enquiries via Facebook.

## Notes
- No online payment, shopping cart, WhatsApp integration or customer accounts.
- The website's Supabase URL and anon/public key are designed to be visible in browser code. Database security is enforced by Row Level Security. Never paste the service role key into this project.
- The admin dashboard currently allows any authenticated Supabase user to manage records. Keep public sign-ups disabled and create only trusted admin users.
