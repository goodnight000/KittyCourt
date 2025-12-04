/**
 * OpenAI Client Configuration
 * Centralized OpenAI client instance for the Judge Engine
 * 
 * Uses lazy initialization to avoid errors when API key is not configured
 */

const OpenAI = require('openai');

let _openai = null;

/**
 * Get the OpenAI client instance
 * Lazily initialized to avoid startup errors when key is not set
 * 
 * @returns {OpenAI} The OpenAI client instance
 * @throws {Error} If OPENAI_API_KEY is not configured
 */
function getOpenAI() {
    if (!_openai) {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
            throw new Error('OPENAI_API_KEY is not configured. Judge Whiskers needs an API key to function.');
        }
        _openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return _openai;
}

/**
 * Check if OpenAI is configured
 * @returns {boolean}
 */
function isOpenAIConfigured() {
    return process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';
}

module.exports = { getOpenAI, isOpenAIConfigured };
