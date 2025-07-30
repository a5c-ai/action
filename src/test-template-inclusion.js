const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { initializeTemplateHelpers } = require('./template-handler');

// Initialize template helpers
initializeTemplateHelpers(Handlebars);

// Define a test template that includes other templates
const testTemplate = `
# Test Template

{{include "../docs/examples/partial-templates/header.md" title="Custom Header Title"}}

## Main Content

This is the main content of the test template.

Below is an included footer:

{{include "../docs/examples/partial-templates/footer.md"}}
`;

// Define mock context data
const context = {
  agent: {
    name: 'test-agent',
    category: 'testing'
  },
  repository: {
    fullName: 'a5c-ai/action',
    owner: 'a5c-ai',
    name: 'action',
    branch: 'main',
    sha: '1234567890abcdef'
  },
  timestamp: new Date().toISOString(),
  _baseUri: __filename // Use current file as base URI for resolving relative includes
};

// Register the formatDate helper
Handlebars.registerHelper('formatDate', function(date) {
  return new Date(date).toISOString();
});

// Define a helper to handle the default fallback
Handlebars.registerHelper('default', function(value, defaultValue) {
  return value || defaultValue;
});

// Compile and render the template
const compiledTemplate = Handlebars.compile(testTemplate);

// This would normally be an async function, but we're using sync fs operations for simplicity
async function renderTemplate() {
  try {
    const result = await compiledTemplate(context);
    console.log('Template rendering successful!');
    console.log('\nRendered Template:\n');
    console.log(result);
    return result;
  } catch (error) {
    console.error('Error rendering template:', error);
    return null;
  }
}

// Run the test
renderTemplate().then(result => {
  if (result) {
    // Write the result to a test output file
    fs.writeFileSync(path.join(__dirname, '..', 'test-output.md'), result);
    console.log('\nTest output written to test-output.md');
  }
});