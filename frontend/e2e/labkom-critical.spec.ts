import { expect, test } from "@playwright/test";

const user = {
  id: "e2e-student",
  name: "Mahasiswa E2E",
  email: "e2e@example.test",
  role: "MAHASISWA",
  mustChangePassword: false,
};

async function installAuthenticatedState(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("user", JSON.stringify(value));
    localStorage.setItem("token", "e2e-token");
  }, user);
  await page.route("**/api/v1/faq/list", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            question: "Bagaimana melihat jadwal lab?",
            answer: "Buka menu Jadwal untuk melihat kegiatan LabKom.",
            category: "Jadwal",
          },
        ],
      }),
    });
  });
}

test("route dashboard terlindungi mengarahkan pengguna anonim ke login", async ({ page }) => {
  await page.goto("/faq");
  await expect(page).toHaveURL(/\/login$/);
});

test("Pusat Bantuan terbaca dan CTA AI memiliki kontras", async ({ page }) => {
  await installAuthenticatedState(page);
  await page.goto("/faq");
  await expect(page.getByRole("heading", { name: "Pusat Bantuan" })).toBeVisible();
  const cta = page.getByText("Butuh jawaban yang lebih spesifik?");
  await expect(cta).toBeVisible();
  const colors = await cta.evaluate((element) => {
    const style = getComputedStyle(element);
    const parent = getComputedStyle(element.closest("section")!);
    return { text: style.color, background: parent.backgroundColor };
  });
  expect(colors.text).not.toBe(colors.background);
});

test("viewport tablet tetap memiliki tombol pembuka navigasi", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await installAuthenticatedState(page);
  await page.goto("/faq");
  const menuButton = page.getByRole("button", { name: /menu/i }).first();
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByText("Pusat Bantuan").last()).toBeVisible();
});

test("entry point scanner menampilkan scanner nyata", async ({ page }) => {
  await installAuthenticatedState(page);
  await page.goto("/scan");
  await expect(page.getByRole("heading", { name: /Scan QR Code/i })).toBeVisible();
  await expect(page.getByText("Arahkan kamera ke QR kunci atau PC", { exact: true })).toBeVisible();
});
