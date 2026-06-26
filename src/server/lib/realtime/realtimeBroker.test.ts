import { describe, expect, it } from "vitest";
import {
  InProcessRealtimeBroker,
  setRealtimeBroker,
  getRealtimeBroker,
  publishRealtime,
  type RealtimeEvent,
} from "./realtimeBroker";

describe("InProcessRealtimeBroker", () => {
  it("delivers published events to subscribers", () => {
    const broker = new InProcessRealtimeBroker();
    const received: RealtimeEvent[] = [];
    broker.subscribe((e) => received.push(e));

    broker.publish({
      type: "message_sent",
      workspaceId: "w1",
      channelId: "c1",
      data: { text: "hi" },
      at: 1,
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("message_sent");
    expect(received[0].workspaceId).toBe("w1");
  });

  it("supports multiple subscribers", () => {
    const broker = new InProcessRealtimeBroker();
    let a = 0;
    let b = 0;
    broker.subscribe(() => a++);
    broker.subscribe(() => b++);
    broker.publish({ type: "task_detected", workspaceId: "w", data: {}, at: 1 });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("unsubscribe stops further deliveries", () => {
    const broker = new InProcessRealtimeBroker();
    let count = 0;
    const unsub = broker.subscribe(() => count++);
    broker.publish({ type: "reaction_added", workspaceId: "w", data: {}, at: 1 });
    unsub();
    broker.publish({ type: "reaction_added", workspaceId: "w", data: {}, at: 2 });
    expect(count).toBe(1);
    expect(broker.listenerCount()).toBe(0);
  });

  it("isolates listener errors from other listeners", () => {
    const broker = new InProcessRealtimeBroker();
    broker.subscribe(() => {
      throw new Error("boom");
    });
    let ok = false;
    broker.subscribe(() => {
      ok = true;
    });
    broker.publish({ type: "message_sent", workspaceId: "w", data: {}, at: 1 });
    expect(ok).toBe(true);
  });

  it("publishRealtime routes through the active broker singleton", () => {
    const fake = new InProcessRealtimeBroker();
    setRealtimeBroker(fake);
    const seen: string[] = [];
    fake.subscribe((e) => seen.push(e.type));
    publishRealtime("alpha_insight", { workspaceId: "w9", data: { x: 1 } });
    expect(seen).toEqual(["alpha_insight"]);
    // reset to default for other suites
    setRealtimeBroker(new InProcessRealtimeBroker());
    expect(getRealtimeBroker().listenerCount()).toBe(0);
  });
});
