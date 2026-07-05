import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` makes the build use relative asset paths, so it works
// whether it's served from https://<user>.github.io/<repo>/ or any
// other subpath, with no extra config needed.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
