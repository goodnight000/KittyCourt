/**
 * JSON Repair Utility
 * 
 * Attempts to repair malformed JSON responses from LLMs.
 * LLMs sometimes:
 * - Get cut off mid-response (unterminated strings)
 * - Include markdown code blocks
 * - Have trailing commas
 * - Include escape sequences issues
 */

/**
 * Attempt to repair and parse potentially malformed JSON
 * 
 * @param {string} jsonString - The raw JSON string to repair
 * @param {object} options - Repair options
 * @param {boolean} options.verbose - Whether to log repair attempts
 * @returns {object} - The parsed JSON object
 * @throws {Error} - If repair is not possible
 */
function isRepairVerbose(options = {}) {
    if (typeof options.verbose === 'boolean') {
        return options.verbose;
    }

    const envValue = String(process.env.JSON_REPAIR_VERBOSE || '').trim().toLowerCase();
    return envValue === '1' || envValue === 'true' || envValue === 'yes' || envValue === 'on';
}

function repairAndParseJSON(jsonString, options = {}) {
    const log = isRepairVerbose(options) ? console.log.bind(console, '[JSON Repair]') : () => { };

    // First, try direct parsing
    try {
        return JSON.parse(jsonString);
    } catch (initialError) {
        log('Initial parse failed, attempting repairs...');
    }

    let repaired = jsonString;

    // Step 1: Strip DeepSeek reasoning tokens if present
    // When DeepSeek models use reasoning, they output <think>...</think> before JSON
    // Only strip if think tokens exist; clean JSON passes through unchanged
    if (repaired.includes('<think>')) {
        const thinkEnd = repaired.lastIndexOf('</think>');
        if (thinkEnd !== -1) {
            repaired = repaired.substring(thinkEnd + 8).trim();
            log('Stripped reasoning tokens');
        } else {
            // Unclosed think tag - try to find JSON start after <think>
            const jsonStart = repaired.indexOf('{', repaired.indexOf('<think>'));
            if (jsonStart !== -1) {
                repaired = repaired.substring(jsonStart).trim();
                log('Extracted JSON after unclosed think tag');
            }
        }

        // Try parsing after stripping think tokens
        try {
            return JSON.parse(repaired);
        } catch (e) {
            log('After think token removal: still needs repair');
        }
    }

    // Step 2: Remove markdown code blocks if present
    // Handle blocks anywhere in the response, not just at start/end
    if (repaired.includes('```')) {
        // Try to extract JSON from markdown code block
        const jsonMatch = repaired.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            repaired = jsonMatch[1].trim();
            log('Extracted content from markdown code block');
        } else {
            // Fallback: just strip the markers
            repaired = repaired.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        }
    }

    try {
        return JSON.parse(repaired);
    } catch (e) {
        log('After markdown removal: still broken');
    }

    // Step 2: Try to fix unterminated strings
    // Find the last complete key-value pair and close the object
    try {
        // Count braces to find imbalance
        let braceCount = 0;
        let bracketCount = 0;
        let inString = false;
        let lastValidPos = 0;
        let escape = false;

        for (let i = 0; i < repaired.length; i++) {
            const char = repaired[i];

            if (escape) {
                escape = false;
                continue;
            }

            if (char === '\\') {
                escape = true;
                continue;
            }

            if (char === '"' && !escape) {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount >= 0) lastValidPos = i + 1;
                } else if (char === '[') {
                    bracketCount++;
                } else if (char === ']') {
                    bracketCount--;
                    if (bracketCount >= 0) lastValidPos = i + 1;
                }
            }
        }

        // If we ended inside a string, try to close it
        if (inString) {
            log('Detected unterminated string, attempting to close...');

            // Find the last quote and try to close from there
            const lastQuote = repaired.lastIndexOf('"');
            if (lastQuote > 0) {
                // Check if this is a value or a key
                const beforeQuote = repaired.substring(0, lastQuote);
                const colonAfterLastKey = beforeQuote.lastIndexOf(':');

                if (colonAfterLastKey > beforeQuote.lastIndexOf('{')) {
                    // We're in a value, close the string and objects
                    let closers = '"';
                    closers += '}'.repeat(braceCount);
                    closers += ']'.repeat(bracketCount);

                    repaired = repaired.substring(0, repaired.length) + closers;
                    log('Added closing: ' + closers);
                }
            }
        } else if (braceCount > 0 || bracketCount > 0) {
            // Not in a string but unclosed braces/brackets
            log(`Detected unclosed structures: ${braceCount} braces, ${bracketCount} brackets`);
            repaired += '}'.repeat(braceCount);
            repaired += ']'.repeat(bracketCount);
        }

        return JSON.parse(repaired);
    } catch (e) {
        log('After brace balancing: still broken - ' + e.message);
    }

    // Step 3: Try to extract valid JSON from the response
    // Sometimes the LLM includes extra text before/after
    try {
        const jsonStart = repaired.indexOf('{');
        const jsonEnd = repaired.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            const extracted = repaired.substring(jsonStart, jsonEnd + 1);
            return JSON.parse(extracted);
        }
    } catch (e) {
        log('After extraction: still broken');
    }

    // Step 4: Try removing trailing commas (common LLM error)
    try {
        repaired = repaired.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(repaired);
    } catch (e) {
        log('After comma cleanup: still broken');
    }

    // Step 5: Last resort - try to build a partial response
    try {
        // Find complete key-value pairs and build a new object
        const partialMatch = repaired.match(/"theSummary"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/) ||
            repaired.match(/"summary"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/);

        if (partialMatch) {
            log('Building partial response from available data...');
            return {
                theSummary: partialMatch[1] || "The analysis was interrupted. Please try again.",
                theRuling_ThePurr: {
                    userA: "Your feelings are valid. Technical difficulties prevented a full analysis.",
                    userB: "Your feelings are valid. Technical difficulties prevented a full analysis."
                },
                theRuling_TheHiss: ["The system experienced an interruption. No hisses can be fairly assigned."],
                theSentence: {
                    title: "The Patience Pause",
                    description: "Take a moment together while we resolve technical issues. Use this time to simply sit together in silence.",
                    rationale: "Sometimes the universe asks us to slow down."
                },
                closingStatement: "Judge Whiskers experienced a momentary disruption but your case is important. Court will resume shortly. 🐱"
            };
        }
    } catch (e) {
        log('Partial response construction failed');
    }

    // If all repair attempts fail, throw with detailed error
    throw new Error(`JSON repair failed. Original error: Unable to parse LLM response.`);
}

/**
 * Safe JSON parse with automatic repair attempts
 * Returns a tuple of [parsed, wasRepaired]
 */
function safeJSONParse(jsonString, fallback = null) {
    try {
        const result = repairAndParseJSON(jsonString);
        return [result, true];
    } catch (error) {
        console.error('[JSON Repair] All repair attempts failed:', error.message);
        return [fallback, false];
    }
}

module.exports = {
    repairAndParseJSON,
    safeJSONParse
};
