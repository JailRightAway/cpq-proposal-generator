const { spawn } = require('child_process');
const path = require('path');
const { getQuarterEndDate } = require('../utils/helpers');

/**
 * Generate a Word document proposal using direct child_process
 */
async function generateProposal(proposalData) {
  return new Promise((resolve, reject) => {
    const pythonScriptPath = path.join(__dirname, '../python/word_generator.py');

    // Calculate quarter end date
    const today = new Date();
    const quarterEndDate = getQuarterEndDate(today);

    // Prepare data for Python script
    const dataToPass = {
      customerName: proposalData.customerName,
      customerContact: proposalData.customerContact || '',
      customerEmail: proposalData.customerEmail || '',
      customerPhone: proposalData.customerPhone || '',
      billingAddress: proposalData.billingAddress || {},
      lineItems: proposalData.lineItems,
      discountAmount: proposalData.discountAmount || 0,
      discountPercentage: proposalData.discountPercentage || 0,
      generatedDate: new Date().toISOString().split('T')[0],
      quarterEndDate: quarterEndDate.toISOString().split('T')[0],
      contractTermYears: proposalData.contractTermYears || 1
    };

    console.log('[ProposalGen] Starting Python script:', pythonScriptPath);

    // Use 'python' (Windows) instead of 'python3'
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    console.log('[ProposalGen] Using Python command:', pythonCmd);

    // Spawn Python process
    const python = spawn(pythonCmd, [pythonScriptPath, JSON.stringify(dataToPass)]);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      console.log('[ProposalGen] Python stdout:', data.toString().substring(0, 100));
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      console.error('[ProposalGen] Python stderr:', data.toString());
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      console.log('[ProposalGen] Python process exited with code:', code);

      if (code !== 0) {
        console.error('[ProposalGen] Python error output:', errorOutput);
        return reject(new Error(`Python script failed: ${errorOutput || 'Unknown error'}`));
      }

      if (!output) {
        return reject(new Error('No output from Python script'));
      }

      try {
        console.log('[ProposalGen] Parsing output...');
        const result = JSON.parse(output);

        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }

        const docBuffer = Buffer.from(result.documentData, 'base64');
        console.log('[ProposalGen] Document generated, size:', docBuffer.length);
        resolve(docBuffer);
      } catch (error) {
        console.error('[ProposalGen] Error parsing result:', error.message);
        reject(error);
      }
    });

    python.on('error', (err) => {
      console.error('[ProposalGen] Failed to start Python process:', err.message);
      reject(new Error(`Failed to start Python: ${err.message}`));
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      python.kill();
      reject(new Error('Python script timeout after 30 seconds'));
    }, 30000);
  });
}

module.exports = {
  generateProposal
};
