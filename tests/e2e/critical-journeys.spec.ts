import { test, expect } from "@playwright/test";

test.describe("Critical user journeys", () => {
  test("home page loads and shows navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ReDesignAI/);
    await expect(
      page.getByRole("link", { name: /Open studio|Go to studio/ })
    ).toBeVisible();
  });

  test("sign up page loads and shows form fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirm")).toBeVisible();
  });

  test("sign in page loads and shows form fields", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("protected routes redirect to sign-in when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/signin/);
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("sign in with invalid credentials shows error", async ({ page }) => {
    await page.goto("/signin");
    await page.fill('input[type="email"]', "nonexistent@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button:has-text("Sign in")');
    await expect(
      page.locator('[role="alert"], .text-red-100, [data-testid="error"]')
    ).toBeVisible({ timeout: 5000 });
  });

  test("redesign page shows upload area and accepts a file", async ({ page }) => {
    await page.goto("/redesign");
    await expect(page.locator('input[type="file"]')).toBeVisible();

    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Set files directly on the input
    await page.setInputFiles('input[type="file"]', [
      {
        name: "test.png",
        mimeType: "image/png",
        buffer: pngBuffer,
      },
    ]);

    // The image preview should appear after selection
    await expect(
      page.getByAltText("Selected screenshot preview")
    ).toBeVisible({ timeout: 10000 });
  });

  test("chat widget opens and accepts input", async ({ page }) => {
    await page.goto("/redesign");
    await page.getByRole("button", { name: "Open AI assistant" }).click();
    await expect(
      page.getByPlaceholder(/ask about the redesign/i)
    ).toBeVisible();
  });
});

test.describe("Anonymous free-use limit UI", () => {
  test("free-limit modal is hidden by default", async ({ page }) => {
    await page.goto("/redesign");
    await expect(
      page.getByText(/free limit reached/i, { exact: false })
    ).toBeHidden({ timeout: 5000 });
  });
});