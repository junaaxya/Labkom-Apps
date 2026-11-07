import { expect, test, type Page } from "@playwright/test";

const coordinator = {
  id: "e2e-coordinator",
  name: "Koordinator E2E",
  email: "coordinator@example.test",
  role: "KOORDINATOR_LAB",
  mustChangePassword: false,
};

const samplePcs = [
  {
    id: "pc-1",
    pcCode: "LAB1-PC01",
    name: "Workstation 01",
    labId: "lab-1",
    agentStatus: "ONLINE",
    lastSeen: new Date().toISOString(),
    agentVersion: "1.0.4",
    lab: { id: "lab-1", name: "Lab Pemrograman 1" },
  },
  {
    id: "pc-2",
    pcCode: "LAB1-PC02",
    name: "Workstation 02",
    labId: "lab-1",
    agentStatus: "OFFLINE",
    lastSeen: null,
    agentVersion: "1.0.2",
    lab: { id: "lab-1", name: "Lab Pemrograman 1" },
  },
];

async function installUpdaterState(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", "e2e-token");
  }, coordinator);

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/pcs/agent-updates/releases/sync-github")) {
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, created: true, repo: "junaaxya/labkom-agents", data: { id: "release-1", version: "1.1.0" } }) });
      return;
    }
    const data = path.endsWith("/pcs/agent-updates/releases")
      ? [{ id: "release-1", version: "1.1.0", platform: "windows", architecture: "x86_64", sha256: "a".repeat(64), sizeBytes: 12_582_912, minimumUpdaterVersion: "1.0.0", mandatory: false, isPublished: true, createdAt: new Date().toISOString() }]
      : path.endsWith("/pcs/agent-updates/rollouts")
        ? [{ id: "rollout-1", status: "ACTIVE", scope: "ALL", rolloutPercent: 25, checkAfterSeconds: 600, createdAt: new Date().toISOString(), release: { id: "release-1", version: "1.1.0", platform: "windows", architecture: "x86_64", sha256: "a".repeat(64), sizeBytes: 12_582_912, minimumUpdaterVersion: "1.0.0", mandatory: false, isPublished: true, createdAt: new Date().toISOString() }, assignments: [] }]
        : path.endsWith("/pcs")
          ? samplePcs
          : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
}

test.describe.configure({ mode: "serial" });

for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test(`agent updater fits ${viewport.width}px viewport and supports inline PC selector`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installUpdaterState(page);
    await page.goto("/pc-monitoring");
    const quickAction = page.getByRole("link", { name: /Kelola pembaruan agent/i });
    await expect(quickAction).toBeVisible();
    await expect(page.getByTestId("agent-updater-panel")).toHaveCount(0);
    await expect(quickAction).toHaveAttribute("href", "/pc-monitoring/agent-updater");
    if (viewport.width === 390) {
      await page.screenshot({ path: "/tmp/pc-monitoring-agent-updater-quick-action-390x844.png", fullPage: false });
    }
    await page.goto("/pc-monitoring/agent-updater?pcs=pc-2");
    await expect(page).toHaveURL(/\/pc-monitoring\/agent-updater\?pcs=pc-2$/);

    const panel = page.getByTestId("agent-updater-panel");
    const selector = page.getByTestId("pc-selector");
    await expect(panel).toBeVisible();
    await expect(selector).toBeVisible();
    await expect(selector.getByText("Pilih PC target (1 dipilih)")).toBeVisible();
    await expect(selector.getByText("LAB1-PC01 · Workstation 01")).toBeVisible();
    await expect(selector.getByText("Lab Pemrograman 1 · v1.0.4")).toBeVisible();

    await selector.getByRole("button", { name: "Pilih yang online" }).click();
    await expect(selector.getByText("Pilih PC target (1 dipilih)")).toBeVisible();
    await selector.getByRole("button", { name: "Pilih semua" }).click();
    await expect(selector.getByText("Pilih PC target (2 dipilih)")).toBeVisible();
    await selector.getByLabel("Cari PC target").fill("PC01");
    await expect(selector.getByText("LAB1-PC01 · Workstation 01")).toBeVisible();
    await selector.getByLabel("Cari PC target").fill("");

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
    const syncButton = page.getByRole("button", { name: /Tarik otomatis dari GitHub/i });
    await expect(syncButton).toHaveCSS("min-height", "44px");
    await syncButton.click();
    await expect(page.getByRole("status").filter({ hasText: "Release v1.1.0 berhasil ditarik & dipublish dari GitHub" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Aktifkan rollout/i })).toHaveCSS("min-height", "44px");
    if (viewport.width !== 320) {
      await panel.screenshot({ path: `/tmp/agent-updater-${viewport.width}x${viewport.height}.png` });
    }
  });
}
