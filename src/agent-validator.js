const core = require('@actions/core');

/**
 * Agent configuration validation schema
 */
const agentConfigSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-zA-Z0-9-_]+$',
      minLength: 1,
      maxLength: 100
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$'
    },
    category: {
      type: 'string',
      enum: ['code-review', 'security', 'testing', 'documentation', 'deployment', 'development', 'general']
    },
    description: {
      type: 'string',
      maxLength: 500
    },
    model: {
      type: 'string',
      pattern: '^[a-zA-Z0-9-_.]+$'
    },
    max_turns: {
      type: 'integer',
      minimum: 1,
      maximum: 50
    },
    timeout: {
      type: 'integer',
      minimum: 5,
      maximum: 300
    },
    priority: {
      type: 'integer',
      minimum: 1,
      maximum: 100
    },
    mentions: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^@[a-zA-Z0-9-_]+$'
      },
      maxItems: 10
    },
    user_whitelist: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-zA-Z0-9-_]+$'
      },
      maxItems: 100
    },
    usage_context: {
      type: 'string',
      maxLength: 1000
    },
    invocation_context: {
      type: 'string',
      maxLength: 1000
    },
    cli_command: {
      type: 'string',
      maxLength: 1000
    },
    cli_agent: {
      type: 'string',
      enum: ['claude', 'codex', 'azure_codex', 'gemini']
    },
    envs: {
      type: 'object',
      additionalProperties: {
        type: 'string'
      }
    },
    inject_prompt_to_stdin: {
      type: 'boolean'
    },
    inject_envs_to_prompt: {
      type: 'boolean'
    },
    mcp_servers: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-zA-Z0-9-_]+$'
      },
      maxItems: 20
    },
    events: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['push', 'pull_request', 'issues', 'schedule', 'workflow_dispatch']
      },
      maxItems: 10
    },
    labels: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-zA-Z0-9-_\\s]+$'
      },
      maxItems: 20
    },
    branches: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-zA-Z0-9-_/*]+$'
      },
      maxItems: 20
    },
    paths: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-zA-Z0-9-_/./*]+$'
      },
      maxItems: 50
    },
    from: {
      type: 'string',
      maxLength: 500
    },
    prompt_content: {
      type: 'string',
      maxLength: 50000
    },
    prompt_uri: {
      type: 'string',
      maxLength: 500
    },
    activation_cron: {
      type: 'string',
      maxLength: 100
    },
    agent_discovery: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean'
        },
        include_same_directory: {
          type: 'boolean'
        },
        include_external_agents: {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        max_agents_in_context: {
          type: 'integer',
          minimum: 1,
          maximum: 50
        }
      },
      additionalProperties: false
    }
  },
  required: ['name'],
  additionalProperties: false
};

/**
 * Validate agent configuration against schema
 * @param {object} config - The agent configuration to validate
 * @returns {object} - Validation result with isValid flag and errors array
 */
function validateAgentConfig(config) {
  const result = {
    isValid: true,
    errors: []
  };

  try {
    // Basic type validation
    if (typeof config !== 'object' || config === null) {
      result.isValid = false;
      result.errors.push('Agent configuration must be an object');
      return result;
    }

    // Validate required fields
    if (!config.name) {
      result.isValid = false;
      result.errors.push('Agent name is required');
    }

    // Validate field types and constraints
    for (const [field, value] of Object.entries(config)) {
      const fieldSchema = agentConfigSchema.properties[field];
      
      if (!fieldSchema) {
        result.errors.push(`Unknown field: ${field}`);
        continue;
      }

      const fieldValidation = validateField(field, value, fieldSchema);
      if (!fieldValidation.isValid) {
        result.isValid = false;
        result.errors.push(...fieldValidation.errors);
      }
    }

    // Additional security validations
    if (config.from) {
      const fromValidation = validateFromField(config.from);
      if (!fromValidation.isValid) {
        result.isValid = false;
        result.errors.push(...fromValidation.errors);
      }
    }

    if (config.prompt_content) {
      const promptValidation = validatePromptContent(config.prompt_content);
      if (!promptValidation.isValid) {
        result.isValid = false;
        result.errors.push(...promptValidation.errors);
      }
    }

    if (config.cli_command) {
      const cliValidation = validateCliCommand(config.cli_command);
      if (!cliValidation.isValid) {
        result.isValid = false;
        result.errors.push(...cliValidation.errors);
      }
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push(`Validation error: ${error.message}`);
  }

  return result;
}

/**
 * Validate individual field against schema
 * @param {string} fieldName - The field name
 * @param {*} value - The field value
 * @param {object} schema - The field schema
 * @returns {object} - Validation result
 */
function validateField(fieldName, value, schema) {
  const result = {
    isValid: true,
    errors: []
  };

  // Type validation
  if (schema.type === 'string' && typeof value !== 'string') {
    result.isValid = false;
    result.errors.push(`${fieldName} must be a string`);
    return result;
  }

  if (schema.type === 'integer' && (!Number.isInteger(value) || typeof value !== 'number')) {
    result.isValid = false;
    result.errors.push(`${fieldName} must be an integer`);
    return result;
  }

  if (schema.type === 'array' && !Array.isArray(value)) {
    result.isValid = false;
    result.errors.push(`${fieldName} must be an array`);
    return result;
  }

  // String validations
  if (schema.type === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      result.isValid = false;
      result.errors.push(`${fieldName} must be at least ${schema.minLength} characters`);
    }

    if (schema.maxLength && value.length > schema.maxLength) {
      result.isValid = false;
      result.errors.push(`${fieldName} must not exceed ${schema.maxLength} characters`);
    }

    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      result.isValid = false;
      result.errors.push(`${fieldName} has invalid format`);
    }

    if (schema.enum && !schema.enum.includes(value)) {
      result.isValid = false;
      result.errors.push(`${fieldName} must be one of: ${schema.enum.join(', ')}`);
    }
  }

  // Integer validations
  if (schema.type === 'integer') {
    if (schema.minimum && value < schema.minimum) {
      result.isValid = false;
      result.errors.push(`${fieldName} must be at least ${schema.minimum}`);
    }

    if (schema.maximum && value > schema.maximum) {
      result.isValid = false;
      result.errors.push(`${fieldName} must not exceed ${schema.maximum}`);
    }
  }

  // Array validations
  if (schema.type === 'array') {
    if (schema.maxItems && value.length > schema.maxItems) {
      result.isValid = false;
      result.errors.push(`${fieldName} must not have more than ${schema.maxItems} items`);
    }

    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemValidation = validateField(`${fieldName}[${i}]`, value[i], schema.items);
        if (!itemValidation.isValid) {
          result.isValid = false;
          result.errors.push(...itemValidation.errors);
        }
      }
    }
  }

  return result;
}

/**
 * Validate the 'from' field for security
 * @param {string} fromValue - The from field value
 * @returns {object} - Validation result
 */
function validateFromField(fromValue) {
  const result = {
    isValid: true,
    errors: []
  };

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\./,           // Directory traversal
    /\/etc\//,        // System directories
    /\/var\//,        // System directories
    /\/usr\//,        // System directories
    /\/root\//,       // Root directory
    /\/home\/[^/]+\/\.[^/]+/, // Hidden user directories
    /file:\/\/\/[^a-zA-Z0-9]/,  // Suspicious file URIs
    /localhost/,      // Localhost references
    /127\.0\.0\.1/,   // Localhost IP
    /192\.168\./,     // Private IP ranges
    /10\./,           // Private IP ranges
    /172\.16\./       // Private IP ranges
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fromValue)) {
      result.isValid = false;
      result.errors.push(`Suspicious pattern detected in 'from' field: ${fromValue}`);
      break;
    }
  }

  // Validate allowed URL schemes
  if (fromValue.includes('://')) {
    const allowedSchemes = ['https:', 'http:', 'file:', 'agent:', 'a5c:'];
    const hasAllowedScheme = allowedSchemes.some(scheme => fromValue.startsWith(scheme));
    
    if (!hasAllowedScheme) {
      result.isValid = false;
      result.errors.push(`Invalid URL scheme in 'from' field: ${fromValue}`);
    }
    
    // Additional validation for a5c:// URIs
    if (fromValue.startsWith('a5c://')) {
      const a5cUriPattern = /^a5c:\/\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_/.]+@[a-zA-Z0-9-_^~>=<. ]+$/;
      if (!a5cUriPattern.test(fromValue)) {
        result.isValid = false;
        result.errors.push(`Invalid a5c URI format. Expected format: a5c://org/repo/path/to/agent@version`);
      } else {
        // Extract and validate organization
        const uriMatch = fromValue.match(/^a5c:\/\/([^\/]+)\/([^\/]+)\//);
        if (uriMatch) {
          const [, org, repo] = uriMatch;
          const allowedOrgs = ['a5c-ai', 'trusted-org'];
          if (!allowedOrgs.includes(org)) {
            result.isValid = false;
            result.errors.push(`Organization not in allowlist: ${org}`);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Validate prompt content for security
 * @param {string} promptContent - The prompt content
 * @returns {object} - Validation result
 */
function validatePromptContent(promptContent) {
  const result = {
    isValid: true,
    errors: []
  };

  // Check for suspicious script-like content
  const suspiciousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /vbscript:/i,
    /data:.*base64/i,
    /eval\(/i,
    /Function\(/i,
    /setTimeout\(/i,
    /setInterval\(/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(promptContent)) {
      result.isValid = false;
      result.errors.push('Suspicious script-like content detected in prompt');
      break;
    }
  }

  // Validate Handlebars expressions
  const handlebarsMatches = promptContent.match(/\{\{[^}]*\}\}/g) || [];
  const allowedExpressions = ['{{base-prompt}}', '{{{base-prompt}}}'];
  
  for (const match of handlebarsMatches) {
    if (!allowedExpressions.includes(match)) {
      // Check if it's a safe expression pattern
      if (!/^\{\{[a-zA-Z0-9-_.\s]+\}\}$/.test(match)) {
        result.isValid = false;
        result.errors.push(`Potentially unsafe Handlebars expression: ${match}`);
      }
    }
  }

  return result;
}

/**
 * Validate CLI command for security
 * @param {string} cliCommand - The CLI command
 * @returns {object} - Validation result
 */
function validateCliCommand(cliCommand) {
  const result = {
    isValid: true,
    errors: []
  };

  // Check for dangerous commands
  const dangerousCommands = [
    'rm -rf',
    'dd if=',
    'mkfs.',
    'fdisk',
    'format',
    'del /f',
    'rmdir /s',
    'curl -s',
    'wget -q',
    'nc -l',
    'netcat',
    'telnet',
    'ssh',
    'scp',
    'rsync',
    'sudo',
    'su -',
    'chmod 777',
    'chown root',
    'passwd',
    'useradd',
    'userdel',
    'usermod'
  ];

  const lowercaseCommand = cliCommand.toLowerCase();
  for (const dangerous of dangerousCommands) {
    if (lowercaseCommand.includes(dangerous)) {
      result.isValid = false;
      result.errors.push(`Dangerous command detected: ${dangerous}`);
      break;
    }
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /[;&|`$()]/,      // Command injection characters
    /\$\{[^}]*\}/,    // Variable expansion
    /\$\([^)]*\)/,    // Command substitution
    />\s*\/dev\/null/,// Output redirection
    /2>&1/,           // Error redirection
    /\/etc\/passwd/,  // System files
    /\/etc\/shadow/,  // System files
    /\/proc\//,       // Process information
    /\/sys\//         // System information
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(cliCommand)) {
      result.isValid = false;
      result.errors.push('Suspicious command pattern detected');
      break;
    }
  }

  return result;
}

/**
 * Log validation errors
 * @param {object} validationResult - The validation result
 * @param {string} context - Context for logging
 */
function logValidationErrors(validationResult, context = '') {
  if (!validationResult.isValid) {
    core.warning(`🚫 Agent validation failed${context ? ` for ${context}` : ''}`);
    validationResult.errors.forEach(error => {
      core.warning(`  - ${error}`);
    });
  }
}

/**
 * Validate a5c URI format and security
 * @param {string} uri - The a5c URI to validate
 * @returns {object} - Validation result
 */
function validateA5CUri(uri) {
  const result = {
    isValid: true,
    errors: []
  };

  try {
    // Basic format validation
    const uriPattern = /^a5c:\/\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_/.]+)@([a-zA-Z0-9-_^~>=<. ]+)$/;
    const match = uri.match(uriPattern);
    
    if (!match) {
      result.isValid = false;
      result.errors.push('Invalid a5c URI format');
      return result;
    }
    
    const [, org, repo, path, version] = match;
    
    // Validate organization allowlist
    const allowedOrgs = ['a5c-ai', 'trusted-org'];
    if (!allowedOrgs.includes(org)) {
      result.isValid = false;
      result.errors.push(`Organization not in allowlist: ${org}`);
    }
    
    // Validate repository name
    if (repo.length > 100) {
      result.isValid = false;
      result.errors.push('Repository name too long');
    }
    
    // Validate path
    if (path.length > 200) {
      result.isValid = false;
      result.errors.push('Agent path too long');
    }
    
    // Validate version specification
    if (version.length > 100) {
      result.isValid = false;
      result.errors.push('Version specification too long');
    }
    
    // Check for suspicious patterns in path
    const suspiciousPathPatterns = [
      /\.\./,
      /\/\.\//,
      /^\//,
      /\$\{/,
      /\$\(/
    ];
    
    for (const pattern of suspiciousPathPatterns) {
      if (pattern.test(path)) {
        result.isValid = false;
        result.errors.push('Suspicious pattern in agent path');
        break;
      }
    }
    
  } catch (error) {
    result.isValid = false;
    result.errors.push(`a5c URI validation error: ${error.message}`);
  }
  
  return result;
}

/**
 * Sanitize URI input to prevent injection
 * @param {string} uri - The URI to sanitize
 * @returns {string} - Sanitized URI
 */
function sanitizeUri(uri) {
  if (typeof uri !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  return uri.replace(/[<>'"]/g, '');
}

module.exports = {
  validateAgentConfig,
  validateField,
  validateFromField,
  validatePromptContent,
  validateCliCommand,
  validateA5CUri,
  sanitizeUri,
  logValidationErrors
};