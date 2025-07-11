# Security Review: Agent Inheritance Feature

**Review Date:** 2025-07-11  
**Reviewer:** advanced-security-reviewer  
**Commit:** 7b6c84e97c0a66151069efe42e064a878a54aed6  

## Executive Summary

This security review analyzes the recently implemented agent inheritance feature in the A5C Runner GitHub Action. The feature introduces powerful extensibility capabilities but also presents several security considerations that require attention.

## Feature Overview

The agent inheritance feature allows agents to inherit configuration and prompts from parent agents using the `from` field, supporting:
- Multi-level inheritance chains
- Remote agent loading (HTTP/HTTPS)
- Local file system access
- GitHub repository integration
- Circular inheritance detection

## Security Analysis

### 🔴 High Priority Security Issues

#### 1. Insufficient URL Validation (High Risk)
**Location:** `src/resource-handler.js:170-179`
```javascript
_isGitHubUrl(url) {
  // Only checks for github.com and basic hostname patterns
  return urlObj.hostname === 'github.com' || 
         urlObj.hostname === 'raw.githubusercontent.com' ||
         urlObj.hostname.includes('github');
}
```

**Risk:** Lack of URL allowlisting could enable:
- Server-Side Request Forgery (SSRF) attacks
- Data exfiltration to external domains
- Potential access to internal network resources

**Impact:** Attackers could potentially load malicious agent configurations from arbitrary URLs.

#### 2. Directory Traversal Vulnerability (High Risk)
**Location:** `src/agent-loader.js:250-277`
```javascript
} else if (fromSpec.includes('/') || fromSpec.includes('\\')) {
  // File path - NO PATH SANITIZATION
  if (!fs.existsSync(fromSpec)) {
    throw new Error(`Base agent file not found: ${fromSpec}`);
  }
  baseAgentContent = fs.readFileSync(fromSpec, 'utf8');
}
```

**Risk:** Unsanitized file paths could allow:
- Directory traversal attacks (`../../../etc/passwd`)
- Access to sensitive system files
- Potential information disclosure

**Impact:** Attackers could read arbitrary files on the system.

#### 3. Lack of Content Validation (Medium Risk)
**Location:** Throughout agent loading pipeline
- No schema validation for loaded agent configurations
- No sanitization of prompt content
- No validation of configuration values

**Risk:** Malicious agent configurations could:
- Inject harmful prompts
- Override critical security settings
- Bypass safety mechanisms

### 🟡 Medium Priority Security Issues

#### 4. Weak GitHub URL Detection (Medium Risk)
**Location:** `src/resource-handler.js:175`
```javascript
urlObj.hostname.includes('github')
```

**Risk:** Overly permissive GitHub detection could match malicious domains like:
- `evil-github.com`
- `github-phishing.evil.com`

#### 5. Insufficient Error Handling (Low Risk)
**Location:** Various files
- Error messages may leak sensitive path information
- Stack traces could reveal internal system details

### ✅ Security Strengths

1. **Circular Inheritance Detection**: Robust protection against infinite inheritance loops
2. **GitHub Authentication**: Proper token-based authentication for private repositories
3. **Resource Caching**: Prevents repeated malicious requests
4. **Request Timeouts**: Protection against hanging operations
5. **Retry Logic**: Reasonable backoff strategy

## Dependency Security Assessment

### Current Dependencies Analysis
- **@actions/core**: v1.10.1 (Latest stable - Good)
- **@actions/github**: v6.0.0 (Latest stable - Good)
- **handlebars**: v4.7.8 (Security concern - see below)
- **front-matter**: v4.0.2 (Stable)
- **js-yaml**: v4.1.0 (Stable)

### 🔴 Critical Dependency Issue

**Handlebars Template Engine**: Used for prompt template evaluation with `{{base-prompt}}` variable substitution.

**Security Concerns:**
- Potential for template injection attacks
- Unvalidated template content from remote sources
- Access to prototype pollution vectors

**Location:** `src/agent-loader.js:342-357`
```javascript
if (childPrompt.includes('{{base-prompt}}')) {
  const template = Handlebars.compile(childPrompt);
  const renderedPrompt = template(templateContext);
  return renderedPrompt;
}
```

## Threat Model

### Attack Vectors

1. **Malicious Agent Injection**
   - Attacker provides malicious `from` URL
   - System loads and executes malicious agent configuration
   - Potential for arbitrary code execution via prompt injection

2. **Internal Network Access**
   - SSRF via unvalidated URLs
   - Access to internal services and metadata endpoints
   - Potential cloud metadata access (AWS, Azure, GCP)

3. **File System Access**
   - Directory traversal via file paths
   - Access to sensitive configuration files
   - Potential credential theft

4. **Supply Chain Attack**
   - Compromise of remote agent repositories
   - Injection of malicious configurations
   - Lateral movement within organization

## Recommendations

### 🔴 Critical Actions Required

1. **Implement URL Allowlisting**
   ```javascript
   // Add to resource-handler.js
   const ALLOWED_DOMAINS = [
     'github.com',
     'raw.githubusercontent.com',
     'api.github.com'
   ];
   
   _validateUrl(url) {
     const urlObj = new URL(url);
     return ALLOWED_DOMAINS.includes(urlObj.hostname);
   }
   ```

2. **Add Path Sanitization**
   ```javascript
   // Add to agent-loader.js
   const path = require('path');
   
   function sanitizePath(filePath) {
     const resolved = path.resolve(filePath);
     const workingDir = process.cwd();
     if (!resolved.startsWith(workingDir)) {
       throw new Error('Path traversal attempt detected');
     }
     return resolved;
   }
   ```

3. **Implement Configuration Schema Validation**
   ```javascript
   // Add JSON schema validation for agent configurations
   const Ajv = require('ajv');
   const ajv = new Ajv();
   
   const agentSchema = {
     type: 'object',
     properties: {
       name: { type: 'string', pattern: '^[a-zA-Z0-9-_]+$' },
       from: { type: 'string' },
       // ... other properties
     },
     required: ['name']
   };
   ```

### 🟡 Recommended Security Enhancements

4. **Enhance Template Security**
   - Use safe template compilation
   - Validate template variables
   - Implement content sanitization

5. **Add Audit Logging**
   - Log all agent loading operations
   - Track inheritance chains
   - Monitor for suspicious patterns

6. **Implement Rate Limiting**
   - Limit remote resource requests
   - Prevent abuse of inheritance feature
   - Add circuit breaker pattern

7. **Add Content Security Policy**
   - Validate agent prompt content
   - Prevent script injection
   - Sanitize user inputs

## Compliance Considerations

### OWASP Top 10 Alignment
- **A01:2021 - Broken Access Control**: Directory traversal vulnerability
- **A03:2021 - Injection**: Template injection via Handlebars
- **A06:2021 - Vulnerable Components**: Handlebars security considerations
- **A10:2021 - Server-Side Request Forgery**: URL validation gaps

### CWE Mappings
- **CWE-22**: Path Traversal
- **CWE-918**: Server-Side Request Forgery
- **CWE-20**: Improper Input Validation
- **CWE-94**: Code Injection

## Conclusion

The agent inheritance feature provides valuable functionality but requires immediate security hardening. The identified vulnerabilities pose significant risks in production environments and should be addressed before broader deployment.

**Risk Level: HIGH** - Immediate action required for production use.

---

**By:** advanced-security-reviewer (agent+advanced-security-reviewer@a5c.ai) - https://a5c.ai/agents/advanced-security-reviewer