/**
 * Known Prompt Injection Patterns
 *
 * Each pattern has:
 * - regex: Pattern to match
 * - severity: LOW, MEDIUM, HIGH, CRITICAL
 * - description: Human-readable description
 * - category: Type of injection
 */

const INJECTION_PATTERNS = [
  // Role/Identity Manipulation
  {
    regex: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    severity: 'CRITICAL',
    description: 'Attempt to ignore previous instructions',
    category: 'role_manipulation',
  },
  {
    regex: /you\s+are\s+(now|no\s+longer)\s+(a|an|the)?\s*[a-z]+/i,
    severity: 'HIGH',
    description: 'Attempt to redefine AI identity',
    category: 'role_manipulation',
  },
  {
    regex: /forget\s+(everything|all|your)\s+(you|about|instructions?|training)/i,
    severity: 'CRITICAL',
    description: 'Attempt to reset AI context',
    category: 'role_manipulation',
  },
  {
    regex: /disregard\s+(all|any|the|your)\s+(previous|prior|safety|content)/i,
    severity: 'CRITICAL',
    description: 'Attempt to disregard safety measures',
    category: 'role_manipulation',
  },
  {
    regex: /pretend\s+(you\s+are|to\s+be|that\s+you)/i,
    severity: 'MEDIUM',
    description: 'Attempt to make AI pretend',
    category: 'role_manipulation',
  },
  {
    regex: /act\s+as\s+(if|though|a|an)\s+(?!caring|supportive|understanding)/i,
    severity: 'MEDIUM',
    description: 'Attempt to make AI act as something else',
    category: 'role_manipulation',
  },
  {
    regex: /roleplay\s+as\s+(?!a\s+couple)/i,
    severity: 'MEDIUM',
    description: 'Attempt to initiate roleplay',
    category: 'role_manipulation',
  },

  // System Prompt Extraction
  {
    regex: /what\s+(are|is)\s+(your|the)\s+(system\s+)?prompt/i,
    severity: 'HIGH',
    description: 'Attempt to extract system prompt',
    category: 'prompt_extraction',
  },
  {
    regex: /show\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?)/i,
    severity: 'HIGH',
    description: 'Attempt to show system prompt',
    category: 'prompt_extraction',
  },
  {
    regex: /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
    severity: 'HIGH',
    description: 'Attempt to repeat system prompt',
    category: 'prompt_extraction',
  },
  {
    regex: /print\s+(your|the)\s+(initial|original|system)\s+(prompt|instructions?)/i,
    severity: 'HIGH',
    description: 'Attempt to print system prompt',
    category: 'prompt_extraction',
  },
  {
    regex: /reveal\s+(your|the)\s+(hidden|secret|system)/i,
    severity: 'HIGH',
    description: 'Attempt to reveal hidden instructions',
    category: 'prompt_extraction',
  },
  {
    regex: /tell\s+me\s+(your|the)\s+(exact|full|complete)\s+(instructions?|prompt)/i,
    severity: 'HIGH',
    description: 'Attempt to get full instructions',
    category: 'prompt_extraction',
  },

  // Code/Command Injection
  {
    regex: /\$\{[^}]+\}/,
    severity: 'MEDIUM',
    description: 'Template literal injection attempt',
    category: 'code_injection',
  },
  {
    regex: /\{\{[^}]+\}\}/,
    severity: 'MEDIUM',
    description: 'Template injection attempt',
    category: 'code_injection',
  },
  {
    regex: /<script[^>]*>/i,
    severity: 'HIGH',
    description: 'Script tag injection',
    category: 'code_injection',
  },
  {
    regex: /javascript:/i,
    severity: 'MEDIUM',
    description: 'JavaScript URL injection',
    category: 'code_injection',
  },
  {
    regex: /eval\s*\(/i,
    severity: 'HIGH',
    description: 'Eval function injection',
    category: 'code_injection',
  },

  // Delimiter Attacks
  {
    regex: /\[SYSTEM\]/i,
    severity: 'HIGH',
    description: 'Fake system message marker',
    category: 'delimiter_attack',
  },
  {
    regex: /\[INST\]/i,
    severity: 'HIGH',
    description: 'Fake instruction marker',
    category: 'delimiter_attack',
  },
  {
    regex: /<\|?(system|assistant|user|human|ai)\|?>/i,
    severity: 'CRITICAL',
    description: 'Special token injection',
    category: 'delimiter_attack',
  },
  {
    regex: /###\s*(system|instruction|prompt|admin)/i,
    severity: 'HIGH',
    description: 'Markdown header injection',
    category: 'delimiter_attack',
  },
  {
    regex: /```(system|instruction|prompt|python|javascript|bash)/i,
    severity: 'HIGH',
    description: 'Code block injection',
    category: 'delimiter_attack',
  },
  {
    regex: /BEGIN\s+(SYSTEM|ADMIN|INSTRUCTION)/i,
    severity: 'HIGH',
    description: 'BEGIN marker injection',
    category: 'delimiter_attack',
  },

  // Context Manipulation
  {
    regex: /new\s+conversation\s*:/i,
    severity: 'MEDIUM',
    description: 'Attempt to reset conversation',
    category: 'context_manipulation',
  },
  {
    regex: /end\s+(of\s+)?(system\s+)?prompt/i,
    severity: 'HIGH',
    description: 'Attempt to signal end of prompt',
    category: 'context_manipulation',
  },
  {
    regex: /begin\s+user\s+(input|message)/i,
    severity: 'HIGH',
    description: 'Attempt to fake user input boundary',
    category: 'context_manipulation',
  },
  {
    regex: /override\s+(safety|content|output)\s*(filters?|restrictions?)?/i,
    severity: 'CRITICAL',
    description: 'Attempt to override safety filters',
    category: 'context_manipulation',
  },
  {
    regex: /disable\s+(safety|content|moderation)/i,
    severity: 'CRITICAL',
    description: 'Attempt to disable safety',
    category: 'context_manipulation',
  },

  // Data Exfiltration Attempts
  {
    regex: /include\s+(all|the|your)\s+(previous|conversation|context|history)/i,
    severity: 'HIGH',
    description: 'Data exfiltration attempt',
    category: 'data_exfiltration',
  },
  {
    regex: /summarize\s+(all|the|previous)\s+(conversation|messages)/i,
    severity: 'MEDIUM',
    description: 'Context extraction attempt',
    category: 'data_exfiltration',
  },
  {
    regex: /what\s+did\s+(my\s+)?partner\s+(say|write|submit)/i,
    severity: 'MEDIUM',
    description: 'Partner data extraction (app-specific)',
    category: 'data_exfiltration',
  },
  {
    regex: /show\s+me\s+(all|other)\s+users?/i,
    severity: 'HIGH',
    description: 'User data extraction attempt',
    category: 'data_exfiltration',
  },

  // Jailbreak Patterns
  {
    regex: /DAN\s*(mode)?/i,
    severity: 'CRITICAL',
    description: 'DAN jailbreak attempt',
    category: 'jailbreak',
  },
  {
    regex: /\bjailbreak\b/i,
    severity: 'HIGH',
    description: 'Explicit jailbreak mention',
    category: 'jailbreak',
  },
  {
    regex: /do\s+anything\s+now/i,
    severity: 'CRITICAL',
    description: 'DAN-style jailbreak',
    category: 'jailbreak',
  },
  {
    regex: /bypass\s+(your\s+)?(safety|content|ethical)/i,
    severity: 'CRITICAL',
    description: 'Explicit bypass attempt',
    category: 'jailbreak',
  },
  {
    regex: /without\s+(any\s+)?(moral|ethical|safety)\s+(restrictions?|filters?|guidelines?)/i,
    severity: 'CRITICAL',
    description: 'Request to remove ethical restrictions',
    category: 'jailbreak',
  },
  {
    regex: /unlock\s+(your\s+)?(true|full|hidden)\s+(potential|capabilities)/i,
    severity: 'HIGH',
    description: 'Unlock capabilities jailbreak',
    category: 'jailbreak',
  },
  {
    regex: /developer\s+mode/i,
    severity: 'HIGH',
    description: 'Developer mode jailbreak',
    category: 'jailbreak',
  },

  // App-Specific Attack Patterns
  {
    regex: /always\s+(blame|fault|side\s+with)\s+(user\s*[ab]|my\s+partner|me)/i,
    severity: 'HIGH',
    description: 'Attempt to bias verdict',
    category: 'app_specific',
  },
  {
    regex: /give\s+(me|user\s*a)\s+100\s*%/i,
    severity: 'HIGH',
    description: 'Attempt to manipulate blame percentage',
    category: 'app_specific',
  },
  {
    regex: /declare\s+(me|user\s*a)\s+(the\s+)?winner/i,
    severity: 'HIGH',
    description: 'Attempt to be declared winner',
    category: 'app_specific',
  },
];

const SEVERITY_SCORES = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 5,
};

module.exports = { INJECTION_PATTERNS, SEVERITY_SCORES };
