import fs from 'fs/promises';

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((l) => l.match(/^([^=\s]+)=(.*)$/s))
      .filter(Boolean)
      .map((m) => [m[1].trim(), m[2].trim()])
  );
}

async function main() {
  const arg = process.argv[2];
  const envText = await fs.readFile('.env', 'utf8').catch(() => '');
  const env = parseEnv(envText);
  const base = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!base || !key) {
    console.error('No se encontró SUPABASE URL o SERVICE_ROLE_KEY en .env');
    process.exit(2);
  }
  if (!arg) {
    console.error('Pasa el id del usuario como argumento');
    process.exit(3);
  }
  const endpoint = `${base.replace(/\/$/, '')}/rest/v1/user_roles?user_id=eq.${arg}`;
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
  const text = await res.text();
  if (!res.ok) {
    console.error('Error al consultar user_roles:', res.status, res.statusText, text);
    process.exit(4);
  }
  try {
    const data = JSON.parse(text);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log(text);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
