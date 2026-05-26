import JSZip from "jszip";

/**
 * Packs the generated React form component code into a complete Vite + React project structure
 * and downloads it as a ZIP file.
 * 
 * @param {string} generatedFormCode - The React component source code
 */
export async function downloadReactProject(generatedFormCode) {
  const zip = new JSZip();

  // 1. package.json for standard React + Vite template with Tailwind CSS dependencies
  const packageJson = `{
  "name": "generated-form-project",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.0"
  }
}`;

  // 2. Vite Config
  const viteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
});
`;

  // 3. Tailwind Configuration
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;

  // 4. PostCSS Configuration
  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  // 5. index.html
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated Form Project</title>
  </head>
  <body class="bg-gray-50 text-gray-900">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;

  // 6. src/main.jsx
  const mainJsx = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

  // 7. src/index.css
  const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
}
`;

  // 8. src/App.jsx
  const appJsx = `import GeneratedForm from "./components/GeneratedForm.jsx";

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GeneratedForm />
    </div>
  );
}

export default App;
`;

  // Write all template files to the Zip archive
  zip.file("package.json", packageJson);
  zip.file("vite.config.js", viteConfig);
  zip.file("tailwind.config.js", tailwindConfig);
  zip.file("postcss.config.js", postcssConfig);
  zip.file("index.html", indexHtml);
  zip.file("src/main.jsx", mainJsx);
  zip.file("src/index.css", indexCss);
  zip.file("src/App.jsx", appJsx);
  zip.file("src/components/GeneratedForm.jsx", generatedFormCode);

  // Generate ZIP blob and download it
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const downloadUrl = URL.createObjectURL(zipBlob);
  
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = "generated-form-project.zip";
  
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  
  URL.revokeObjectURL(downloadUrl);
}
