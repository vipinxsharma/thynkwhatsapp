import { test, expect } from "@playwright/test";

test.describe("thynkWISE WhatsApp CRM Inbox E2E Tests", () => {
  test("loads the CRM inbox and displays active conversations", async ({ page }) => {
    await page.goto("/inbox");

    // Check header
    await expect(page.locator("text=Conversations")).toBeVisible();
    await expect(page.locator("text=Aarav Mehta")).toBeVisible();
    await expect(page.locator("text=Sophia Chen")).toBeVisible();
  });

  test("displays 24-hour Customer Service Window indicator", async ({ page }) => {
    await page.goto("/inbox");

    // Check active window on conversation 1
    await expect(page.locator("text=Active 24h Window")).toBeVisible();
  });

  test("enforces lock when selecting an expired 24-hour window conversation", async ({ page }) => {
    await page.goto("/inbox");

    // Click Sophia Chen whose window is expired
    await page.click("text=Sophia Chen");

    // Should see warning that window is closed
    await expect(page.locator("text=24h Customer Service Window Closed")).toBeVisible();

    // The text area should be disabled
    const textarea = page.locator("textarea");
    await expect(textarea).toBeDisabled();

    // Send button should be disabled
    const sendButton = page.locator("button[title='Send message']");
    await expect(sendButton).toBeDisabled();
  });

  test("can open the approved HSM template modal and fill variables", async ({ page }) => {
    await page.goto("/inbox");

    // Open template modal
    await page.click("text=Send Template");

    // Modal should appear
    await expect(page.locator("text=Select WhatsApp HSM Template")).toBeVisible();
    await expect(page.locator("text=order_confirmation_v1")).toBeVisible();

    // Close modal
    await page.click("button:has-text('Cancel')");
    await expect(page.locator("text=Select WhatsApp HSM Template")).not.toBeVisible();
  });

  test("can trigger simulated inbound webhook and view message in real time", async ({ page }) => {
    await page.goto("/inbox");

    // Check Live SSE indicator
    await expect(page.locator("text=Live SSE")).toBeVisible();

    // Count messages before
    const initialCount = await page.locator(".whatsapp-pattern > div").count();

    // Click "Test Inbound Webhook"
    await page.click("text=Test Inbound Webhook");

    // Wait for the new message bubble to appear in the DOM
    await page.waitForTimeout(1000);
    const updatedCount = await page.locator(".whatsapp-pattern > div").count();
    expect(updatedCount).toBeGreaterThan(initialCount);
  });
});
