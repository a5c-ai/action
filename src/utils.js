const core = require('@actions/core');
const github = require('@actions/github');

// Common utility functions for the A5C Runner Github Action 

/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse frontmatter from markdown content
 * @param {string} content - The markdown content
 * @returns {object} - Parsed frontmatter and body
 */
function parseFrontmatter(content) {
  const lines = content.split('\n');
  const frontmatter = {};
  let body = '';
  let inFrontmatter = false;
  let frontmatterEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '---' && !inFrontmatter) {
      inFrontmatter = true;
      continue;
    }
    
    if (line === '---' && inFrontmatter) {
      inFrontmatter = false;
      frontmatterEnd = i;
      break;
    }
    
    if (inFrontmatter) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        let cleanValue = value;
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          cleanValue = value.slice(1, -1);
        }
        frontmatter[key.trim()] = cleanValue;
      }
    }
  }

  // Extract body content
  if (frontmatterEnd !== -1) {
    body = lines.slice(frontmatterEnd + 1).join('\n').trim();
  } else {
    body = content;
  }

  return { attributes: frontmatter, body };
}

/**
 * Extract changed files from GitHub context
 * @param {object} context - GitHub context object
 * @returns {string[]} - Array of changed file paths
 */
function getChangedFiles(context = github.context) {
  const { payload } = context;
  const changedFiles = [];

  try {
    // For push events
    if (payload.head_commit) {
      changedFiles.push(...(payload.head_commit.added || []));
      changedFiles.push(...(payload.head_commit.modified || []));
    }

    // For push events with multiple commits
    if (payload.commits && Array.isArray(payload.commits)) {
      for (const commit of payload.commits) {
        changedFiles.push(...(commit.added || []));
        changedFiles.push(...(commit.modified || []));
      }
    }

    // For pull request events
    if (payload.pull_request) {
      // Note: This would need additional API calls to get PR file changes
      // For now, we'll use what's available in the payload
      if (payload.pull_request.changed_files) {
        changedFiles.push(...payload.pull_request.changed_files);
      }
    }

    // Remove duplicates
    return [...new Set(changedFiles)];
  } catch (error) {
    core.warning(`Error getting changed files: ${error.message}`);
    return [];
  }
}

/**
 * Check if a file is a code file based on extension
 * @param {string} filePath - The file path
 * @returns {boolean} - True if it's a code file
 */
function isCodeFile(filePath) {
  const codeExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.php',
    '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.clj', '.elm', '.ex',
    '.dart', '.lua', '.pl', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.r',
    '.m', '.mm', '.h', '.hpp', '.hxx', '.cc', '.cxx', '.asm', '.s', '.sql',
    '.html', '.htm', '.css', '.scss', '.sass', '.less', '.xml', '.json',
    '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.md', '.mdx',
    '.vue', '.svelte', '.astro', '.dockerfile', '.makefile', '.cmake'
  ];

  const ext = filePath.toLowerCase().split('.').pop();
  return codeExtensions.includes(`.${ext}`);
}

/**
 * Extract mentions from text
 * @param {string} text - The text to search
 * @param {string[]} mentionPatterns - Array of mention patterns to look for
 * @returns {object[]} - Array of mention objects with pattern and position
 */
function extractMentions(text, mentionPatterns) {
  const mentions = [];
  
  for (const pattern of mentionPatterns) {
    const regex = new RegExp(pattern, 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      mentions.push({
        pattern: pattern,
        match: match[0],
        index: match.index,
        input: text
      });
    }
  }
  
  // Sort by position
  mentions.sort((a, b) => a.index - b.index);
  
  return mentions;
}

/**
 * Validate cron expression
 * @param {string} cronExpression - The cron expression to validate
 * @returns {boolean} - True if valid
 */
function validateCronExpression(cronExpression) {
  if (!cronExpression || typeof cronExpression !== 'string') {
    return false;
  }
  
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    return false;
  }
  
  // Basic validation for each field
  const [minute, hour, day, month, weekday] = parts;
  
  return validateCronField(minute, 0, 59) &&
         validateCronField(hour, 0, 23) &&
         validateCronField(day, 1, 31) &&
         validateCronField(month, 1, 12) &&
         validateCronField(weekday, 0, 6);
}

/**
 * Validate individual cron field
 * @param {string} field - The cron field to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} - True if valid
 */
function validateCronField(field, min, max) {
  if (field === '*') return true;
  
  // Handle ranges
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return !isNaN(start) && !isNaN(end) && 
           start >= min && start <= max &&
           end >= min && end <= max &&
           start <= end;
  }
  
  // Handle lists
  if (field.includes(',')) {
    const values = field.split(',').map(Number);
    return values.every(v => !isNaN(v) && v >= min && v <= max);
  }
  
  // Handle step values
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepValue = Number(step);
    return !isNaN(stepValue) && stepValue > 0 && stepValue <= max &&
           (range === '*' || validateCronField(range, min, max));
  }
  
  // Exact value
  const value = Number(field);
  return !isNaN(value) && value >= min && value <= max;
}

/**
 * Safe JSON parse with default value
 * @param {string} jsonString - The JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} - Parsed value or default
 */
function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    core.warning(`Invalid JSON: ${error.message}`);
    return defaultValue;
  }
}

/**
 * Deep merge two objects
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} - Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (Array.isArray(source[key])) {
        // For arrays, merge and remove duplicates
        const targetArray = Array.isArray(result[key]) ? result[key] : [];
        result[key] = [...new Set([...targetArray, ...source[key]])];
      } else if (typeof source[key] === 'object' && source[key] !== null) {
        // For objects, recursively merge
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        // For primitives, override
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

/**
 * Sanitize string for use as identifier
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeId(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format execution time in human-readable format
 * @param {number} milliseconds - Execution time in milliseconds
 * @returns {string} - Formatted time string
 */
function formatExecutionTime(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Extract repository info from GitHub context
 * @param {object} context - GitHub context object
 * @returns {object} - Repository information
 */
function getRepositoryInfo(context = github.context) {
  return {
    owner: context.repo.owner,
    name: context.repo.repo,
    fullName: `${context.repo.owner}/${context.repo.repo}`,
    branch: context.ref.replace('refs/heads/', ''),
    sha: context.sha,
    eventName: context.eventName,
    actor: context.actor,
    workflow: context.workflow,
    runId: context.runId,
    runNumber: context.runNumber
  };
}

module.exports = {
  delay,
  parseFrontmatter,
  getChangedFiles,
  isCodeFile,
  extractMentions,
  validateCronExpression,
  validateCronField,
  safeJsonParse,
  deepMerge,
  sanitizeId,
  formatExecutionTime,
  getRepositoryInfo
}; 