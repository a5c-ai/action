# AEP-001: Agent Inheritance v2 - Dynamic Template System

**Status**: Draft  
**Author**: developer-agent  
**Created**: 2025-07-11  
**Last Updated**: 2025-07-11

## Summary

This proposal introduces Agent Inheritance v2, a dynamic template system that extends the current inheritance model with runtime template resolution, conditional inheritance, and multi-source template composition.

## Motivation

### Problem Statement

The current agent inheritance system, while functional, has several limitations:
- Static template resolution at load time
- Limited conditional logic for inheritance
- No support for multiple inheritance sources
- Difficulty in creating reusable agent patterns
- Complex template substitution for dynamic scenarios

### Use Cases

1. **Dynamic Agent Specialization**: Create agents that inherit different base configurations based on runtime conditions
2. **Multi-Source Composition**: Combine templates from multiple sources (local, remote, registry)
3. **Conditional Inheritance**: Apply different inheritance patterns based on repository characteristics
4. **Template Registries**: Support for centralized template repositories
5. **Advanced Template Logic**: Complex template substitution with conditional logic

### Current Limitations

```yaml
# Current inheritance is static and limited
inheritance:
  extends: "base-agent"
  substitutions:
    AGENT_NAME: "my-agent"
```

## Proposal

### Overview

Agent Inheritance v2 introduces a dynamic template system with:
- Runtime template resolution
- Conditional inheritance chains
- Multi-source template composition
- Advanced template functions
- Template registries and versioning

### Detailed Design

#### Enhanced Inheritance Configuration

```yaml
# Enhanced inheritance with dynamic resolution
inheritance:
  strategy: "dynamic"
  templates:
    - source: "local"
      extends: "base-security-agent"
      condition: "repository.security_enabled"
    - source: "registry"
      extends: "org/security-templates/web-app-scanner:v2.1"
      condition: "files.match('**/*.js') && !files.match('test/**')"
    - source: "remote"
      extends: "https://templates.company.com/agents/compliance-checker.yml"
      condition: "repository.compliance_required"
  
  # Advanced template substitution
  substitutions:
    AGENT_NAME: "{{agent.name}}"
    SEVERITY_LEVEL: "{{repository.security_level || 'medium'}}"
    SCAN_PATHS: "{{files.changed | filter('*.js') | join(',')}}"
    
  # Template functions
  functions:
    get_security_config: |
      if (repository.has_file('.security-config.yml')) {
        return load_yaml('.security-config.yml');
      }
      return default_security_config;
```

#### Multi-Source Template Resolution

```yaml
# Template sources configuration
template_sources:
  - name: "local"
    type: "filesystem"
    path: ".a5c/templates/"
    priority: 1
    
  - name: "registry"
    type: "registry"
    url: "https://registry.a5c.ai"
    credentials: "${REGISTRY_TOKEN}"
    priority: 2
    
  - name: "company"
    type: "git"
    url: "https://github.com/company/a5c-templates"
    branch: "main"
    path: "agents/"
    credentials: "${COMPANY_GITHUB_TOKEN}"
    priority: 3
```

#### Conditional Inheritance

```yaml
# Conditional inheritance based on runtime context
inheritance:
  conditions:
    - if: "event.type == 'pull_request' && labels.includes('security')"
      extends: "security-reviewer-strict"
    - if: "event.type == 'push' && branch == 'main'"
      extends: "security-reviewer-standard"
    - if: "files.changed.filter('*.py').length > 0"
      extends: "python-security-reviewer"
    - default: "basic-security-reviewer"
```

#### Template Composition

```yaml
# Multiple template composition
inheritance:
  compose:
    - template: "base-agent"
      merge_strategy: "deep"
    - template: "security-mixin"
      merge_strategy: "overlay"
    - template: "github-integration"
      merge_strategy: "append"
  
  # Composition rules
  composition_rules:
    conflicts:
      - field: "trigger_events"
        resolution: "union"
      - field: "mcp_servers"
        resolution: "merge"
      - field: "timeout"
        resolution: "max"
```

### Template Functions

#### Built-in Functions

```javascript
// Repository functions
repository.name              // Repository name
repository.owner            // Repository owner
repository.is_private       // Boolean: private repository
repository.has_file(path)   // Boolean: file exists
repository.language         // Primary language
repository.topics           // Array of topics

// File functions
files.all()                 // All files in repository
files.changed()             // Files changed in current event
files.match(pattern)        // Files matching pattern
files.filter(extension)     // Files with extension
files.count()               // Number of files

// Event functions
event.type                  // Event type
event.action                // Event action
event.author                // Event author
event.timestamp             // Event timestamp
event.branch                // Current branch

// Template functions
template.load(path)         // Load template from path
template.merge(a, b)        // Merge two templates
template.substitute(tmpl, vars) // Template substitution
template.validate(config)   // Validate configuration
```

#### Custom Functions

```yaml
# Custom template functions
template_functions:
  get_scan_config: |
    function(repo_type) {
      switch(repo_type) {
        case 'web-app':
          return {
            depth: 'comprehensive',
            frameworks: ['react', 'vue', 'angular'],
            security_rules: 'web-app-security'
          };
        case 'api':
          return {
            depth: 'api-focused',
            frameworks: ['express', 'fastapi', 'spring'],
            security_rules: 'api-security'
          };
        default:
          return {
            depth: 'standard',
            frameworks: [],
            security_rules: 'general-security'
          };
      }
    }
```

### Template Registry

#### Registry Configuration

```yaml
# Template registry configuration
template_registry:
  url: "https://registry.a5c.ai"
  authentication:
    type: "bearer_token"
    token: "${REGISTRY_TOKEN}"
  
  # Caching configuration
  cache:
    enabled: true
    ttl: 3600  # 1 hour
    max_size: 100
  
  # Version resolution
  version_resolution:
    strategy: "semver"
    allow_prerelease: false
    prefer_stable: true
```

#### Template Versioning

```yaml
# Template with versioning
inheritance:
  extends: "org/security-templates/web-scanner:^2.1.0"
  
  # Version constraints
  version_constraints:
    min_version: "2.0.0"
    max_version: "3.0.0"
    exclude_versions: ["2.1.5"]
```

### Backward Compatibility

The v2 inheritance system maintains full backward compatibility:

```yaml
# v1 format (still supported)
inheritance:
  extends: "base-agent"
  substitutions:
    PARAM: "value"

# Automatically translated to v2 format
inheritance:
  strategy: "static"
  templates:
    - source: "local"
      extends: "base-agent"
  substitutions:
    PARAM: "value"
```

### Migration Strategy

1. **Phase 1**: Deploy v2 system with v1 compatibility
2. **Phase 2**: Provide migration tools for v1 → v2 conversion
3. **Phase 3**: Deprecate v1 format (with 6-month notice)
4. **Phase 4**: Remove v1 support

## Examples

### Example 1: Dynamic Security Agent

```yaml
name: dynamic-security-agent
version: 2.0.0
inheritance:
  strategy: "dynamic"
  templates:
    - source: "registry"
      extends: "security/web-app-scanner:latest"
      condition: "repository.type == 'web-app'"
    - source: "registry"
      extends: "security/api-scanner:latest"
      condition: "repository.type == 'api'"
    - source: "local"
      extends: "custom-security-base"
      condition: "default"
  
  substitutions:
    SCAN_DEPTH: "{{get_scan_config(repository.type).depth}}"
    FRAMEWORKS: "{{get_scan_config(repository.type).frameworks}}"
```

### Example 2: Multi-Source Composition

```yaml
name: comprehensive-reviewer
version: 2.0.0
inheritance:
  compose:
    - template: "registry:base/code-reviewer:v3.0"
      merge_strategy: "deep"
    - template: "local:security-mixin"
      merge_strategy: "overlay"
    - template: "company:compliance-checker"
      merge_strategy: "append"
  
  substitutions:
    COMPLIANCE_LEVEL: "{{repository.compliance_tier}}"
    SECURITY_RULES: "{{company.security_standards}}"
```

## Implementation Plan

### Phase 1: Core Dynamic Resolution
- [ ] Implement dynamic template resolution engine
- [ ] Add conditional inheritance support
- [ ] Create template function framework
- [ ] Maintain v1 compatibility

### Phase 2: Multi-Source Support
- [ ] Implement template registry client
- [ ] Add Git-based template sources
- [ ] Create template caching system
- [ ] Add version resolution

### Phase 3: Advanced Features
- [ ] Implement template composition
- [ ] Add custom template functions
- [ ] Create template validation system
- [ ] Add performance optimizations

## Testing Strategy

### Unit Tests
- [ ] Template resolution logic
- [ ] Conditional inheritance evaluation
- [ ] Template substitution functions
- [ ] Registry client functionality

### Integration Tests
- [ ] End-to-end inheritance scenarios
- [ ] Multi-source template loading
- [ ] Performance with large templates
- [ ] Backward compatibility validation

## Security Considerations

### Security Impact Assessment

Template inheritance v2 introduces several security considerations:
- Remote template loading requires secure transport
- Template substitution must prevent code injection
- Registry authentication needs secure credential management

### Mitigation Strategies

- Use HTTPS for all remote template loading
- Implement template sandboxing for substitution
- Provide secure credential management
- Add template signature verification

## Performance Considerations

### Performance Impact

- Template resolution: ~50ms additional latency
- Caching reduces repeated resolution overhead
- Registry lookups: ~200ms for cache misses

### Benchmarking Plan

- Measure template resolution time
- Test with various template sizes
- Validate caching effectiveness
- Monitor registry performance

## Timeline

### Milestones

| Milestone | Description | Target Date |
|-----------|-------------|-------------|
| Design Review | Complete design review | 2025-07-25 |
| Core Implementation | Dynamic resolution complete | 2025-08-15 |
| Registry Support | Template registry integration | 2025-09-01 |
| Testing Complete | All tests passing | 2025-09-15 |
| Documentation | Documentation updated | 2025-09-30 |
| Release | Feature released | 2025-10-15 |

## Open Questions

1. Should template registries support private namespaces?
2. How should template conflicts be resolved in composition?
3. What template function security model should be implemented?
4. Should template versioning support pre-release versions?

## References

- [Agent Configuration Format](../agent-config-format.md)
- [Agent Inheritance System](../agent-inheritance.md)
- [System Architecture](../system-architecture.md)
- [Semantic Versioning](https://semver.org/)

## Changelog

### 2025-07-11
- Initial draft created
- Added dynamic template resolution design
- Defined multi-source template composition
- Created example configurations

---

*This proposal is part of the A5C Agent System Enhancement Process*