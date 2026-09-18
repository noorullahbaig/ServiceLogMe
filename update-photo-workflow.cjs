const fs = require("fs");
const path = "src/components/evidence-report-editor.tsx";
let code = fs.readFileSync(path, "utf8");

// Remove uploadInput ref
code = code.replace("const uploadInput = useRef<HTMLInputElement>(null);\n", "");

// Add simulatePhoto function inside EvidenceReportEditor
const simulatePhotoFunc = `
  async function simulatePhoto() {
    const svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
      <rect width="100%" height="100%" fill="#f1f5fe"/>
      <text x="50%" y="50%" font-size="32" font-family="sans-serif" font-weight="bold" fill="#4a6ca5" text-anchor="middle" dominant-baseline="middle">Simulated Camera Capture</text>
      <text x="50%" y="60%" font-size="20" font-family="sans-serif" fill="#7d8ba1" text-anchor="middle" dominant-baseline="middle">Metadata populated via GPS</text>
    </svg>\`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const file = new File([blob], "simulated-capture.svg", { type: "image/svg+xml" });
    await receivePhoto(file, "CAMERA_CAPTURE");
  }
`;
code = code.replace("async function receivePhoto", simulatePhotoFunc + "\n  async function receivePhoto");

// Remove uploadInput JSX and update the camera button
const uploadInputRegex = /<input\s+ref=\{uploadInput\}[\s\S]*?\/>\s*<div className="photo-actions">[\s\S]*?<button[\s\S]*?onClick=\{\(\) =>[\s\S]*?cameraInput\.current\?\.click\(\)[\s\S]*?\}[\s\S]*?>[\s\S]*?Take photo"\}[\s\S]*?<\/button>\s*<button[\s\S]*?Upload existing photo[\s\S]*?<\/button>\s*<\/div>/g;

const replacement = `<div className="photo-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={uploading}
              onClick={() => void simulatePhoto()}
            >
              <Camera /> {uploading ? "Storing photo…" : "Take photo (Simulated)"}
            </button>
          </div>`;

code = code.replace(uploadInputRegex, replacement);

fs.writeFileSync(path, code);
