import { FastifyRequest } from 'fastify';

export async function parseMultipart(req: FastifyRequest) {
  return new Promise<{ fields: any; fileBuffer: Buffer | null; fileName: string; mimeType: string }>((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!match) return reject(new Error('No multipart boundary'));
    
    const boundary = match[1] || match[2];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    
    let bodyBuffer = Buffer.alloc(0);
    
    req.raw.on('data', (chunk) => {
      bodyBuffer = Buffer.concat([bodyBuffer, chunk]);
    });
    
    req.raw.on('end', () => {
      try {
        const fields: any = {};
        let fileBuffer: Buffer | null = null;
        let fileName = '';
        let mimeType = '';
        
        let offset = 0;
        while (offset < bodyBuffer.length) {
          const partStart = bodyBuffer.indexOf(boundaryBuffer, offset);
          if (partStart === -1) break;
          
          const partEnd = bodyBuffer.indexOf(boundaryBuffer, partStart + boundaryBuffer.length);
          if (partEnd === -1) break;
          
          const part = bodyBuffer.subarray(partStart + boundaryBuffer.length, partEnd);
          
          const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
          if (headerEnd !== -1) {
            const headerString = part.subarray(0, headerEnd).toString('utf-8');
            const data = part.subarray(headerEnd + 4, part.length - 2); // remove trailing \r\n
            
            const nameMatch = headerString.match(/name="([^"]+)"/);
            const name = nameMatch ? nameMatch[1] : null;
            
            if (name) {
              const filenameMatch = headerString.match(/filename="([^"]+)"/);
              if (filenameMatch) {
                fileName = filenameMatch[1];
                const contentMatch = headerString.match(/Content-Type:\s*([^\r\n]+)/i);
                mimeType = contentMatch ? contentMatch[1] : 'application/octet-stream';
                fileBuffer = data;
              } else {
                fields[name] = data.toString('utf-8');
              }
            }
          }
          offset = partEnd;
        }
        
        resolve({ fields, fileBuffer, fileName, mimeType });
      } catch (err) {
        reject(err);
      }
    });
    
    req.raw.on('error', reject);
  });
}
