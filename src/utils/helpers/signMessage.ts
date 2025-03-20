export function signMessage(key: any, data: any) {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', key).update(data).digest('hex');
}