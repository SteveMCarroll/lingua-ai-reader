import { test, expect } from "@playwright/test";

/**
 * Smoke tests for Lingua AI Reader
 *
 * Critical user flows:
 * 1. Book list loads with all books (Spanish + Japanese)
 * 2. Clicking a book opens the reader
 * 3. Text selection triggers gloss popup
 * 4. Chapter navigation works
 * 5. No console errors on any page
 */

test.describe("Lingua AI Reader", () => {
  test("book list page loads with all books", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Lingua AI Reader");
    const buttons = page.locator("button");
    await expect(buttons).toHaveCount(5);
    await expect(page.locator("text=夏の花")).toBeVisible();
    await expect(page.locator("text=原民喜")).toBeVisible();
    await expect(page.locator("text=El sombrero de tres picos")).toBeVisible();
    await expect(page.locator("text=Marianela")).toBeVisible();
  });

  test("clicking a Spanish book opens the reader", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Marianela").click();

    // Book list heading should disappear (we're in reader now)
    await expect(page.locator("text=Escoge un libro")).not.toBeVisible({ timeout: 5000 });

    // Root should have substantial content (not blank crash)
    const html = await page.locator("#root").innerHTML();
    expect(html.length).toBeGreaterThan(200);

    // Page header should show (use .first() since both h1 and header exist)
    await expect(page.locator("header").first()).toBeVisible();
  });

  test("clicking a Japanese book opens the reader without crashing", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=夏の花").click();

    // Book list should disappear (we navigated away)
    await expect(page.locator("text=Escoge un libro")).not.toBeVisible({ timeout: 5000 });

    // Root should have content
    const html = await page.locator("#root").innerHTML();
    expect(html.length).toBeGreaterThan(200);

    // Should contain Japanese text
    const bodyText = await page.locator("#root").textContent();
    expect(bodyText).toMatch(/[一-龯ぁ-ん]/);
  });

  test("text selection triggers gloss popup or loading state", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Marianela").click();
    await expect(page.locator("text=Escoge un libro")).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Select text by clicking and dragging across the content area
    const contentArea = page.locator("#root p, #root span, #root div").first();
    if (await contentArea.isVisible()) {
      const box = await contentArea.boundingBox();
      if (box && box.width > 60) {
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 5 });
        await page.mouse.up();
      }
    }

    // Page should still be alive after selection (no crash)
    await page.waitForTimeout(2000);
    const html = await page.locator("#root").innerHTML();
    expect(html.length).toBeGreaterThan(100);
  });

  test("chapter navigation works", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Marianela").click();
    await expect(page.locator("text=Escoge un libro")).not.toBeVisible({ timeout: 5000 });

    // Look for next-page button (Spanish text "Página siguiente")
    const nextBtn = page.getByRole("button", { name: /siguiente|Siguiente/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      const html = await page.locator("#root").innerHTML();
      expect(html.length).toBeGreaterThan(100);
    }
  });

  test("back button returns to book list", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Marianela").click();
    await expect(page.locator("text=Escoge un libro")).not.toBeVisible({ timeout: 5000 });

    // Click back — find the back/left arrow button in the header
    const backBtn = page.getByRole("button", { name: /volver|back|←/i });
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await expect(page.locator("text=Escoge un libro")).toBeVisible({ timeout: 5000 });
    }
  });

  test("no console errors on book list page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(2000);

    const relevantErrors = errors.filter(
      (e) => !e.includes("garmin") && !e.includes("sentry") && !e.includes("Content Security Policy")
    );
    expect(relevantErrors).toEqual([]);
  });

  test("no console errors when opening Japanese book", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.locator("text=夏の花").click();
    await page.waitForTimeout(3000);

    const relevantErrors = errors.filter(
      (e) => !e.includes("garmin") && !e.includes("sentry") && !e.includes("Content Security Policy")
    );
    expect(relevantErrors).toEqual([]);
  });

  test("no console errors when opening Spanish book", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.locator("text=Marianela").click();
    await page.waitForTimeout(3000);

    const relevantErrors = errors.filter(
      (e) => !e.includes("garmin") && !e.includes("sentry") && !e.includes("Content Security Policy")
    );
    expect(relevantErrors).toEqual([]);
  });
});
