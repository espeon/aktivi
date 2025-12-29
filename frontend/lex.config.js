// file: lex.config.js
import { defineLexiconConfig } from "@atcute/lex-cli";

export default defineLexiconConfig({
  files: ["../lex/**/*.json", "../vendored/bsky/**/*.json"],
  pull: {
    outdir: "../vendored/bsky",
    clean: true,
    sources: [
      {
        type: "git",
        remote: "https://github.com/bluesky-social/atproto.git",
        ref: "main",
        pattern: ["lexicons/**/*.json"],
      },
    ],
  },
  outdir: "src/lex/",
});
