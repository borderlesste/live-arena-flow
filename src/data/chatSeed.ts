import type { ChatMessage } from "@/types";

const users = [
  { id: "u1", name: "Lucía", avatarColor: "142 90% 55%", badges: ["mod" as const] },
  { id: "u2", name: "Marcos", avatarColor: "210 90% 60%" },
  { id: "u3", name: "Sofía", avatarColor: "330 80% 65%", badges: ["vip" as const] },
  { id: "u4", name: "Diego", avatarColor: "45 95% 60%" },
  { id: "u5", name: "Arena Oficial", avatarColor: "142 90% 55%", badges: ["official" as const, "verified" as const] },
  { id: "u6", name: "Paula", avatarColor: "195 90% 55%" },
  { id: "u7", name: "Iván", avatarColor: "20 90% 60%" },
];

const seedTexts = [
  "¡Vamos equipo, presión arriba!",
  "Qué control de balón ese 10",
  "Falta clarísima, no señalan nada 🤨",
  "El portero está jugando un partidazo",
  "Buenas tardes a la comunidad 👋",
  "Mejor cobertura defensiva de la temporada",
  "Hoy gana el local seguro",
  "Increíble el ambiente del estadio",
  "Si meten otro se acabó esto",
  "Pásala al área!! 🔥",
  "Buen ritmo de partido",
  "Atención al cambio de banda",
  "Recuerden respetar las normas de la comunidad",
  "Cómo se está moviendo el medio campo",
  "Esa volea por poco entra",
];

const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const seedChat: ChatMessage[] = seedTexts.map((text, i) => ({
  id: `seed-${i}`,
  user: users[i % users.length],
  text,
  channel: i % 6 === 0 ? "official" : "community",
  createdAt: ago(Math.max(1, 30 - i * 2)),
  pinned: i === 0,
}));

export const botUsers = users;
