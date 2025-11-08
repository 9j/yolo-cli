/**
 * Tests for formatting utilities
 */

import {describe, it, expect} from 'vitest';
import {
	estimateTokens,
	formatContextUsage,
	truncate,
	pluralize,
	formatMessageCount,
} from '../../../src/utils/formatting.js';

describe('Formatting Utilities', () => {
	describe('estimateTokens', () => {
		it('should estimate tokens from text', () => {
			expect(estimateTokens('test')).toBe(1); // 4 chars = 1 token
			expect(estimateTokens('this is a test')).toBe(4); // 14 chars = 3.5 -> 4 tokens
			expect(estimateTokens('')).toBe(0);
		});
	});

	describe('formatContextUsage', () => {
		it('should format context usage as percentage', () => {
			expect(formatContextUsage(0.5)).toBe('50%');
			expect(formatContextUsage(0.75)).toBe('75%');
			expect(formatContextUsage(1.0)).toBe('100%');
		});
	});

	describe('truncate', () => {
		it('should truncate long text', () => {
			expect(truncate('this is a long text', 10)).toBe('this is...');
		});

		it('should not truncate short text', () => {
			expect(truncate('short', 10)).toBe('short');
		});
	});

	describe('pluralize', () => {
		it('should pluralize words correctly', () => {
			expect(pluralize('message', 1)).toBe('message');
			expect(pluralize('message', 2)).toBe('messages');
			expect(pluralize('model', 0)).toBe('models');
		});
	});

	describe('formatMessageCount', () => {
		it('should format message count', () => {
			expect(formatMessageCount(1)).toBe('1 message');
			expect(formatMessageCount(5)).toBe('5 messages');
		});
	});
});
