export function decodeBase64(data:any) {
    return JSON.parse(Buffer.from(data, 'base64').toString());
}