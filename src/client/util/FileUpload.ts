import { AesGcmKey, ECDSAPrivateKey } from "../encryption/encryption.js";


/**
 * Note that this function may not work well for large files,
 * since the entire file is loaded into memory before being encrypted and
 * the entire encrypted output is also stored in memory.
 * Consider reading chunks of data in the future for large files
 * @param file 
 * @param key 
 * @returns 
 */
export async function encryptFile(file: File, encKey: AesGcmKey, signingKey: ECDSAPrivateKey) {
  let reader = new FileReader();

  reader.readAsArrayBuffer(file);

  return new Promise<{encFile: File, signatureBase64: string}>((resolve, reject) => {
    reader.onload = async (ev) => {
      let data = reader.result as ArrayBuffer;

      let encData = await encKey.encrypt(data, "arraybuffer");

      let sig = await signingKey.sign(encData, "base64");
      resolve({
        encFile: new File([encData], "file"),
        signatureBase64: sig
      });
    }

    reader.onerror = (ev) => {
      reject(reader.error);
    }
  });

  
}

export function downloadFile(file: File, filename?: string) {
  let fileUrl = URL.createObjectURL(file);
  let link = document.createElement('a');

  link.setAttribute('href',fileUrl);
  link.setAttribute('download', filename ? filename : file.name);

  link.click(); //download file

  URL.revokeObjectURL(fileUrl);
}