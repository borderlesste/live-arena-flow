import { beforeEach, describe, expect, it, vi } from "vitest";

const realtime = vi.hoisted(() => {
  let sync: (() => void) | undefined;
  let state: Record<string, unknown[]> = {};
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, handler: () => void) => {
      sync = handler;
      return channel;
    }),
    subscribe: vi.fn((handler: (status: string) => void) => {
      handler("SUBSCRIBED");
      return channel;
    }),
    presenceState: vi.fn(() => state),
    track: vi.fn(),
    untrack: vi.fn(),
  };
  const client = {
    auth: { getSession: vi.fn() },
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
  };
  return {
    channel,
    client,
    setState(next: Record<string, unknown[]>) { state = next; },
    sync() { sync?.(); },
  };
});

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabaseClient: async () => realtime.client,
}));

import { subscribePresence } from "./presence.service";

describe("public presence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    realtime.setState({});
    realtime.client.auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  it("lets a guest observe active authenticated presences without tracking the guest", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePresence(listener);

    await vi.waitFor(() => expect(realtime.client.channel).toHaveBeenCalledWith(
      "presence:global",
      expect.objectContaining({ config: { presence: { key: expect.any(String) } } }),
    ));
    expect(realtime.channel.track).not.toHaveBeenCalled();

    realtime.setState({ activeA: [{}], activeB: [{}] });
    realtime.sync();
    expect(listener).toHaveBeenLastCalledWith(2);

    unsubscribe();
  });
});
