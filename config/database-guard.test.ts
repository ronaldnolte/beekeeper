import { describe, expect, it } from 'vitest';
import { checkDatabase, databaseOf } from './database-guard';

const PROD = 'https://ayeqrbcvihztxbrxmrth.supabase.co';
const TEST = 'https://byqznixioptovxvvonww.supabase.co';
const RETIRED = 'https://wrdnwzgztwzoigkoebeq.supabase.co';

describe('database guard', () => {
  it('names the databases', () => {
    expect(databaseOf(PROD)).toBe('production');
    expect(databaseOf(TEST)).toBe('test');
    expect(databaseOf(undefined)).toBe('unknown');
  });

  it('blocks a Preview branch built against production', () => {
    expect(checkDatabase({ supabaseUrl: PROD, onVercel: true, branch: 'rebuild' })).toMatch(/PRODUCTION/);
    expect(checkDatabase({ supabaseUrl: PROD, onVercel: true, branch: 'develop' })).toMatch(/PRODUCTION/);
  });

  it('allows a Preview branch on the test database', () => {
    expect(checkDatabase({ supabaseUrl: TEST, onVercel: true, branch: 'rebuild' })).toBeNull();
  });

  it('requires production on main, and only there', () => {
    expect(checkDatabase({ supabaseUrl: PROD, onVercel: true, branch: 'main' })).toBeNull();
    expect(checkDatabase({ supabaseUrl: TEST, onVercel: true, branch: 'main' })).not.toBeNull();
  });

  it('keeps local runs off production', () => {
    expect(checkDatabase({ supabaseUrl: PROD, onVercel: false, branch: undefined })).not.toBeNull();
    expect(checkDatabase({ supabaseUrl: TEST, onVercel: false, branch: undefined })).toBeNull();
  });

  it('never allows the retired database, a missing or an unknown address', () => {
    expect(checkDatabase({ supabaseUrl: RETIRED, onVercel: true, branch: 'rebuild' })).toMatch(/retired/);
    expect(checkDatabase({ supabaseUrl: undefined, onVercel: true, branch: 'rebuild' })).not.toBeNull();
    expect(checkDatabase({ supabaseUrl: 'https://example.com', onVercel: false, branch: undefined })).not.toBeNull();
  });
});
