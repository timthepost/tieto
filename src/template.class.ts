export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

export class TemplateParser {
  private variables: TemplateVariables;
  
  constructor(variables: TemplateVariables = {}) {
    this.variables = variables;
  }

  /**
   * Load template from file and replace variables
   */
  public async parseFile(filePath: string): Promise<string> {
    try {
      const template = await Deno.readTextFile(filePath);
      return this.parseString(template);
    } catch (error) {
      throw new Error(`Failed to load template file: ${filePath}. ${error}`);
    }
  }

  /**
   * Load template from file synchronously and replace variables
   */
  public parseFileSync(filePath: string): string {
    try {
      const template = Deno.readTextFileSync(filePath);
      return this.parseString(template);
    } catch (error) {
      throw new Error(`Failed to load template file: ${filePath}. ${error}`);
    }
  }

  /**
   * Parse template string and replace variables
   */
  public parseString(template: string): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      const value = this.variables[variableName];
      
      if (value === undefined) {
        console.warn(`Warning: Variable '${variableName}' not found, keeping placeholder`);
        return match; // Keep original placeholder if variable not found
      }
      
      return String(value);
    });
  }

  /**
   * Update variables (useful for reusing parser with different data)
   */
  public setVariables(variables: TemplateVariables): void {
    this.variables = { ...this.variables, ...variables };
  }

  /**
   * Set a single variable
   */
  public setVariable(key: string, value: string | number | boolean): void {
    this.variables[key] = value;
  }

  /**
   * Get current variables
   */
  public getVariables(): TemplateVariables {
    return { ...this.variables };
  }

  /**
   * Clear all variables
   */
  public clearVariables(): void {
    this.variables = {};
  }

  /**
   * Check if template has any unresolved variables
   */
  public hasUnresolvedVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g) || [];
    return matches
      .map(match => match.slice(2, -2)) // Remove {{ }}
      .filter(varName => this.variables[varName] === undefined);
  }

  /**
   * Write parsed template to file
   */
  public async writeToFile(template: string, outputPath: string): Promise<void> {
    const parsed = this.parseString(template);
    await Deno.writeTextFile(outputPath, parsed);
  }

  /**
   * Write parsed template to file synchronously
   */
  public writeToFileSync(template: string, outputPath: string): void {
    const parsed = this.parseString(template);
    Deno.writeTextFileSync(outputPath, parsed);
  }
}

// Async helper function
export async function createRagPrompt(
  templatePath: string, 
  contextData: string, 
  userQuestion: string
): Promise<string> {
  const parser = new TemplateParser({
    CONTEXT_DATA: contextData,
    USER_QUESTION: userQuestion
  });
  
  return await parser.parseFile(templatePath);
}

// Sync helper function
export function createRagPromptSync(
  templatePath: string, 
  contextData: string, 
  userQuestion: string
): string {
  const parser = new TemplateParser({
    CONTEXT_DATA: contextData,
    USER_QUESTION: userQuestion
  });
  
  return parser.parseFileSync(templatePath);
}

// Alternative: if you want to keep templates in code instead of files
export class InlineTemplateParser extends TemplateParser {
  private templates: Map<string, string> = new Map();

  /**
   * Register a template with a name
   */
  public registerTemplate(name: string, template: string): void {
    this.templates.set(name, template);
  }

  /**
   * Parse a registered template
   */
  public parseTemplate(templateName: string): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }
    return this.parseString(template);
  }

  /**
   * List all registered templates
   */
  public getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Load multiple templates from a directory
   */
  public async loadTemplatesFromDir(dirPath: string): Promise<void> {
    try {
      for await (const entry of Deno.readDir(dirPath)) {
        if (entry.isFile && entry.name.endsWith('.txt')) {
          const templateName = entry.name.replace('.txt', '');
          const templatePath = `${dirPath}/${entry.name}`;
          const template = await Deno.readTextFile(templatePath);
          this.registerTemplate(templateName, template);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load templates from directory: ${dirPath}. ${error}`);
    }
  }

  /**
   * Load multiple templates from a directory synchronously
   */
  public loadTemplatesFromDirSync(dirPath: string): void {
    try {
      for (const entry of Deno.readDirSync(dirPath)) {
        if (entry.isFile && entry.name.endsWith('.txt')) {
          const templateName = entry.name.replace('.txt', '');
          const templatePath = `${dirPath}/${entry.name}`;
          const template = Deno.readTextFileSync(templatePath);
          this.registerTemplate(templateName, template);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load templates from directory: ${dirPath}. ${error}`);
    }
  }
}

// Example usage:
/*
// Async approach
const ragPrompt = await createRagPrompt(
  './prompts/rag.txt',
  'product data...',
  'user search...'
);

// Sync approach (good for CLI tools)
const ragPromptSync = createRagPromptSync(
  './prompts/rag.txt', 
  'product data...',
  'user search...'
);

// Batch load templates from directory
const parser = new InlineTemplateParser();
await parser.loadTemplatesFromDir('./prompts');
parser.setVariables({ CONTEXT_DATA: 'data...', USER_QUESTION: 'query...' });
const prompt = parser.parseTemplate('rag-search');

// Usage with permissions:
// deno run --allow-read --allow-write your-script.ts
*/
