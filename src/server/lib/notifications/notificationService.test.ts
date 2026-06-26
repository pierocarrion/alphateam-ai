import { describe, expect, it, beforeEach } from "vitest";
import { resetDatabase, seedUser, getTestPrisma } from "@/tests/helpers/db";
import { notifyUser } from "./notificationService";
import { InProcessRealtimeBroker, setRealtimeBroker } from "@/server/lib/realtime";
import type { RealtimeEvent } from "@/server/lib/realtime";

describe("notificationService.notifyUser", () => {
  beforeEach(async () => {
    await resetDatabase();
    const broker = new InProcessRealtimeBroker();
    setRealtimeBroker(broker);
  });

  it("persists the notification row for the user", async () => {
    const { user } = await seedUser({ email: "a@x.test", name: "A" });

    const result = await notifyUser({
      userId: user.id,
      type: "task_assigned",
      title: "Te asignaron una tarea",
      body: "Tarea X",
      data: { workspaceId: "w1", taskId: "t1" },
      workspaceId: "w1",
    });

    expect(result).not.toBeNull();
    const prisma = await getTestPrisma();
    const rows = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("task_assigned");
    expect(rows[0].readAt).toBeNull();
  });

  it("publishes a notification_received realtime event with the target userId", async () => {
    const { user } = await seedUser({ email: "b@x.test", name: "B" });
    const events: RealtimeEvent[] = [];
    const broker = new InProcessRealtimeBroker();
    broker.subscribe((e) => events.push(e));
    setRealtimeBroker(broker);

    await notifyUser({
      userId: user.id,
      type: "join_approved",
      title: "Aprobado",
      body: "Bienvenido",
    });

    const n = events.find((e) => e.type === "notification_received");
    expect(n).toBeDefined();
    expect((n!.data as { userId: string }).userId).toBe(user.id);
  });

  it("never throws when the user has no push tokens", async () => {
    const { user } = await seedUser({ email: "c@x.test", name: "C" });
    await expect(
      notifyUser({
        userId: user.id,
        type: "dm_started",
        title: "DM",
        body: "Hola",
      })
    ).resolves.not.toThrow();
  });
});
