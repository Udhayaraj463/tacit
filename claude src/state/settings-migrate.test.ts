import { describe, expect, test } from 'vitest';
import { SETTINGS_VERSION, migrateSettings } from './settings-migrate';

const defaults: { holdMode: 'hand' | 'flat'; ttsAuto: boolean } = { holdMode: 'flat', ttsAuto: false };

describe('migrateSettings', () => {
  test('saved settings from before version 2 switch to the flat two-sided mode once', () => {
    expect(migrateSettings({ holdMode: 'hand', ttsAuto: true }, defaults)).toEqual({ holdMode: 'flat', ttsAuto: true, v: SETTINGS_VERSION });
  });

  test('a choice made after the upgrade is kept', () => {
    expect(migrateSettings({ holdMode: 'hand', v: SETTINGS_VERSION }, defaults)).toMatchObject({ holdMode: 'hand' });
  });

  test('missing fields come from the defaults', () => {
    expect(migrateSettings({}, defaults)).toEqual({ holdMode: 'flat', ttsAuto: false, v: SETTINGS_VERSION });
  });
});
