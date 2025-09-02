import { parse } from "https://deno.land/std@0.208.0/csv/mod.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";

/**
 * A simple function to sanitize a string for use in a filename.
 * Converts to lowercase, trims whitespace, and replaces invalid characters with underscores.
 */
function slugify(text: string): string {
  if (!text) return "unknown";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") // Replace spaces with _
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "_"); // Replace multiple - with single _
}

/**
 * Creates the descriptive, human-friendly name for the symbolic link.
 *
 * ## How to Customize the Symlink Name ##
 * Modify this function to change the symlink's naming convention.
 * You can add more fields, change the separator, or apply different logic.
 */
function createSymlinkName(strain: Record<string, string>): string {
  const name = slugify(strain.Strain);
  const type = slugify(strain.Type);
  // Using 'Rating' as a placeholder for a value like THC content.
  const rating = slugify(strain.Rating);

  // Example: northern_lights:~:indica:~:5.md
  const symlink = `${name}:~:${type}:~:${rating}.md`;

  // To add more data, just append it. For example:
  // const flavor = slugify(strain.Flavor.split(',')[0]); // get first flavor
  // const symlinkWithFlavor = `${name}:~:${type}:~:${rating}:~:${flavor}.md`;

  return symlink;
}

/**
 * Main function to process the CSV and generate files.
 */
async function processCsv(csvPath: string, outputDir: string) {
  // 1. Ensure the output directory exists.
  await ensureDir(outputDir);

  // 2. Open and read the CSV file.
  const fileContent = await Deno.readTextFile(csvPath);
  const strains = parse(fileContent, {
    skipFirstRow: true, // The cannabis.csv file has a header row
    columns: ["Strain", "Type", "Rating", "Effects", "Flavor", "Description"],
  });

  // 3. Process each row (strain) from the CSV.
  console.log(`Starting processing of ${csvPath}...`);
  let count = 0;
  for await (const strain of strains) {
    // Generate a unique ID for the actual filename
    const uuid = crypto.randomUUID();
    const actualFileName = `${uuid}.md`;
    const actualFilePath = join(outputDir, actualFileName);

    // ## How to Customize Front Matter and Markdown Content ##

    // A. Define which CSV columns go into the YAML front matter.
    // This is ideal for structured, filterable data.
    const frontMatter = {
      strain: strain.Strain,
      type: strain.Type,
      rating: parseFloat(strain.Rating) || 0,
      // The 'Flavor' and 'Effects' fields are comma-separated strings.
      // It's best to store them as a YAML list (array) for easier parsing later.
      flavors: strain.Flavor?.split(",").map((f) => f.trim()) || [],
      effects: strain.Effects?.split(",").map((e) => e.trim()) || [],
      // You would add other structured data like THC/CBD levels here.
      // example_thc_a: 19.5,
      // example_cbd: 0.8,
    };

    // B. Define what content goes into the main markdown body.
    // This is for the unstructured text that the LLM will primarily use.
    const markdownBody = `
# ${strain.Strain}

## Description
${strain.Description || "No description available."}
`;

    // C. Combine front matter and markdown body into the final file content.
    const fileContent = `---
${
      Object.entries(frontMatter)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join("\n")
    }
---
${markdownBody}
`;

    // 4. Write the actual file (e.g., "d290f1ee-6c54-4b01-90e6-d701748f0851.md").
    await Deno.writeTextFile(actualFilePath, fileContent);

    // 5. Create the descriptive symbolic link to the actual file.
    const symlinkName = createSymlinkName(strain);
    const symlinkPath = join(outputDir, symlinkName);

    try {
      // Deno.symlink requires the target path to be relative to the link, or an absolute path.
      // Using the simple filename is sufficient when they are in the same directory.
      await Deno.symlink(actualFileName, symlinkPath);
    } catch (error) {
      console.error(
        `Could not create symlink ${symlinkName}. It might already exist or you are on a system that restricts it.`,
        error,
      );
    }

    count++;
  }
  console.log(`✅ Success! Processed ${count} strains into ${outputDir}`);
}

// --- Script Execution ---
if (import.meta.main) {
  const [csvPath, outputDir] = Deno.args;

  if (!csvPath || !outputDir) {
    console.error("🔥 Error: Missing arguments.");
    console.error(
      "Usage: deno run --allow-read --allow-write process_strains.ts <path_to_csv> <output_directory>",
    );
    Deno.exit(1);
  }

  await processCsv(csvPath, outputDir);
}
