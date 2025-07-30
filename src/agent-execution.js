const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const { spawn } = require('child_process');
const { pipe } = require('stream');
const os = require('os');
const Handlebars = require('handlebars');
const { createMCPConfigFile, cleanupMCPConfig } = require('./mcp-manager');
const artifact = require('@actions/artifact');

// Get CLI command using fallback hierarchy: agent.cli_command -> defaults -> cli_agents templates -> A5C_CLI_TOOL env variable
function getCliCommand(agent, config) {
  // 1. Check if agent has explicit cli_command
  if (agent.cli_command) {
    core.info('🔍 Using CLI command from agent configuration');
    return buildFinalCliCommand(agent.cli_command, agent, config);
  }
  
  // 2. Check if defaults has cli_command
  if (config.defaults?.cli_command) {
    core.info('🔍 Using CLI command from defaults configuration');
    return buildFinalCliCommand(config.defaults.cli_command, agent, config);
  }
  
  // 3. Check cli_agents templates based on agent preferences
  if (config.cli_agents) {
    const templateKey = selectCliAgentTemplate(agent, config);
    if (templateKey && config.cli_agents[templateKey]?.cli_command) {
      core.info(`🔍 Using CLI command from cli_agents template: ${templateKey}`);
      const template = config.cli_agents[templateKey];
      return buildFinalCliCommand(template.cli_command, agent, config, template);
    }
  }
  
  // 4. Final fallback to A5C_CLI_TOOL environment variable
  if (process.env.A5C_CLI_TOOL) {
    core.info('🔍 Using CLI command from A5C_CLI_TOOL environment variable');
    return buildFinalCliCommand(process.env.A5C_CLI_TOOL, agent, config);
  }
  
  return null;
}

// Build the final CLI command with all the configuration options applied
function buildFinalCliCommand(baseCommand, agent, config, template = null) {
  let finalCommand = baseCommand;
  
  // Handle environment variables prefix
  if (template?.envs) {
    const envVars = Object.entries(template.envs)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    finalCommand = `${envVars} ${finalCommand}`;
    core.debug(`🔍 Added environment variables: ${envVars}`);
  }
  
  // Handle prompt injection to stdin
  if (template?.inject_prompt_to_stdin) {
    finalCommand = `cat {{prompt_path}} | ${finalCommand}`;
    core.debug('🔍 Added prompt injection to stdin');
  }
  
  // Handle environment variables injection to prompt
  if (template?.inject_envs_to_prompt) {
    if (template?.inject_prompt_to_stdin) {
      // If both are enabled, pipe printenv before cat
      finalCommand = finalCommand.replace('cat {{prompt_path}}', 'printenv | cat - {{prompt_path}}');
    } else {
      // If only env injection is enabled, add it as a prefix
      finalCommand = `printenv | ${finalCommand}`;
    }
    core.debug('🔍 Added environment variables injection to prompt');
  }
  
  return finalCommand;
}

// Get the model to use with fallback hierarchy
function getModelForExecution(agent, config, template = null) {
  // 1. Agent-specific model
  if (agent.model) {
    return agent.model;
  }
  
  // 2. Global defaults model
  if (config.defaults?.model) {
    return config.defaults.model;
  }
  
  // 3. Template-specific model (cli_agents default)
  if (template?.model) {
    return template.model;
  }
  
  // 4. Final fallback
  return 'claude-3-5-sonnet-20241022';
}

// Get the selected template object (if any) for model and other fallbacks
function getSelectedTemplate(agent, config) {
  if (!config.cli_agents) {
    return null;
  }
  
  const templateKey = selectCliAgentTemplate(agent, config);
  if (templateKey && config.cli_agents[templateKey]) {
    return config.cli_agents[templateKey];
  }
  
  return null;
}

// Select the appropriate cli_agents template based on agent configuration
function selectCliAgentTemplate(agent, config) {
  // Check if agent specifies a preferred cli_agent
  if (agent.cli_agent && config.cli_agents[agent.cli_agent]) {
    return agent.cli_agent;
  }
  
  // Check if global config specifies a default cli_agent
  if (config.defaults?.cli_agent && config.cli_agents[config.defaults.cli_agent]) {
    return config.defaults.cli_agent;
  }

  // fallback to A5C_CLI_TOOL environment variable
  if (process.env.A5C_CLI_TOOL && config.cli_agents[process.env.A5C_CLI_TOOL]) {
    return process.env.A5C_CLI_TOOL;
  }
  
  // Auto-detect based on available tools or model preferences
  const model = agent.model || config.defaults?.model || '';
  
  // Auto-detection logic based on model naming patterns
  if (model.includes('claude') || model.includes('sonnet') || model.includes('haiku') || model.includes('opus')) {
    if (config.cli_agents.claude) return 'claude';
  }
  
  if (model.includes('gpt') || model.includes('o1') || model.includes('o4')) {
    // Check for Azure environment variables first
    if (process.env.AZURE_OPENAI_PROJECT_NAME && config.cli_agents.azure_codex) {
      return 'azure_codex';
    }
    if (config.cli_agents.codex) return 'codex';
  }
  
  if (model.includes('gemini')) {
    if (config.cli_agents.gemini) return 'gemini';
  }
  
  // Default fallback to first available template
  const availableTemplates = Object.keys(config.cli_agents);
  if (availableTemplates.length > 0) {
    return availableTemplates[0];
  }
  
  return null;
}

// Execute agent using CLI command
async function executeAgent(agent, promptData, config, dryRun = false) {
  const startTime = Date.now();
  let statusFd = null;
  let logFd = null;
  let statusListener = null;
  let logListener = null;
  if(!agent.id) {
    // random id
    agent.id = Math.random().toString(36).substring(2, 15);
  }
  try {
    // Get CLI command using the new fallback hierarchy
    const cliCommand = getCliCommand(agent, config);
    
    if (!cliCommand) {
      throw new Error('No CLI command specified in agent, defaults, cli_agents templates, or A5C_CLI_TOOL environment variable');
    }
    
    // Get the template that was selected (if any) for model fallback
    const selectedTemplate = getSelectedTemplate(agent, config);
    
    core.info(`🔍 CLI command: ${cliCommand}`);

    // Setup file descriptors for agent reporter communication (only if not dry run)
    if (!dryRun) {
      core.info(`🔍 Setting up agent reporter communication file descriptors`);
      const { statusFd: sFd, logFd: lFd, statusListener: sListener, logListener: lListener } = 
        await setupAgentReporterCommunication(agent.id);
      
      statusFd = sFd;
      logFd = lFd;
      statusListener = sListener;
      logListener = lListener;
    }
    
    // Prepare template context for CLI command
    const templateContext = {
      prompt: promptData.prompt,
      prompt_path: null, // Will be set if we create a temp file
      mcp_config: null,  // Will be set if MCP is configured
      model: getModelForExecution(agent, config, selectedTemplate),
      max_turns: agent.max_turns || config.defaults?.max_turns || 10,
      verbose: agent.verbose || config.defaults?.verbose || false,
      files: promptData.context?.changedFiles || [],
      // Add access to full config
      config: agent,
      globalConfig: config,
      envs: process.env
    };
    core.debug(`🔍 Template context: ${JSON.stringify(templateContext)}`);
    
    // Set up MCP configuration (always create to include default servers)
    {
      // Add file descriptor environment variables to MCP config
      const mcpConfig = { ...config };
      if (statusFd !== null) {
        mcpConfig.AGENT_STATUS_FD = statusFd.toString();
      }
      if (logFd !== null) {
        mcpConfig.AGENT_LOG_FD = logFd.toString();
      }
      
      templateContext.mcp_config = await createMCPConfigFile(agent.mcp_servers, mcpConfig);
    }    
    core.debug(`🔍 MCP config: ${JSON.stringify(templateContext.mcp_config)}`);
    
    // Create temporary prompt file if needed
    if (cliCommand.includes('{{prompt_path}}')) {
      templateContext.prompt_path = await createTempPromptFile(promptData.prompt);
    }
    core.debug(`🔍 Prompt path: ${templateContext.prompt_path}`);
    
    // Compile and render the CLI command template
    const commandTemplate = Handlebars.compile(cliCommand);
    const renderedCommand = commandTemplate(templateContext);
    core.debug(`🔍 Rendered command: ${renderedCommand}`);
    core.info(`🚀 ${dryRun ? 'DRY RUN - Would execute' : 'Executing'}: ${renderedCommand}`);
    
    // In dry run mode, return mock data instead of executing
    if (dryRun) {
      const executionTime = Date.now() - startTime;
      core.info(`🏃 DRY RUN: Prepared everything for execution:`);
      core.info(`   Agent ID: ${agent.id}`);
      core.info(`   Agent Name: ${agent.name}`);
      core.info(`   Model: ${templateContext.model}`);
      core.info(`   Max Turns: ${templateContext.max_turns}`);
      core.info(`   Verbose: ${templateContext.verbose}`);
      core.info(`   Files: ${templateContext.files.length} files`);
      core.info(`   MCP Config: ${templateContext.mcp_config ? 'Created' : 'Not configured'}`);
      core.info(`   Prompt Path: ${templateContext.prompt_path ? 'Created' : 'Not created'}`);
      core.info(`   Preparation Time: ${executionTime}ms`);
      
      return {
        stdout: '[DRY RUN] Command would be executed here',
        stderr: '',
        exitCode: 0,
        statusReports: [],
        logEntries: [],
        dryRun: true,
        executionTime: executionTime
      };
    }
    
    // Execute the CLI command
    const result = await executeCommand(renderedCommand, {
      statusFd,
      logFd,
      agentId: agent.id,
      agent,
      config
    });
    
    const executionTime = Date.now() - startTime;

    // upload artifacts
    const artifactsFiles = [];
    // create a temp dir
    const tempDir = path.join(os.tmpdir(), `agent-output-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    if(result.stdout) {
      // write to a temp file
      const tempFile = path.join(tempDir, `stdout-${Date.now()}.txt`);
      fs.writeFileSync(tempFile, result.stdout);
      artifactsFiles.push(tempFile);
    }
    if(result.stderr) {
      // write to a temp file
      const tempFile = path.join(tempDir, `stderr-${Date.now()}.txt`);
      fs.writeFileSync(tempFile, result.stderr);
      artifactsFiles.push(tempFile);
    }

    // [code-review-agent] - Artifact reporting implementation reviewed. Fixed critical bug in renderedCommand handling.
    // Added error handling and null checks for robust file operations.
    const timestamp = Date.now();
    const agentId = agent.id || 'unknown';
    
    // Copy prompt file with error handling
    if (promptData.prompt_path && fs.existsSync(promptData.prompt_path)) {
      try {
        const promptFile = path.join(tempDir, `prompt-${agentId}-${timestamp}.md`);
        fs.copyFileSync(promptData.prompt_path, promptFile);
        artifactsFiles.push(promptFile);
      } catch (error) {
        core.warning(`Failed to copy prompt file: ${error.message}`);
      }
    }
    
    // Copy MCP config file with error handling
    if (templateContext.mcp_config && fs.existsSync(templateContext.mcp_config)) {
      try {
        const mcpConfigFile = path.join(tempDir, `mcp-config-${agentId}-${timestamp}.json`);
        fs.copyFileSync(templateContext.mcp_config, mcpConfigFile);
        artifactsFiles.push(mcpConfigFile);
      } catch (error) {
        core.warning(`Failed to copy MCP config file: ${error.message}`);
      }
    }
    
    // Write rendered command to file (fixed: was incorrectly using copyFileSync)
    try {
      const renderedCommandFile = path.join(tempDir, `rendered-command-${agentId}-${timestamp}.txt`);
      fs.writeFileSync(renderedCommandFile, renderedCommand);
      artifactsFiles.push(renderedCommandFile);
    } catch (error) {
      core.warning(`Failed to write rendered command file: ${error.message}`);
    }
    if(artifactsFiles.length > 0) {
      try {
        await artifact.default.uploadArtifact('agent-output', artifactsFiles, tempDir);
      } catch (error) {
        core.warning(`Failed to upload artifacts: ${error.message}`);
      }
      // set the output directory
      core.setOutput('output_directory', tempDir);
    }
    // // Clean up temporary files
    // if (templateContext.prompt_path) {
    //   await cleanupTempFile(templateContext.prompt_path);
    // }
    // if (templateContext.mcp_config) {
    //   cleanupMCPConfig(templateContext.mcp_config);
    // }
    // // Clean up temporary directory (using fs.rmSync for Node.js 14+ compatibility)
    // try {
    //   fs.rmSync(tempDir, { recursive: true, force: true });
    // } catch (error) {
    //   core.warning(`Failed to clean up temporary directory: ${error.message}`);
    // }
    
    return {
      response: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      executionTime,
      statusReports: result.statusReports || [],
      logEntries: result.logEntries || []
    };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    core.error(`CLI execution failed: ${error.message} in ${executionTime}ms`);
    throw error;
  } finally {
    // Clean up file descriptors and listeners
    if (statusListener) {
      statusListener.cleanup();
    }
    if (logListener) {
      logListener.cleanup();
    }
  }
}

// Setup file descriptors for agent reporter communication
async function setupAgentReporterCommunication(agentId) {
  try {
    // Create pipes for status and log communication
    const statusPipe = await createNamedPipe('status');
    const logPipe = await createNamedPipe('log');
    
    // Setup status listener
    const statusListener = setupStatusListener(statusPipe.readPath, agentId);
    
    // Setup log listener  
    const logListener = setupLogListener(logPipe.readPath, agentId);
    
    core.info(`📡 Setup agent reporter communication for ${agentId}`);
    core.info(`📡 Status pipe: ${statusPipe.writePath}`);
    core.info(`📡 Log pipe: ${logPipe.writePath}`);
    
    return {
      statusFd: statusPipe.writeFd,
      logFd: logPipe.writeFd,
      statusListener: statusListener,
      logListener: logListener
    };
  } catch (error) {
    core.warning(`Failed to setup agent reporter communication: ${error.message}`);
    return {
      statusFd: null,
      logFd: null,
      statusListener: null,
      logListener: null
    };
  }
}

// Create named pipe for communication
async function createNamedPipe(type) {
  const tempDir = os.tmpdir();
  const pipeName = `agent-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const pipePath = path.join(tempDir, pipeName);
  
  try {
    // On Unix systems, use regular files instead of named pipes to avoid blocking
    if (process.platform !== 'win32') {
      // Create a regular file instead of a named pipe to avoid blocking
      const writeFile = pipePath + '.write';
      const readFile = pipePath + '.read';
      
      // Create empty files
      fs.writeFileSync(writeFile, '');
      fs.writeFileSync(readFile, '');
      
      // Open for writing (non-blocking)
      const writeFd = fs.openSync(writeFile, 'a');
      
      return {
        writePath: writeFile,
        readPath: readFile,
        writeFd: writeFd
      };
    } else {
      // On Windows, use temporary files as a fallback
      const writeFile = pipePath + '.write';
      const readFile = pipePath + '.read';
      
      // Create empty files
      fs.writeFileSync(writeFile, '');
      fs.writeFileSync(readFile, '');
      
      const writeFd = fs.openSync(writeFile, 'a');
      
      return {
        writePath: writeFile,
        readPath: readFile,
        writeFd: writeFd
      };
    }
  } catch (error) {
    core.warning(`Failed to create named pipe: ${error.message}`);
    throw error;
  }
}

// Setup status listener
function setupStatusListener(pipePath, agentId) {
  const statusReports = [];
  let watcher = null;
  
  try {
    core.info(`📡 Setting up status listener for ${agentId} at ${pipePath}`);
    
    // Watch for file changes (works on both Unix and Windows)
    watcher = fs.watchFile(pipePath, { interval: 100 }, (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        try {
          const content = fs.readFileSync(pipePath, 'utf8');
          if (content.trim()) {
            const lines = content.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const report = JSON.parse(line);
                  statusReports.push(report);
                  core.info(`📊 Status: ${report.agentId} - ${report.status}`);
                  if (report.data && report.data.message) {
                    core.info(`📊 Message: ${report.data.message}`);
                  }
                } catch (parseError) {
                  core.warning(`Failed to parse status report: ${parseError.message}`);
                }
              }
            }
          }
        } catch (readError) {
          core.warning(`Failed to read status pipe: ${readError.message}`);
        }
      }
    });
    
    return {
      statusReports: statusReports,
      cleanup: () => {
        if (watcher) {
          fs.unwatchFile(pipePath);
        }
        try {
          if (fs.existsSync(pipePath)) {
            fs.unlinkSync(pipePath);
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  } catch (error) {
    core.warning(`Failed to setup status listener: ${error.message}`);
    return {
      statusReports: statusReports,
      cleanup: () => {}
    };
  }
}

// Setup log listener
function setupLogListener(pipePath, agentId) {
  const logEntries = [];
  let watcher = null;
  
  try {
    core.info(`📡 Setting up log listener for ${agentId} at ${pipePath}`);
    
    // Watch for file changes
    watcher = fs.watchFile(pipePath, { interval: 100 }, (curr, prev) => {
      if (curr.mtime > prev.mtime) {
        try {
          const content = fs.readFileSync(pipePath, 'utf8');
          if (content.trim()) {
            const lines = content.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const logEntry = JSON.parse(line);
                  logEntries.push(logEntry);
                  
                  // Log to GitHub Actions based on level
                  const message = `[${logEntry.agentId}] ${logEntry.message}`;
                  switch (logEntry.level) {
                    case 'error':
                      core.error(message);
                      break;
                    case 'warn':
                      core.warning(message);
                      break;
                    case 'debug':
                      core.debug(message);
                      break;
                    default:
                      core.info(message);
                  }
                } catch (parseError) {
                  core.warning(`Failed to parse log entry: ${parseError.message}`);
                }
              }
            }
          }
        } catch (readError) {
          core.warning(`Failed to read log pipe: ${readError.message}`);
        }
      }
    });
    
    return {
      logEntries: logEntries,
      cleanup: () => {
        if (watcher) {
          fs.unwatchFile(pipePath);
        }
        try {
          if (fs.existsSync(pipePath)) {
            fs.unlinkSync(pipePath);
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  } catch (error) {
    core.warning(`Failed to setup log listener: ${error.message}`);
    return {
      logEntries: logEntries,
      cleanup: () => {}
    };
  }
}

// Execute a command string
async function executeCommand(commandString, options = {}) {
  return new Promise((resolve, reject) => {
    // Parse command string into command and args
    const parts = commandString.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    
    
    // Prepare environment variables
    const env = { ...process.env };
    if (options.statusFd !== null && options.statusFd !== undefined) {
      env.AGENT_STATUS_FD = options.statusFd.toString();
    }
    if (options.logFd !== null && options.logFd !== undefined) {
      env.AGENT_LOG_FD = options.logFd.toString();
    }
    
    const aprocess = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      env: env
    });
    
    let stdout = '';
    let stderr = '';
    
    aprocess.stdout.on('data', (data) => {
      // log the data to the console
      core.debug(data.toString());
      stdout += data.toString();
    });
    
    aprocess.stderr.on('data', (data) => {
      // log the data to the console
      core.error(data.toString());
      stderr += data.toString();
    });
    
    aprocess.on('close', (code) => {
      if(code !== 0) {
        core.error(`Command execution failed: ${stderr.trim()}`);
        reject(new Error(`Command execution failed (${code}): ${stderr.trim()}`));
      }
      else {       
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          statusReports: options.statusListener?.statusReports || [],
          logEntries: options.logListener?.logEntries || []
        });
      }
    });
    
    aprocess.on('error', (error) => {
      reject(new Error(`Command execution failed: ${error.message}`));
    });
    
    // Set timeout from config with fallback hierarchy: agent.timeout -> defaults.timeout -> 30 minutes
    const timeoutMinutes = options.agent?.timeout || options.config?.defaults?.timeout || 30;
    const timeout = setTimeout(() => {
      process.kill('SIGTERM');
      reject(new Error('Command execution timed out'));
    }, timeoutMinutes * 60 * 1000); // Convert minutes to milliseconds
    
    aprocess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// Create temporary prompt file
async function createTempPromptFile(prompt) {
  try {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `prompt-${Date.now()}.md`);
    
    fs.writeFileSync(tempFile, prompt, 'utf8');
    core.info(`📝 Created temporary prompt file: ${tempFile}`);
    
    return tempFile;
  } catch (error) {
    core.warning(`Failed to create temp prompt file: ${error.message}`);
    return null;
  }
}

// Clean up temporary file
async function cleanupTempFile(filePath) {
  if (!filePath) return;
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      core.info(`🧹 Cleaned up temporary file: ${filePath}`);
    }
  } catch (error) {
    core.warning(`Failed to cleanup temp file ${filePath}: ${error.message}`);
  }
}

module.exports = {
  executeAgent
}; 