/**
 * JSON Schema Definitions for Judge Engine v2.0
 *
 * Generated from Zod schemas to keep validation in one place.
 */

const { zodToJsonSchema } = require('zod-to-json-schema');
const {
    AnalystRepairOutputSchema,
    PrimingJointOutputSchema,
    HybridResolutionOutputSchema,
} = require('./schemas');

const RESPONSE_DESCRIPTION = 'All narrative strings must be in the requested language. Keep enum values and IDs in English.';

function buildJsonSchema(schema, name, description = RESPONSE_DESCRIPTION) {
    return {
        name,
        strict: true,
        schema: {
            ...zodToJsonSchema(schema, { $refStrategy: 'none' }),
            description,
        },
    };
}

const ANALYST_REPAIR_JSON_SCHEMA = buildJsonSchema(
    AnalystRepairOutputSchema,
    'analyst_repair_output'
);

const PRIMING_JOINT_JSON_SCHEMA = buildJsonSchema(
    PrimingJointOutputSchema,
    'priming_joint_output'
);

const HYBRID_RESOLUTION_JSON_SCHEMA = buildJsonSchema(
    HybridResolutionOutputSchema,
    'hybrid_resolution_output'
);

module.exports = {
    ANALYST_REPAIR_JSON_SCHEMA,
    PRIMING_JOINT_JSON_SCHEMA,
    HYBRID_RESOLUTION_JSON_SCHEMA,
};
