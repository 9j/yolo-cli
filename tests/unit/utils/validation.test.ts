/**
 * Tests for validation utilities
 */

import {describe, it, expect} from 'vitest';
import {
	validateApiKey,
	isValidISODate,
	isValidUUID,
	sanitizeInput,
} from '../../../src/utils/validation.js';

describe('Validation Utilities', () => {
	describe('validateApiKey', () => {
		it('should validate correct API key format', () => {
			expect(validateApiKey('sk-or-v1-abc123def456')).toBe(true);
			expect(validateApiKey('sk-or-v1-test_key-123')).toBe(true);
		});

		it('should reject invalid API key format', () => {
			expect(validateApiKey('invalid-key')).toBe(false);
			expect(validateApiKey('sk-or-abc123')).toBe(false);
			expect(validateApiKey('')).toBe(false);
		});
	});

	describe('isValidISODate', () => {
		it('should validate correct ISO 8601 dates', () => {
			expect(isValidISODate('2025-11-08T10:00:00.000Z')).toBe(true);
			expect(isValidISODate(new Date().toISOString())).toBe(true);
		});

		it('should reject invalid dates', () => {
			expect(isValidISODate('invalid-date')).toBe(false);
			expect(isValidISODate('2025-11-08')).toBe(false);
		});
	});

	describe('isValidUUID', () => {
		it('should validate correct UUID v4 format', () => {
			expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
		});

		it('should reject invalid UUIDs', () => {
			expect(isValidUUID('invalid-uuid')).toBe(false);
			expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
		});
	});

	describe('sanitizeInput', () => {
		it('should remove null bytes', () => {
			expect(sanitizeInput('test\0input')).toBe('testinput');
		});

		it('should trim whitespace', () => {
			expect(sanitizeInput('  test  ')).toBe('test');
		});
	});
});
