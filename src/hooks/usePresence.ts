import { useEffect, useState } from "react";
import { subscribePresence } from "@/services/presence.service";

export function usePresence() {
  const [onlineCount, setOnlineCount] = useState(0);
  useEffect(() => subscribePresence(setOnlineCount), []);
  return onlineCount;
}

