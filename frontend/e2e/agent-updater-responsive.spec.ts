import { expect, test, type Page } from "@playwright/test";

const coordinator = {
  id: "e2e-coordinator",
  name: "Koordinator E2E",
  email: "coordinator@example.test",
  role: "KOORDINATOR_LAB",
  mustChangePassword: false,
};

async function installUpdaterState(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", "e2e-token");
  }, coordinator);

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/pcs/agent-updates/releases")
      ? [{ id: "release-1", version: "1.1.0", platform: "windows", architecture: "x86_64", sha256: "a".repeat(64), sizeBytes: 12_582_912, minimumUpdaterVersion: "1.0.0", mandatory: false, isPublished: true, createdAt: new Date().toISOString() }]
      : path.endsWith("/pcs/agent-updates/rollouts")
        ? [{ id: "rollout-1", status: "ACTIVE", scope: "ALL", rolloutPercent: 25, checkAfterSeconds: 600, createdAt: new Date().toISOString(), release: { id: "release-1", version: "1.1.0", platform: "windows", architecture: "x86_64", sha256: "a".repeat(64), sizeBytes: 12_582_912, minimumUpdaterVersion: "1.0.0", mandatory: false, isPublished: true, createdAt: new Date().toISOString() }, assignments: [] }]
        : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
}

test.describe.configure({ mode: "serial" });

for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`agent updater fits ${viewport.width}px viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installUpdaterState(page);
    await page.goto("/pc-monitoring");
    const quickAction = page.getByRole("link", { name: /Buka Agent Updater/i });
    await expect(quickAction).toBeVisible();
    await expect(page.getByTestId("agent-updater-panel")).toHaveCount(0);
    await expect(quickAction).toHaveAttribute("href", "/pc-monitoring/updater");
    if (viewport.width === 390) {
      await page.screenshot({ path: "/tmp/pc-monitoring-updater-quick-action-390x844.png", fullPage: false });
    }
    await page.goto("/pc-monitoring/updater");
    await expect(page).toHaveURL(/\/pc-monitoring\/updater$/);

    const panel = page.getByTestId("agent-updater-panel");
    await expect(panel).toBeVisible();
    const layout = await panel.evaluate((element) => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      panelLeft: element.getBoundingClientRect().left,
      panelRight: element.getBoundingClientRect().right,
      panelWidth: element.getBoundingClientRect().width,
      panelScrollWidth: element.scrollWidth,
    }));

    expect(layout.documentWidth).toBe(layout.viewportWidth);
    expect(layout.panelLeft).toBeGreaterThanOrEqual(0);
    expect(layout.panelRight).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.panelScrollWidth).toBeLessThanOrEqual(Math.ceil(layout.panelWidth));
    await expect(page.getByLabel("Artifact ZIP")).toBeVisible();
    await expect(page.getByRole("button", { name: /Aktifkan rollout/i })).toHaveCSS("min-height", "44px");
    if (viewport.width !== 320) {
      await panel.screenshot({ path: `/tmp/agent-updater-${viewport.width}x${viewport.height}.png` });
    }
  });
}
