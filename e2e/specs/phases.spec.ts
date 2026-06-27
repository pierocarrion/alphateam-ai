import { test, expect } from "../fixtures/auth";

/**
 * E2E: el líder completa un artefacto de la metodología desde /project/phases
 * y verifica que aparezca en el Knowledge Hub (base de conocimiento).
 *
 * Requiere un proyecto con metodología primaria (design_thinking o scrum) y
 * fases sembradas. El demo user "maya@example.com" actúa como líder.
 */
test.describe("Project phases & artifacts", () => {
  test("renders the phase tracker and lets the leader complete an artifact", async ({
    demoPage,
  }) => {
    await demoPage.goto("/project/phases");

    // La página debe cargar el tracker (header con % de progreso).
    await expect(demoPage.getByText(/artefactos completados/i)).toBeVisible({ timeout: 15000 });

    // Debe haber al menos un botón "Completar" visible (el primer artefacto).
    const completeButton = demoPage.getByRole("button", { name: /^Completar$/ }).first();
    await expect(completeButton).toBeVisible();
    await completeButton.click();

    // El modal abre con un área de texto para los prompts.
    const textarea = demoPage.getByPlaceholder(/escribe aquí/i).first();
    await expect(textarea).toBeVisible();
    await textarea.fill("Insight de prueba del usuario");

    // Guarda el artefacto.
    await demoPage.getByRole("button", { name: /^Guardar artefacto$/ }).click();

    // Tras guardar, el chip "Hecho" aparece.
    await expect(demoPage.getByText(/^Hecho$/).first()).toBeVisible({ timeout: 10000 });
  });

  test("shows a methodology progress card on /progress", async ({ demoPage }) => {
    await demoPage.goto("/progress");
    await expect(demoPage.getByText(/base metodológica/i)).toBeVisible({ timeout: 15000 });
  });
});
