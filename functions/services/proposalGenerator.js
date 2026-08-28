const { generateProposal: generateWord } = require('./wordGenerator');

/**
 * Generate a Word document proposal using Node.js docx library
 */
async function generateProposal(proposalData) {
  console.log('[ProposalGen] Generating Word document using Node.js...');

  try {
    // Prepare data for Word generator
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
      contractTermYears: proposalData.contractTermYears || 1,
      yearlyTiers: proposalData.yearlyTiers || {},
      platformFee: proposalData.platformFee || 0
    };

    const docBuffer = await generateWord(dataToPass);
    console.log('[ProposalGen] Document generated, size:', docBuffer.length);
    return docBuffer;
  } catch (error) {
    console.error('[ProposalGen] Error generating document:', error.message);
    throw error;
  }
}

module.exports = {
  generateProposal
};
