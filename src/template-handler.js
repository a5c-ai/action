const Handlebars = require('handlebars');
const core = require('@actions/core');
const { loadResource, resolveUri } = require('./resource-handler');

// Prevent circular template inclusions
const inclusionStack = new Set();
const MAX_INCLUSION_DEPTH = 10;

/**
 * Initialize Handlebars with template inclusion helpers
 * This adds the ability to include remote or local templates in Handlebars templates
 * @param {Handlebars} handlebarsInstance - Optional Handlebars instance to extend
 */
function initializeTemplateHelpers(handlebarsInstance = Handlebars) {
  /**
   * Include helper - loads and renders a template from a URI
   * Usage: {{include "template-uri" [param1=value1 param2=value2...]}}
   * 
   * The included template has access to:
   * 1. All parent template context
   * 2. Any explicitly passed parameters
   * 3. Special variables: _includeSource, _includeDepth, _baseUri
   * 
   * @example
   * {{include "https://raw.githubusercontent.com/user/repo/main/template.md" title="My Title"}}
   * {{include "../path/to/local-template.md" data=someVariable}}
   * {{include "file:///absolute/path/to/template.md"}}
   */
  handlebarsInstance.registerHelper('include', async function(templateUri, options) {
    // Get the current context and any hash parameters
    const context = Object.assign({}, this, options.hash || {});
    
    // Get base URI from the context if available (for resolving relative paths)
    const baseUri = context._baseUri || '';
    const includeDepth = (context._includeDepth || 0) + 1;
    
    // Resolve URI (handle relative paths)
    const resolvedUri = resolveUri(templateUri, baseUri);
    
    // Prevent circular inclusions and check max depth
    if (inclusionStack.has(resolvedUri)) {
      core.warning(`Circular template inclusion detected: ${resolvedUri}`);
      return `[Error: Circular inclusion of ${resolvedUri}]`;
    }
    
    if (includeDepth > MAX_INCLUSION_DEPTH) {
      core.warning(`Maximum template inclusion depth (${MAX_INCLUSION_DEPTH}) exceeded when including ${resolvedUri}`);
      return `[Error: Maximum inclusion depth exceeded for ${resolvedUri}]`;
    }
    
    // Add to inclusion stack to detect circular references
    inclusionStack.add(resolvedUri);
    
    try {
      // Load the template content
      core.debug(`Including template from ${resolvedUri}`);
      const templateContent = await loadResource(resolvedUri, {
        cache_timeout: 60, // 1 hour cache
        retry_attempts: 3
      });
      
      if (!templateContent) {
        core.warning(`Failed to load included template from ${resolvedUri}`);
        return `[Error: Failed to load template from ${resolvedUri}]`;
      }
      
      // Compile the template
      const compiledTemplate = handlebarsInstance.compile(templateContent);
      
      // Add inclusion metadata to context
      const includedContext = {
        ...context,
        _includeSource: resolvedUri,
        _includeDepth: includeDepth,
        _baseUri: resolvedUri
      };
      
      // Render the template with the combined context
      const result = compiledTemplate(includedContext);
      return new handlebarsInstance.SafeString(result);
    } catch (error) {
      core.warning(`Error including template from ${resolvedUri}: ${error.message}`);
      return `[Error including template: ${error.message}]`;
    } finally {
      // Remove from inclusion stack when done
      inclusionStack.delete(resolvedUri);
    }
  });
  
  /**
   * Raw include helper - loads template content without rendering
   * Usage: {{rawInclude "template-uri"}}
   * 
   * This helper simply includes the raw content of another template without 
   * processing Handlebars expressions within it.
   * 
   * @example
   * {{rawInclude "https://raw.githubusercontent.com/user/repo/main/template.md"}}
   */
  handlebarsInstance.registerHelper('rawInclude', async function(templateUri, options) {
    // Get base URI from the context if available (for resolving relative paths)
    const baseUri = this._baseUri || '';
    
    // Resolve URI (handle relative paths)
    const resolvedUri = resolveUri(templateUri, baseUri);
    
    try {
      // Load the template content
      core.debug(`Raw including template from ${resolvedUri}`);
      const templateContent = await loadResource(resolvedUri, {
        cache_timeout: 60, // 1 hour cache
        retry_attempts: 3
      });
      
      if (!templateContent) {
        core.warning(`Failed to load raw included template from ${resolvedUri}`);
        return `[Error: Failed to load template from ${resolvedUri}]`;
      }
      
      // Return the raw content without rendering
      return new handlebarsInstance.SafeString(templateContent);
    } catch (error) {
      core.warning(`Error raw including template from ${resolvedUri}: ${error.message}`);
      return `[Error including template: ${error.message}]`;
    }
  });
  
  core.info('✅ Initialized template inclusion helpers');
  return handlebarsInstance;
}

module.exports = {
  initializeTemplateHelpers
};