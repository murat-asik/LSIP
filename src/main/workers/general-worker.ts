import { parentPort } from 'worker_threads';
import crypto from 'crypto';
import fs from 'fs';

parentPort?.on('message', async (message: { id: string; type: string; payload: any }) => {
  const { id, type, payload } = message;

  try {
    let result: any = null;

    switch (type) {
      case 'PING':
        result = 'PONG';
        break;

      case 'HASH_FILE': {
        const { filePath, algorithm = 'sha256' } = payload;
        result = await calculateFileHash(filePath, algorithm);
        break;
      }

      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    parentPort?.postMessage({
      id,
      success: true,
      data: result,
    });
  } catch (err: any) {
    parentPort?.postMessage({
      id,
      success: false,
      error: err.message || 'Error occurred in worker thread.',
    });
  }
});

function calculateFileHash(filePath: string, algorithm: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
