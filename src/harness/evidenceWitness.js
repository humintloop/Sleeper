/**
 * Optional external witness boundary. SLEEPER deliberately contains no remote
 * signer and no embedded private key. A future integration supplies an object
 * with attest(request) and verify(receipt, request); only verified receipts are
 * attached or allowed to raise the signed/replay-resistant flags.
 */
export async function attachExternalWitness(contract, witness = null) {
  if (!witness) return contract;
  const request = {
    protocol_version: '1.0.0',
    contract_digest: contract?.integrity?.digest ?? null,
    contract_version: contract?.contract_version ?? null,
    manifest_digest: contract?.run_manifest?.manifest_digest ?? null,
    case_id: contract?.case_id ?? null,
  };
  try {
    if (!request.contract_digest) throw new Error('Contract must have a self-digest before witnessing.');
    if (typeof witness.attest !== 'function' || typeof witness.verify !== 'function') {
      throw new Error('Witness must implement attest() and verify().');
    }
    const receipt = await witness.attest(request);
    const verified = await witness.verify(receipt, request);
    if (verified !== true) throw new Error('Witness receipt signature did not verify.');
    if (typeof receipt?.signature !== 'string' || receipt.signature.length === 0) {
      throw new Error('Verified witness receipt did not contain a signature.');
    }
    if (typeof receipt?.key_id !== 'string' || receipt.key_id.length === 0) {
      throw new Error('Verified witness receipt did not identify its signing key.');
    }
    if (receipt?.contract_digest !== request.contract_digest) {
      throw new Error('Witness receipt is bound to a different contract digest.');
    }
    const replayResistant =
      receipt.append_only === true &&
      Number.isInteger(receipt.sequence) &&
      receipt.sequence > 0 &&
      typeof receipt.nonce === 'string' &&
      receipt.nonce.length >= 16 &&
      typeof receipt.timestamp === 'string';
    return {
      ...contract,
      integrity: {
        ...contract.integrity,
        signed: true,
        authenticity: 'verified_external_witness',
        replay_resistant: replayResistant,
        external_witness: { ...receipt, verified: true },
        limitation: replayResistant
          ? 'The external receipt verified and declares append-only sequencing. Trust now depends on the witness key, verifier, and log operation.'
          : 'The external signature verified, but the receipt lacks the sequencing, nonce, timestamp, or append-only assertion required for replay resistance.',
      },
    };
  } catch (error) {
    return {
      ...contract,
      integrity: {
        ...contract.integrity,
        external_witness: {
          verified: false,
          error: error?.message ?? String(error),
        },
      },
    };
  }
}
