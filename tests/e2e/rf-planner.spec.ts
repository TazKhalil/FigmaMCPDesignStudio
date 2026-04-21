/**
 * RF Coverage Planner — Playwright E2E test suite
 *
 * Phase 10 tasks: T045, T046, T047, T048, T049, T050, T053
 *
 * T053 (cross-browser) is covered implicitly: playwright.config.ts runs every
 * test in both Chromium and Edge projects.
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Helper — resolve the canvas element and return its bounding box.
// The canvas is the only <canvas> element rendered by the app.
// ---------------------------------------------------------------------------
async function getCanvasBox(page: Page) {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas bounding box is null');
  return box;
}

// ---------------------------------------------------------------------------
// T045 — "Create & export"
// ---------------------------------------------------------------------------
test('T045 — create & export: scale → place gateway + 3 sensors → RSSI tiers → CSV', async ({ page }) => {
  await page.goto('/');

  // 1. Set scale (required so RSSI is non-null)
  await page.getByRole('button', { name: 'Set Scale' }).click();
  const box = await getCanvasBox(page);

  // Draw a 200 px scale line; dialog will appear after the second click
  await page.mouse.click(box.x + 100, box.y + 200);
  await page.mouse.click(box.x + 300, box.y + 200);

  // Scale dialog is now open — fill in 100 ft and confirm
  await expect(page.locator('#scale-distance-input')).toBeVisible({ timeout: 3000 });
  await page.fill('#scale-distance-input', '100');
  // "Set Scale" appears in both toolbar (aria-label) and dialog button (text).
  // Use the last match — the dialog's confirm button.
  await page.getByRole('button', { name: 'Set Scale' }).last().click();

  // StatusBar confirms scale is set
  await expect(page.getByText(/100\.0 ft ref/)).toBeVisible({ timeout: 3000 });

  // 2. Place 1 gateway at canvas centre
  await page.getByRole('button', { name: 'Gateway' }).click();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByText('Gateways: 1')).toBeVisible();

  // 3. Place 3 sensors near the gateway
  await page.getByRole('button', { name: 'Sensor' }).click();
  await page.mouse.click(box.x + box.width * 0.40, box.y + box.height * 0.40);
  await page.mouse.click(box.x + box.width * 0.60, box.y + box.height * 0.40);
  await page.mouse.click(box.x + box.width * 0.40, box.y + box.height * 0.60);
  await expect(page.getByText(/Sensor Points: 3/)).toBeVisible();

  // 4. Wait for RSSI recalculation to complete (at least one tier count > 0)
  await expect(page.locator('text=/[1-9]\\d* Good/')).toBeVisible({ timeout: 5000 });

  // 5. Export CSV and verify ≥ 3 data rows
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export bill of materials as CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);

  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const content = await fs.promises.readFile(filePath!, 'utf-8');

  // CSV: header row, then N sensor rows, then blank, then summary
  const nonEmptyLines = content
    .split('\n')
    .map(r => r.trim())
    .filter(r => r.length > 0);
  // Remove header (first) and summary (last)
  const dataRows = nonEmptyLines.slice(1, -1);
  expect(dataRows.length).toBeGreaterThanOrEqual(3);
});

// ---------------------------------------------------------------------------
// T046 — "Save & reload"
// ---------------------------------------------------------------------------
test('T046 — save & reload: auto-save persists project across page reload', async ({ page }) => {
  await page.goto('/');

  // Place a gateway
  await page.getByRole('button', { name: 'Gateway' }).click();
  const box = await getCanvasBox(page);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByText('Gateways: 1')).toBeVisible();

  // Place 2 sensors
  await page.getByRole('button', { name: 'Sensor' }).click();
  await page.mouse.click(box.x + box.width * 0.40, box.y + box.height * 0.40);
  await page.mouse.click(box.x + box.width * 0.60, box.y + box.height * 0.40);
  await expect(page.getByText(/Sensor Points: 2/)).toBeVisible();

  // Reload — initAutoSave() wrote to localStorage; store re-reads on init
  await page.reload();

  await expect(page.getByText('Gateways: 1')).toBeVisible();
  await expect(page.getByText(/Sensor Points: 2/)).toBeVisible();
});

// ---------------------------------------------------------------------------
// T047 — "Undo/redo"
// ---------------------------------------------------------------------------
test('T047 — undo/redo: Ctrl+Z undoes gateway; Ctrl+Y redoes it', async ({ page }) => {
  await page.goto('/');

  // Place a gateway
  await page.getByRole('button', { name: 'Gateway' }).click();
  const box = await getCanvasBox(page);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByText('Gateways: 1')).toBeVisible();

  // Undo — Canvas registers window 'keydown' so this fires globally
  await page.keyboard.press('Control+z');
  await expect(page.getByText('Gateways: 0')).toBeVisible();

  // Redo
  await page.keyboard.press('Control+y');
  await expect(page.getByText('Gateways: 1')).toBeVisible();
});

// ---------------------------------------------------------------------------
// T048 — "Dark mode persistence"
// ---------------------------------------------------------------------------
test('T048 — dark mode persistence: toggles and survives page reload', async ({ page }) => {
  await page.goto('/');

  // Initially light theme (fresh localStorage)
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

  // Toggle to dark
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);

  // Reload — store reads 'rf-theme' from localStorage → re-applies dark class
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/, { timeout: 2000 });

  // Restore light theme (cleanup so later tests start consistently)
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
});

// ---------------------------------------------------------------------------
// T049 — "Scale metres"
// ---------------------------------------------------------------------------
test('T049 — scale metres: entering 15 m sets ~49.2 ft reference in StatusBar', async ({ page }) => {
  await page.goto('/');

  // Activate Set Scale tool
  await page.getByRole('button', { name: 'Set Scale' }).click();
  const box = await getCanvasBox(page);

  // Click two points 300 px apart
  await page.mouse.click(box.x + 100, box.y + 200);
  await page.mouse.click(box.x + 400, box.y + 200);

  // Dialog should appear
  await expect(page.locator('#scale-distance-input')).toBeVisible({ timeout: 3000 });

  // Switch unit to Metres
  await page.getByRole('button', { name: 'Metres (m)' }).click();

  // Enter 15 metres
  await page.fill('#scale-distance-input', '15');

  // Confirm — last "Set Scale" button is the dialog's confirm button
  await page.getByRole('button', { name: 'Set Scale' }).last().click();

  // 15 m × 3.28084 = 49.2126 ft → toFixed(1) = "49.2"
  await expect(page.getByText(/49\.2 ft ref/)).toBeVisible({ timeout: 3000 });
});

// ---------------------------------------------------------------------------
// T050 — Accessibility audit (WCAG 2.1 AA)
// T053 — Cross-browser smoke (covered by running this suite in Chrome + Edge)
// ---------------------------------------------------------------------------
test('T050 — accessibility: 0 critical/serious WCAG 2.1 AA violations on main page', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const criticalOrSerious = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious',
  );

  if (criticalOrSerious.length > 0) {
    const summary = criticalOrSerious
      .map(v => `[${v.impact}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes.map(n => n.html).join('\n  ')}`)
      .join('\n\n');
    throw new Error(`${criticalOrSerious.length} critical/serious axe violation(s) found:\n\n${summary}`);
  }

  expect(criticalOrSerious).toHaveLength(0);
});
