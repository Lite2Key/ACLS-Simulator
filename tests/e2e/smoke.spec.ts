import { expect, test } from '@playwright/test';

test('vertical slice can be completed to stabilized debrief', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('ED Case Lab')).toBeVisible();
  await expect(page.getByTestId('monitor-panel')).toContainText('ED MONITOR');

  await page.getByRole('tab', { name: 'Team' }).click();
  await page.getByTestId('action-start_transfer_to_bed').click();
  await page.getByTestId('action-start_ems_handoff').click();

  await page.getByRole('tab', { name: 'Setup' }).click();
  await page.getByTestId('action-attach_monitor_leads').click();
  await page.getByTestId('action-attach_defib_pads').click();
  await page.getByTestId('action-place_arterial_line').click();
  await page.getByTestId('action-attach_capnography').click();
  await page.getByTestId('action-establish_iv').click();

  await page.getByTestId('advance-30s').click();
  await page.getByTestId('advance-30s').click();

  await expect(page.getByTestId('wave-a-line')).toContainText('78/48');
  await expect(page.getByTestId('wave-etco2')).toContainText('34 mmHg');

  await page.getByTestId('action-give_atropine').click();

  const ackButton = page.getByTestId('ack-button');
  if (await ackButton.isVisible()) {
    await ackButton.click();
  }

  await page.getByRole('tab', { name: 'Critical' }).click();
  await page.getByTestId('action-start_pacing_mode').click();
  await page.getByTestId('action-set_pacing_rate_70').click();
  await page.getByTestId('action-set_pacing_current_70').click();
  await page.getByTestId('action-confirm_capture').click();

  await expect(page.getByText('Outcome: stabilized')).toBeVisible();
  await expect(page.getByTestId('debrief-timeline')).toContainText('Mechanical capture confirmed');
});
