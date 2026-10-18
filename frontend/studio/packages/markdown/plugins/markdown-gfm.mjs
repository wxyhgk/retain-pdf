/**
 * GitHub's Markdown the way articles are written: strikethrough takes two
 * tildes, `~~like this~~`. With one, `H~2~O` and `~300 K … ~400 K` would be
 * struck out. The blog, the Studio's block comparison and its editor all
 * read Markdown with these options, so they agree on what an article means.
 */
export const gfmOptions = { singleTilde: false };
