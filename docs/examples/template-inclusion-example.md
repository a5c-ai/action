# Template Inclusion Example

This file demonstrates how to use the template inclusion functionality in A5C prompt templates.

## Basic Usage

The `include` helper allows you to include content from other templates, either local or remote:

```handlebars
{{include "path/to/template.md"}}
```

## Parameter Passing

You can pass parameters to included templates:

```handlebars
{{include "path/to/template.md" title="My Custom Title" data=someVariable}}
```

In the included template, these parameters are available as normal Handlebars variables:

```handlebars
# {{title}}

This template was included with a custom title and some data: {{data}}
```

## Relative Paths

You can use relative paths in your includes:

```handlebars
{{include "./partial-templates/header.md"}}
Content of main template
{{include "./partial-templates/footer.md"}}
```

## Remote Templates

You can include templates from remote sources (GitHub repositories):

```handlebars
{{include "https://raw.githubusercontent.com/a5c-ai/action/main/docs/examples/base-reviewer.agent.md"}}
```

## Raw Inclusion

Sometimes you might want to include content without processing it as a template:

```handlebars
{{rawInclude "path/to/content.md"}}
```

## Nested Includes

Templates can include other templates, which can further include more templates:

```handlebars
{{include "main-template.md"}}
```

Where main-template.md might contain:

```handlebars
# Main Template

{{include "sub-template.md"}}
```

## Security Considerations

- Circular includes are automatically detected and prevented
- Maximum inclusion depth is enforced to prevent abuse
- Remote URLs are validated against an allowlist to prevent SSRF attacks
- All included content is cached to improve performance

## Example Use Cases

1. **Reusable Components**: Create common sections like headers, footers, or standard instructions
2. **Template Libraries**: Maintain a central repository of template fragments
3. **Dynamic Inclusion**: Select different templates based on context variables
4. **Composition**: Build complex templates from smaller, more maintainable pieces