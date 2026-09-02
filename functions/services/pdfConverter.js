const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

/**
 * Convert a Word document (docx) buffer to PDF using LibreOffice
 * This preserves all formatting, colors, fonts, and branding from the original Word doc
 *
 * @param {Buffer} docxBuffer - The Word document buffer to convert
 * @param {string} filename - Optional filename (default: proposal.docx)
 * @returns {Promise<Buffer>} - The PDF file as a buffer
 */
async function convertWordToPDF(docxBuffer, filename = 'proposal.docx') {
  let tempDir = null;
  let inputPath = null;
  let outputPath = null;

  try {
    // Create temporary directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx2pdf-'));
    console.log('[pdfConverter] Created temp directory:', tempDir);

    // Write docx buffer to temporary file
    inputPath = path.join(tempDir, filename);
    fs.writeFileSync(inputPath, docxBuffer);
    console.log('[pdfConverter] Wrote docx to temp file:', inputPath, 'Size:', docxBuffer.length);

    // Prepare output path (LibreOffice will create the PDF here)
    const baseFilename = path.parse(filename).name;
    outputPath = path.join(tempDir, baseFilename + '.pdf');

    // Convert using LibreOffice headless
    console.log('[pdfConverter] Starting LibreOffice conversion...');
    try {
      const command = `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${inputPath}"`;
      console.log('[pdfConverter] Executing command:', command);
      const result = execSync(command, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024  // 10MB buffer for large documents
      });
      console.log('[pdfConverter] LibreOffice output:', result);
    } catch (error) {
      console.error('[pdfConverter] LibreOffice conversion error:', error.message);
      console.error('[pdfConverter] stderr:', error.stderr);
      console.error('[pdfConverter] stdout:', error.stdout);
      throw new Error(`LibreOffice conversion failed: ${error.message}`);
    }

    // Read the generated PDF
    if (!fs.existsSync(outputPath)) {
      throw new Error(`PDF file not created at ${outputPath}. Check LibreOffice installation.`);
    }

    const pdfBuffer = fs.readFileSync(outputPath);
    console.log('[pdfConverter] PDF generated successfully. Size:', pdfBuffer.length);

    return pdfBuffer;

  } catch (error) {
    console.error('[pdfConverter] Conversion failed:', error.message);
    throw error;
  } finally {
    // Clean up temporary files
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('[pdfConverter] Cleaned up temp directory:', tempDir);
      } catch (cleanupError) {
        console.warn('[pdfConverter] Warning: Failed to clean up temp directory:', cleanupError.message);
      }
    }
  }
}

module.exports = {
  convertWordToPDF
};
