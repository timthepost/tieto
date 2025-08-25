#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// Simple token estimation based on common patterns
// This approximates how modern tokenizers work without external dependencies

typedef struct {
    int tokens;
    int words;
    int chars;
} TokenStats;

// Check if character is a word separator
int is_separator(char c) {
    return isspace(c) || ispunct(c);
}

// Check if character sequence looks like a programming construct
int is_code_pattern(const char* str, int pos, int len) {
    // Common programming patterns that often get tokenized specially
    const char* patterns[] = {
        "->", "++", "--", "==", "!=", "<=", ">=", "&&", "||", 
        "<<", ">>", "+=", "-=", "*=", "/=", "%=", "^=", "&=", "|=",
        "::", "//", "/*", "*/", "/**", "{", "}", "[", "]", "(", ")",
	    ";"
    };

    int num_patterns = sizeof(patterns) / sizeof(patterns[0]);
    
    for (int i = 0; i < num_patterns; i++) {
        int pattern_len = strlen(patterns[i]);
        if (pos + pattern_len <= len && 
            strncmp(str + pos, patterns[i], pattern_len) == 0) {
            return pattern_len;
        }
    }
    return 0;
}

// Estimate tokens for a given text
TokenStats estimate_tokens(const char* text) {
    TokenStats stats = {0, 0, 0};
    int len = strlen(text);
    int i = 0;
    
    stats.chars = len;
    
    while (i < len) {
        char c = text[i];
        
        // Skip whitespace
        if (isspace(c)) {
            while (i < len && isspace(text[i])) {
                i++;
            }
            continue;
        }
        
        // Check for programming patterns first
        int pattern_len = is_code_pattern(text, i, len);
        if (pattern_len > 0) {
            stats.tokens++;
            i += pattern_len;
            continue;
        }
        
        // Handle different character types
        if (isalpha(c)) {
            // Word token - count consecutive letters/digits/underscores
            int word_start = i;
            while (i < len && (isalnum(text[i]) || text[i] == '_')) {
                i++;
            }
            
            int word_len = i - word_start;
            stats.words++;
            
            // Longer words might be split into multiple tokens
            // This is a rough approximation of subword tokenization
            if (word_len <= 4) {
                stats.tokens++;
            } else if (word_len <= 8) {
                stats.tokens += 2;
            } else {
                // Very long words get split more
                stats.tokens += (word_len + 3) / 4;
            }
            
        } else if (isdigit(c)) {
            // Number token
            while (i < len && (isdigit(text[i]) || text[i] == '.')) {
                i++;
            }
            stats.tokens++;
            
        } else {
            // Punctuation and symbols
            // Most punctuation is individual tokens
            if (c == '"' || c == '\'') {
                // String literals - scan to end quote
                char quote = c;
                i++; // skip opening quote
                stats.tokens++; // quote token
                
                int string_chars = 0;
                while (i < len && text[i] != quote) {
                    if (text[i] == '\\' && i + 1 < len) {
                        i += 2; // skip escaped character
                        string_chars += 2;
                    } else {
                        i++;
                        string_chars++;
                    }
                }
                
                // String content - rough estimate
                stats.tokens += (string_chars + 3) / 4;
                
                if (i < len) {
                    i++; // skip closing quote
                    stats.tokens++; // closing quote token
                }
            } else {
                // Regular punctuation
                stats.tokens++;
                i++;
            }
        }
    }
    
    return stats;
}

// More sophisticated estimation that considers context
int estimate_tokens_advanced(const char* text) {
    TokenStats basic = estimate_tokens(text);
    
    // Adjust based on content type heuristics
    float multiplier = 1.0;
    
    // Check if this looks like code
    int code_indicators = 0;
    int text_len = strlen(text);
    
    // Count programming-like patterns
    for (int i = 0; i < text_len - 1; i++) {
        if ((text[i] == '{' || text[i] == '}' || text[i] == ';' || 
             text[i] == '(' || text[i] == ')' || text[i] == '[' || 
             text[i] == ']') && 
            (i == 0 || !isalpha(text[i-1]))) {
            code_indicators++;
        }
    }
    
    // If it looks like code, tokens tend to be smaller
    if (code_indicators > basic.words / 10) {
        multiplier = 1.2; // Code tends to have more tokens per word
    }
    
    // Natural language tends to have fewer tokens per word
    if (code_indicators < basic.words / 20 && basic.words > 10) {
        multiplier = 0.85;
    }
    
    return (int)(basic.tokens * multiplier);
}

// Simple function for quick estimates
int quick_token_estimate(const char* text) {
    // Very rough rule of thumb: ~4 characters per token for English text
    // ~3 characters per token for code
    int len = strlen(text);
    if (len == 0) return 0;
    
    // Quick heuristic: if lots of punctuation, probably code
    int punct_count = 0;
    for (int i = 0; i < len; i++) {
        if (ispunct(text[i])) punct_count++;
    }
    
    if (punct_count > len / 20) {
        // Looks like code
        return (len + 2) / 3;
    } else {
        // Looks like natural language
        return (len + 3) / 4;
    }
}

void print_stats(const char* label, const char* text) {
    TokenStats stats = estimate_tokens(text);
    int advanced = estimate_tokens_advanced(text);
    int quick = quick_token_estimate(text);
    
    printf("\n=== %s ===\n", label);
    printf("Text             : %.60s%s\n", text, strlen(text) > 60 ? "..." : "");
    printf("Characters       : %d\n", stats.chars);
    printf("Words            : %d\n", stats.words);
    printf("Estimated Tokens : %d\n", stats.tokens);
    printf("Guessed Tokens   : %d\n", quick);
    printf("Ratio (c/t)      : %.2f\n", stats.chars / (float)stats.tokens);
}

int main() {
    // Test with different types of content
    
    const char* samples[] = {
        "Hello world! This is a simple test sentence.",
        
        "int main() { printf(\"Hello\\n\"); return 0; }",
        
        "The quick brown fox jumps over the lazy dog. This is a longer sentence with more complex vocabulary and sophisticated linguistic structures.",
        
        "function calculateFactorial(n) {\n  if (n <= 1) return 1;\n  return n * calculateFactorial(n - 1);\n}",
        
        "import numpy as np\nfrom sklearn.model_selection import train_test_split\nX_train, X_test = train_test_split(data, test_size=0.2)",
        
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
    };
    
    const char* labels[] = {
        "Simple English",
        "C Code",
        "Complex English", 
        "JavaScript Code",
        "Python Code",
        "Latin Text"
    };
    
    int num_samples = sizeof(samples) / sizeof(samples[0]);
    
    printf("Token Count Estimator\n");
    printf("=====================\n");
    printf("c/t = characters to token.\ncpt = characters per token.\n");
    printf("Estimated: Factors basic code patterns only, educated guess.\n");
    printf("Guessed: Goes only by ~4cpt for text, ~3cpt for code.\n");
    
    for (int i = 0; i < num_samples; i++) {
        print_stats(labels[i], samples[i]);
    }
    
    // Interactive mode
    printf("\n\nEnter text to analyze (or 'quit' to exit):\n");
    char input[4096];
    
    while (1) {
        printf("\n> ");
        if (!fgets(input, sizeof(input), stdin)) break;
        
        // Remove newline
        input[strcspn(input, "\n")] = 0;
        
        if (strcmp(input, "quit") == 0) break;
        if (strlen(input) == 0) continue;
        
        print_stats("User Input", input);
    }
    
    return 0;
}
