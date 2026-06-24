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
  const [roleArg, identifier] = process.argv.slice(2);
  if (!roleArg) {
    console.error('Uso: node scripts/revoke-role.js <role> [user-id|email]');
    process.exit(2);
  }
  const envText = await fs.readFile('.env', 'utf8').catch(() => '');
  const env = parseEnv(envText);
  const base = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!base || !key) {
    console.error('No se encontró SUPABASE URL o SERVICE_ROLE_KEY en .env');
    process.exit(3);
  }

  const usersEndpoint = `${base.replace(/\/$/, '')}/auth/v1/admin/users?per_page=1000`;
  const usersRes = await fetch(usersEndpoint, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
  if (!usersRes.ok) {
    console.error('Error al listar usuarios:', usersRes.status, await usersRes.text());
    process.exit(4);
  }
  const usersBody = await usersRes.json();
  const users = Array.isArray(usersBody) ? usersBody : usersBody.users ?? usersBody.data ?? [];

  let user;
  if (identifier) {
    if (/^[0-9a-fA-F-]{8,}$/.test(identifier)) user = users.find((u) => u.id === identifier);
    if (!user) user = users.find((u) => (u.email ?? '').toLowerCase() === identifier.toLowerCase());
    if (!user) {
      console.error('Usuario no encontrado. Pasa como argumento id o email.');
      console.log('Usuarios disponibles:');
      for (const u of users) console.log(u.id, u.email);
      process.exit(5);
    }
  } else {
    if (users.length === 1) user = users[0];
    else {
      console.error('Hay más de un usuario remoto, pasa id o email como argumento.');
      for (const u of users) console.log(u.id, u.email);
      process.exit(6);
    }
  }

  const userId = user.id;
  console.log(`Revocando rol '${roleArg}' del usuario ${user.email} (${userId})`);

  const endpoint = `${base.replace(/\/$/, '')}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.${roleArg}`;
  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      Prefer: 'return=representation',
    },
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Error al revocar role:', res.status, res.statusText, text);
    process.exit(7);
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length === 0) console.log('No se encontró la entrada a borrar (ya estaba revocado).');
    else console.log('Revocado:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('Respuesta:', text);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
