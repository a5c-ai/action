const fs = require('fs');
const https = require('https');
const http = require('http');
const core = require('@actions/core');

// Global resource cache
const resourceCache = new Map();
const resourceCacheExpiry = new Map();

/**
 * Universal resource handler for loading content from various URI schemes
 * Supports: file://, http://, https://, and local file paths
 * Features: Caching, retry logic, configurable timeouts
 */
class ResourceHandler {
  constructor(options = {}) {
    this.defaultOptions = {
      cache_timeout: 60, // minutes
      retry_attempts: 3,
      retry_delay: 1000, // ms
      request_timeout: 10000, // ms
      ...options
    };
  }

  /**
   * Load a resource from URI with caching and retry logic
   * @param {string} uri - The URI to load
   * @param {object} options - Override options
   * @returns {Promise<string>} - The resource content
   */
  async loadResource(uri, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    const cacheKey = `resource:${uri}`;
    const now = Date.now();
    const cacheTimeout = config.cache_timeout * 60 * 1000;

    // Check cache first
    if (resourceCache.has(cacheKey) && resourceCacheExpiry.get(cacheKey) > now) {
      core.info(`📋 Using cached resource: ${uri}`);
      return resourceCache.get(cacheKey);
    }

    // Load resource with retry logic
    let lastError;
    for (let attempt = 1; attempt <= config.retry_attempts; attempt++) {
      try {
        const content = await this._loadResourceDirect(uri, config);
        
        // Cache the content
        resourceCache.set(cacheKey, content);
        resourceCacheExpiry.set(cacheKey, now + cacheTimeout);
        
        core.info(`📥 Loaded and cached resource: ${uri}`);
        return content;
      } catch (error) {
        lastError = error;
        if (attempt < config.retry_attempts) {
          core.warning(`Attempt ${attempt} failed for ${uri}, retrying in ${config.retry_delay}ms: ${error.message}`);
          await this._delay(config.retry_delay);
        }
      }
    }

    throw new Error(`Failed to load resource from ${uri} after ${config.retry_attempts} attempts: ${lastError.message}`);
  }

  /**
   * Load a resource directly without caching
   * @param {string} uri - The URI to load
   * @param {object} config - Configuration options
   * @returns {Promise<string>} - The resource content
   */
  async _loadResourceDirect(uri, config) {
    if (uri.startsWith('file://')) {
      return this._loadFileResource(uri.substring(7));
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return this._loadHttpResource(uri, config);
    } else {
      // Assume local file path
      return this._loadFileResource(uri);
    }
  }

  /**
   * Load a local file resource
   * @param {string} filePath - The file path
   * @returns {Promise<string>} - The file content
   */
  async _loadFileResource(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Load an HTTP/HTTPS resource
   * @param {string} url - The URL to load
   * @param {object} config - Configuration options
   * @returns {Promise<string>} - The response content
   */
  async _loadHttpResource(url, config) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const headers = {
        'User-Agent': 'A5C-Runner/1.0',
        'Accept': 'text/plain, text/markdown, application/json, */*'
      };

      // Add GitHub authentication if accessing GitHub and token is available
      if (this._isGitHubUrl(url)) {
        const githubToken = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;
        if (githubToken) {
          headers['Authorization'] = `token ${githubToken}`;
          core.info(`🔐 Using GitHub authentication for: ${url}`);
        }
      }
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers
      };

      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // Handle redirects
            this._loadHttpResource(res.headers.location, config)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.setTimeout(config.request_timeout, () => {
        req.destroy();
        reject(new Error(`Request timeout after ${config.request_timeout}ms`));
      });
      
      req.end();
    });
  }

  /**
   * Check if a URL is a GitHub URL (supports github.com and GitHub Enterprise)
   * @param {string} url - The URL to check
   * @returns {boolean} - True if it's a GitHub URL
   */
  _isGitHubUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'github.com' || 
             urlObj.hostname === 'raw.githubusercontent.com' ||
             urlObj.hostname.includes('github');
    } catch (error) {
      return false;
    }
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear the resource cache
   */
  clearCache() {
    resourceCache.clear();
    resourceCacheExpiry.clear();
    core.info('🧹 Cleared resource cache');
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, expiry] of resourceCacheExpiry) {
      if (expiry > now) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: resourceCache.size,
      validEntries,
      expiredEntries
    };
  }
}

// Create default instance
const defaultResourceHandler = new ResourceHandler();

// Export both class and default instance
module.exports = {
  ResourceHandler,
  loadResource: (uri, options) => defaultResourceHandler.loadResource(uri, options),
  clearCache: () => defaultResourceHandler.clearCache(),
  getCacheStats: () => defaultResourceHandler.getCacheStats()
}; 