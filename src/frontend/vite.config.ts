import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "child_process";
import { defineConfig } from "vite";

const commitHash = execSync("git rev-parse --short HEAD").toString().trim();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [reactRouter(), tailwindcss()],
  server: {
    proxy: {
      "^/(api|backoffice)": {
        target: "https://localhost:7240",
        secure: false,
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
