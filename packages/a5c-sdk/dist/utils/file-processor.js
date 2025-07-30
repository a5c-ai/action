const fs = require('fs');
const path = require('path');
const core = require('@actions/core');


// Process files based on configuration
function processFiles(files, config) {
  const fileProcessingConfig = config.file_processing || {};
  
  if (!files || files.length === 0) {
    return [];
  }
  
  core.info(`🗂️  Processing ${files.length} files with file_processing rules`);
  
  let processedFiles = files;
  
  // Apply include_paths filter
  if (fileProcessingConfig.include_paths && fileProcessingConfig.include_paths.length > 0) {
    processedFiles = processedFiles.filter(file => 
      matchesPatterns(file, fileProcessingConfig.include_paths)
    );
    core.info(`📥 After include_paths filter: ${processedFiles.length} files`);
  }
  
  // Apply exclude_paths filter
  if (fileProcessingConfig.exclude_paths && fileProcessingConfig.exclude_paths.length > 0) {
    processedFiles = processedFiles.filter(file => 
      !matchesPatterns(file, fileProcessingConfig.exclude_paths)
    );
    core.info(`📤 After exclude_paths filter: ${processedFiles.length} files`);
  }
  
  // Apply max_file_size filter
  if (fileProcessingConfig.max_file_size) {
    processedFiles = processedFiles.filter(file => {
      try {
        const stats = fs.statSync(file);
        const fileSizeOk = stats.size <= fileProcessingConfig.max_file_size;
        if (!fileSizeOk) {
          core.info(`📏 Excluded ${file} (size: ${stats.size} bytes > ${fileProcessingConfig.max_file_size})`);
        }
        return fileSizeOk;
      } catch (error) {
        core.warning(`Could not check file size for ${file}: ${error.message}`);
        return true; // Include if we can't check
      }
    });
    core.info(`📏 After max_file_size filter: ${processedFiles.length} files`);
  }
  
  return processedFiles;
}

// Check if a file matches any of the given patterns
function matchesPatterns(filePath, patterns) {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  
  return patterns.some(pattern => matchesPattern(filePath, pattern));
}

// Check if a file matches a specific pattern
function matchesPattern(filePath, pattern) {
  // Convert glob pattern to regex
  // This is a simplified implementation - in production you'd want to use a proper glob library
  let regexPattern = pattern
    .replace(/\*\*/g, '.*')  // ** matches any number of directories
    .replace(/\*/g, '[^/]*')  // * matches anything except path separator
    .replace(/\?/g, '[^/]')   // ? matches single character except path separator
    .replace(/\./g, '\\.');   // Escape dots
  
  // Anchor the pattern
  regexPattern = '^' + regexPattern + '$';
  
  try {
    const regex = new RegExp(regexPattern);
    return regex.test(filePath);
  } catch (error) {
    core.warning(`Invalid pattern ${pattern}: ${error.message}`);
    return false;
  }
}

// Get file content with size checking
function getFileContent(filePath, config) {
  const fileProcessingConfig = config.file_processing || {};
  
  try {
    const stats = fs.statSync(filePath);
    
    // Check max file size
    if (fileProcessingConfig.max_file_size && stats.size > fileProcessingConfig.max_file_size) {
      core.warning(`File ${filePath} exceeds max_file_size (${stats.size} > ${fileProcessingConfig.max_file_size})`);
      return null;
    }
    
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    core.warning(`Could not read file ${filePath}: ${error.message}`);
    return null;
  }
}

// Check if a file should be processed based on configuration
function shouldProcessFile(filePath, config) {
  const fileProcessingConfig = config.file_processing || {};
  
  // Check include_paths
  if (fileProcessingConfig.include_paths && fileProcessingConfig.include_paths.length > 0) {
    if (!matchesPatterns(filePath, fileProcessingConfig.include_paths)) {
      return false;
    }
  }
  
  // Check exclude_paths
  if (fileProcessingConfig.exclude_paths && fileProcessingConfig.exclude_paths.length > 0) {
    if (matchesPatterns(filePath, fileProcessingConfig.exclude_paths)) {
      return false;
    }
  }
  
  // Check file size
  if (fileProcessingConfig.max_file_size) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > fileProcessingConfig.max_file_size) {
        return false;
      }
    } catch (error) {
      core.warning(`Could not check file size for ${filePath}: ${error.message}`);
    }
  }
  
  return true;
}

module.exports = {
  processFiles,
  getFileContent,
  shouldProcessFile,
  matchesPatterns,
  matchesPattern
}; 