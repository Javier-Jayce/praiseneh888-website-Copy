PRAISENEH888 ADMIN FIX — November 2026

Replace only these files in the ROOT of your GitHub/Vercel website:
  admin.html
  admin.js

Add this NEW file to the same root:
  admin-fixes.css

Keep these existing files as they are:
  index.html
  app.js
  supabase.js
  styles.css

Then commit your changes and let Vercel deploy.
Open /admin.html and hard-refresh (Ctrl+Shift+R).

WHAT CHANGED
- Description box has no initial indentation/blank lines.
- When editing, leading/trailing whitespace is trimmed; when saving, it is trimmed.
- Existing pieces show 10 per page, with Previous/Next buttons.
- Search by name/master/category/description, filter by availability.
- One photo preview container (the earlier code could create a duplicate).
- Existing database and existing photos are preserved on edit.

SECURITY
Login does not imply administrator authorization. Supabase RLS and Storage policies
must restrict writing/deleting to the authorized admin; do not put secret keys in JS.

KNOWN LIMITATION
This package does not change Supabase policies or repair server-side upload permission errors.
