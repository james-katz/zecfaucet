self.onmessage = async (e) => {
    const { message, difficulty, offset = 0, stride = 1 } = e.data;
    const targetPrefix = '0'.repeat(difficulty);
    const encoder = new TextEncoder();
  
    const toHex = (buffer) =>
      Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
  
    let nonce = offset;
    let counter = 0;
    let bestHash = 'f'.repeat(64);
    let bestNonce = 0;
  
    while (true) {
      const input = encoder.encode(message + nonce);
      const hashBuffer = await crypto.subtle.digest('SHA-256', input);
      const hashHex = toHex(hashBuffer);
  
      if (hashHex < bestHash) {
        bestHash = hashHex;
        bestNonce = nonce;
      }
  
      if (hashHex.startsWith(targetPrefix)) {
        self.postMessage({ type: 'result', data: { nonce, hash: hashHex } });
        break;
      }
  
      nonce += stride;
      counter++;
  
      if (counter % 1000 === 0) {
        self.postMessage({
          type: 'progress',
          data: {
            delta: 1000,
            hash: bestHash,
            nonce: bestNonce,
          },
        });
      }
    }
};
  