import { test, expect } from "../fixtures/auth";

test.describe("Chat", () => {
  const composer = (page: import("@playwright/test").Page) =>
    page.getByPlaceholder("Message #q3-launch…").filter({ visible: true });

  const send = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: /^send$/i }).filter({ visible: true });

  const sendMessage = async (page: import("@playwright/test").Page, text: string) => {
    const input = composer(page);
    await input.fill(text);
    const button = send(page);
    // Ensure React state caught up before clicking (avoids clicking a disabled
    // Send button on slower/touch contexts).
    await expect(button).toBeEnabled({ timeout: 5000 });
    await button.click();
  };

  test("loads the demo channel and sends a task message", async ({ demoPage }) => {
    test.setTimeout(60000);
    await demoPage.goto("/chat");

    const input = composer(demoPage);
    await expect(input).toBeVisible();

    await sendMessage(demoPage, "I need to write the project proposal today");

    await expect(demoPage.getByText("I need to write the project proposal today").filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
    await expect(demoPage.getByText(/alpha heard|looks like a task|start/i).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test("sends a casual message without interception", async ({ demoPage }) => {
    await demoPage.goto("/chat");

    await sendMessage(demoPage, "Good morning team!");

    await expect(demoPage.getByText("Good morning team!").filter({ visible: true })).toBeVisible({ timeout: 5000 });
  });
});
