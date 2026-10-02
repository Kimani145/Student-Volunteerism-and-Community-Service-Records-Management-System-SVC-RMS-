import { generateKeyPairSync, randomBytes } from 'crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

const priv = privateKey.export({ format: 'pem', type: 'pkcs8' });
const pub = publicKey.export({ format: 'pem', type: 'spki' });

const keyId = 'k_' + randomBytes(8).toString('hex');

console.log(`CERT_SIGNING_PRIVATE_KEY="${priv.toString().replace(/\n/g, '\\n')}"`);
console.log(`CERT_SIGNING_KEY_ID="${keyId}"`);
