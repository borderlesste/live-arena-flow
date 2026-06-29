import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { selectSupabasePublicKey } from "../server/modules/auth/supabase-key.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = selectSupabasePublicKey();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("QA_CONFIG_MISSING: Supabase URL, publishable key and service role key are required");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sessionClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = randomUUID();
const email = `qa.persistence.${runId}@example.invalid`;
const password = `Qa-${randomUUID()}-9a!`;
const displayName = `QA Persist ${runId.slice(0, 8)}`;
const externalMatchId = `qa-match-${runId}`;
const chatBody = `QA persistence ${runId}`;
let userId: string | undefined;
let otherUserId: string | undefined;
let qaError: unknown;
let cleanupError: unknown;

function pass(boundary: string, detail: string) {
  console.log(JSON.stringify({ boundary, status: "pass", detail }));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError) throw createError;
  userId = created.user.id;
  pass("auth.users", "temporary confirmed user created");

  const { data: otherCreated, error: otherCreateError } = await admin.auth.admin.createUser({
    email: `qa.persistence.other.${runId}@example.invalid`,
    password: `Qa-${randomUUID()}-9a!`,
    email_confirm: true,
    user_metadata: { display_name: `${displayName} Other` },
  });
  if (otherCreateError) throw otherCreateError;
  otherUserId = otherCreated.user.id;

  const { data: signedIn, error: signInError } = await sessionClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  assert(signedIn.session?.user.id === userId, "AUTH_SESSION_NOT_CREATED");
  pass("auth.session", "authenticated session issued");

  const { error: profileUpdateError } = await sessionClient
    .from("profiles")
    .update({ display_name: `${displayName} updated`, preferences: { matchReminders: true } })
    .eq("id", userId);
  if (profileUpdateError) throw profileUpdateError;

  const { data: profile, error: profileReadError } = await admin
    .from("profiles")
    .select("display_name,preferences")
    .eq("id", userId)
    .single();
  if (profileReadError) throw profileReadError;
  assert(profile.display_name === `${displayName} updated`, "PROFILE_NAME_NOT_PERSISTED");
  assert(profile.preferences?.matchReminders === true, "PROFILE_PREFERENCES_NOT_PERSISTED");
  pass("public.profiles", "display name and preferences persisted and read back");

  const { data: roles, error: rolesError } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (rolesError) throw rolesError;
  assert(roles?.some((entry) => entry.role === "user"), "DEFAULT_USER_ROLE_NOT_PERSISTED");
  const { count: profileCount, error: profileCountError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("id", userId);
  if (profileCountError) throw profileCountError;
  assert(profileCount === 1, "DUPLICATE_PROFILE_CREATED");
  pass("public.user_roles", "default user role persisted");

  const { error: roleEscalationError } = await sessionClient
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });
  assert(roleEscalationError, "ROLE_ESCALATION_NOT_BLOCKED");
  pass("rls.user_roles", "authenticated user cannot grant admin role");

  const { error: favoriteWriteError } = await sessionClient.from("user_favorite_matches").upsert({
    user_id: userId,
    external_match_id: externalMatchId,
  }, { onConflict: "user_id,external_match_id" });
  if (favoriteWriteError) throw favoriteWriteError;
  const { data: favorite, error: favoriteReadError } = await admin
    .from("user_favorite_matches")
    .select("external_match_id,created_at")
    .eq("user_id", userId)
    .eq("external_match_id", externalMatchId)
    .single();
  if (favoriteReadError) throw favoriteReadError;
  assert(favorite.external_match_id === externalMatchId && favorite.created_at, "FAVORITE_NOT_PERSISTED");
  pass("public.user_favorite_matches", "followed match persisted and read back");

  const { error: otherFavoriteError } = await sessionClient.from("user_favorite_matches").upsert({
    user_id: otherUserId,
    external_match_id: `${externalMatchId}-other-user`,
  }, { onConflict: "user_id,external_match_id" });
  assert(otherFavoriteError, "FAVORITE_IMPERSONATION_NOT_BLOCKED");
  pass("rls.user_favorite_matches", "authenticated user cannot follow on behalf of another user");

  const { data: sentMessage, error: chatWriteError } = await sessionClient.rpc("send_chat_message", {
    p_room_key: "global",
    p_body: chatBody,
    p_channel: "community",
  });
  if (chatWriteError) throw chatWriteError;
  const messageId = sentMessage?.id as string | undefined;
  assert(messageId, "CHAT_RPC_DID_NOT_RETURN_MESSAGE");
  const { data: chat, error: chatReadError } = await admin
    .from("chat_messages")
    .select("id,user_id,body,channel,created_at")
    .eq("id", messageId)
    .single();
  if (chatReadError) throw chatReadError;
  assert(chat.user_id === userId && chat.body === chatBody && chat.channel === "community", "CHAT_NOT_PERSISTED");
  pass("public.chat_messages", "authenticated chat message persisted and read back");

  const { error: officialChatError } = await sessionClient.rpc("send_chat_message", {
    p_room_key: "global",
    p_body: `QA official channel escalation ${runId}`,
    p_channel: "official",
  });
  assert(officialChatError, "OFFICIAL_CHANNEL_NOT_BLOCKED_FOR_USER");
  pass("rpc.send_chat_message", "regular user cannot publish official chat messages");

  const { data: ownFavorites, error: ownFavoritesError } = await sessionClient
    .from("user_favorite_matches")
    .select("external_match_id")
    .eq("user_id", userId);
  if (ownFavoritesError) throw ownFavoritesError;
  assert(ownFavorites?.some((entry) => entry.external_match_id === externalMatchId), "RLS_SELF_READ_FAILED");
  pass("rls", "authenticated user can read own persisted data");
} catch (error) {
  qaError = error;
} finally {
  await sessionClient.auth.signOut().catch(() => undefined);
  if (userId) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) cleanupError = deleteError;
    else {
      const checks = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("id", userId),
        admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
        admin.from("user_favorite_matches").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
        admin.from("chat_messages").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      if (!checks.every((result) => !result.error && result.count === 0)) cleanupError = new Error("QA_CLEANUP_CASCADE_FAILED");
      else pass("cleanup", "temporary auth and application rows removed by cascade");
    }
  }
  if (otherUserId) {
    const { error: otherDeleteError } = await admin.auth.admin.deleteUser(otherUserId);
    if (otherDeleteError && !cleanupError) cleanupError = otherDeleteError;
  }
}

if (qaError) throw qaError;
if (cleanupError) throw cleanupError;
