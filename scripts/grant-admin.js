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

  const usersEndpoint = `${base.replace(/\/$/, '')}/auth/v1/admin/users?per_page=1000`;
  const usersRes = await fetch(usersEndpoint, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
  if (!usersRes.ok) {
    console.error('Error al listar usuarios:', usersRes.status, await usersRes.text());
    process.exit(3);
  }
  const usersBody = await usersRes.json();
  const users = Array.isArray(usersBody) ? usersBody : usersBody.users ?? usersBody.data ?? [];

  let user;
  if (arg) {
    const maybeId = arg;
    if (/^[0-9a-fA-F-]{8,}$/.test(maybeId)) user = users.find((u) => u.id === maybeId);
    if (!user) user = users.find((u) => (u.email ?? '').toLowerCase() === arg.toLowerCase());
    if (!user) {
      console.error('Usuario no encontrado. Pasa como argumento id o email.');
      console.log('Usuarios disponibles:');
      for (const u of users) console.log(u.id, u.email);
      process.exit(4);
    }
  } else {
    if (users.length === 1) user = users[0];
    else {
      console.error('Hay más de un usuario remoto, pasa id o email como argumento.');
      for (const u of users) console.log(u.id, u.email);
      process.exit(5);
    }
  }

  const userId = user.id;
  console.log(`Asignando rol 'admin' al usuario ${user.email} (${userId})`);

  const endpoint = `${base.replace(/\/$/, '')}/rest/v1/user_roles`;
  const payload = { user_id: userId, role: 'admin', granted_by: null };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation, resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Error al crear/actualizar role:', res.status, res.statusText, text);
    process.exit(6);
  }
  try {
    const created = JSON.parse(text);
    console.log('Operación completada:', JSON.stringify(created, null, 2));
  } catch (e) {
    console.log('Operación completada:', text);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
