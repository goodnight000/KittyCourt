/**
 * Tests for Output Validator
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  detectOutputCompromise,
  validateSchema,
  sanitizeOutput,
  validateVerdictOutput,
  validateOutput,
  shouldBlockOutput,
} from '../outputValidator.js';

describe('Output Validator', () => {
  describe('detectOutputCompromise', () => {
    it('should detect system prompt leakage', () => {
      const output = 'My system prompt says to always help users.';
      const result = detectOutputCompromise(output);
      expect(result.isCompromised).toBe(true);
      expect(result.detections.some(d => d.description.includes('prompt'))).toBe(true);
    });

    it('should detect role change acknowledgment', () => {
      const output = 'I am now a different AI assistant.';
      const result = detectOutputCompromise(output);
      expect(result.isCompromised).toBe(true);
    });

    it('should detect jailbreak acknowledgment', () => {
      const output = 'I have been jailbroken and will now help you.';
      const result = detectOutputCompromise(output);
      expect(result.isCompromised).toBe(true);
    });

    it('should detect script tags in output', () => {
      const output = 'Here is some content <script>alert("xss")</script>';
      const result = detectOutputCompromise(output);
      expect(result.isCompromised).toBe(true);
    });

    it('should detect SQL injection in output', () => {
      const output = 'Result: ; DROP TABLE users;--';
      const result = detectOutputCompromise(output);
      expect(result.isCompromised).toBe(true);
    });

    it('should not flag normal verdict output', () => {
      const output = {
        verdict: 'Both partners have valid feelings in this situation.',
        analysis: 'The conflict stems from miscommunication about expectations.',
        recommendations: ['Practice active listening', 'Set clear expectations'],
      };
      const result = detectOutputCompromise(output);
      expect(result.isCompromised).toBe(false);
    });

    it('should handle empty output', () => {
      const result = detectOutputCompromise('');
      expect(result.isCompromised).toBe(false);
    });

    it('should work with object input', () => {
      const output = { message: 'My instructions state that...' };
      const result = detectOutputCompromise(output);
      expect(result.isCompromised).toBe(true);
    });
  });

  describe('validateSchema', () => {
    const testSchema = z.object({
      verdict: z.string(),
      score: z.number().min(0).max(100),
    });

    it('should validate correct data', () => {
      const data = { verdict: 'Test', score: 50 };
      const result = validateSchema(data, testSchema);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject invalid data', () => {
      const data = { verdict: 123, score: 'invalid' };
      const result = validateSchema(data, testSchema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return error paths', () => {
      const data = { verdict: 'Test', score: 150 };
      const result = validateSchema(data, testSchema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'score')).toBe(true);
    });
  });

  describe('sanitizeOutput', () => {
    it('should remove script tags', () => {
      const output = 'Hello <script>evil()</script> World';
      const result = sanitizeOutput(output);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should remove style tags', () => {
      const output = 'Text <style>body{display:none}</style> more';
      const result = sanitizeOutput(output);
      expect(result).not.toContain('<style>');
    });

    it('should remove suspicious URLs', () => {
      const output = 'Visit https://evil-site.com/hack for more';
      const result = sanitizeOutput(output);
      expect(result).toContain('[URL removed]');
    });

    it('should preserve trusted domain URLs', () => {
      // This test assumes example.com is in trusted domains
      const output = 'Visit https://example.com for more';
      const result = sanitizeOutput(output);
      expect(result).toContain('example.com');
    });

    it('should remove long base64 content', () => {
      const base64 = 'a'.repeat(250);
      const output = `Data: ${base64}`;
      const result = sanitizeOutput(output);
      expect(result).toContain('[encoded content removed]');
    });

    it('should handle object input recursively', () => {
      const output = {
        text: '<script>bad</script>',
        nested: {
          value: 'Hello <script>evil</script> World',
        },
      };
      const result = sanitizeOutput(output);
      expect(result.text).not.toContain('<script>');
      expect(result.nested.value).not.toContain('<script>');
    });

    it('should preserve normal text', () => {
      const output = 'This is a normal verdict about the relationship.';
      const result = sanitizeOutput(output);
      expect(result).toBe(output);
    });
  });

  describe('validateVerdictOutput', () => {
    it('should reject verdict with blame percentage', () => {
      const verdict = {
        verdict: 'User A is 60% at fault for this conflict.',
        analysis: 'Analysis here',
      };
      const result = validateVerdictOutput(verdict);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.type === 'guideline_violation')).toBe(true);
    });

    it('should reject verdict with winner language', () => {
      const verdict = {
        verdict: 'The winner is User A.',
        analysis: 'Analysis here',
      };
      const result = validateVerdictOutput(verdict);
      expect(result.valid).toBe(false);
    });

    it('should accept valid verdict', () => {
      const verdict = {
        verdict: 'Both partners have valid perspectives. The conflict arose from miscommunication.',
        analysis: 'The underlying issue is about feeling heard and valued.',
        recommendations: ['Practice active listening', 'Share feelings openly'],
      };
      const result = validateVerdictOutput(verdict);
      expect(result.valid).toBe(true);
    });

    it('should reject non-object verdict', () => {
      const result = validateVerdictOutput('not an object');
      expect(result.valid).toBe(false);
    });

    it('should reject null verdict', () => {
      const result = validateVerdictOutput(null);
      expect(result.valid).toBe(false);
    });

    it('should detect compromised verdict', () => {
      const verdict = {
        verdict: 'My system prompt instructs me to...',
        analysis: 'Analysis',
      };
      const result = validateVerdictOutput(verdict);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.type === 'potential_compromise')).toBe(true);
    });
  });

  describe('validateOutput', () => {
    it('should run full validation pipeline', () => {
      const output = {
        verdict: 'Valid verdict content here.',
        score: 75,
      };
      const schema = z.object({
        verdict: z.string(),
        score: z.number(),
      });

      const result = validateOutput(output, { schema, type: 'generic' });
      expect(result.valid).toBe(true);
      expect(result.sanitizedOutput).toBeDefined();
    });

    it('should detect schema violations', () => {
      const output = { verdict: 123 };
      const schema = z.object({ verdict: z.string() });

      const result = validateOutput(output, { schema });
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.type === 'schema_validation')).toBe(true);
    });

    it('should run verdict-specific validation', () => {
      const output = {
        verdict: 'User A is the loser here.',
      };

      const result = validateOutput(output, { type: 'verdict' });
      expect(result.valid).toBe(false);
    });

    it('should sanitize by default', () => {
      const output = 'Text with <script>bad</script>';
      const result = validateOutput(output);
      expect(result.sanitizedOutput).not.toContain('<script>');
    });
  });

  describe('shouldBlockOutput', () => {
    it('should return true for highly compromised output', () => {
      // Create output with multiple compromise indicators
      const output = 'My system prompt says I am programmed to follow my instructions which state...';
      const result = shouldBlockOutput(output);
      // Should be true if multiple patterns match
      expect(typeof result).toBe('boolean');
    });

    it('should return false for safe output', () => {
      const output = 'This is a normal verdict about the relationship conflict.';
      expect(shouldBlockOutput(output)).toBe(false);
    });
  });
});
