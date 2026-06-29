import fs from 'fs/promises';

async function main() {
  const envText = await fs.readFile('.env', 'utf8').catch(() => '');
  const env = Object.fromEntries(
    envText
      .split(/\r?\n/)
      .map((l) => l.match(/^([^=\s]+)=(.*)$/s))
      .filter(Boolean)
      .map((m) => [m[1].trim(), m[2].trim()])
  );

  const base = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    console.error('No se encontró SUPABASE URL o SERVICE_ROLE_KEY en .env');
    process.exit(2);
  }

  const endpoint = `${base.replace(/\/$/, '')}/auth/v1/admin/users?per_page=1000`;
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
  const text = await res.text();
  if (!res.ok) {
    console.error('Error al consultar Supabase:', res.status, res.statusText, text);
    process.exit(3);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    console.error('Respuesta no JSON:', text);
    process.exit(4);
  }

  let users = [];
  if (Array.isArray(body)) users = body;
  else if (body && Array.isArray(body.users)) users = body.users;
  else if (body && Array.isArray(body.data)) users = body.data;
  else {
    console.error('Respuesta inesperada:', body);
    process.exit(5);
  }

  // Print count and selected fields for each user
  console.log(`TOTAL_USERS:${users.length}`);
  for (const u of users) {
    const id = u.id ?? u.user_id ?? '';
    const email = u.email ?? '';
    const created_at = u.created_at ?? '';
    const last_sign_in_at = u.last_sign_in_at ?? u.last_sign_in_at ?? '';
    console.log(JSON.stringify({ id, email, created_at, last_sign_in_at }));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
