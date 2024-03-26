import { AesGcmKey } from "../encryption/encryption.js";


/**
 * Note that this function may not work well for large files,
 * since the entire file is loaded into memory before being encrypted and
 * the entire encrypted output is also stored in memory.
 * Consider reading chunks of data in the future for large files
 * @param file 
 * @param key 
 * @returns 
 */
export async function encryptFile(file: File, key: AesGcmKey) {
  let reader = new FileReader();

  reader.readAsArrayBuffer(file);

  return new Promise<File>((resolve, reject) => {
    reader.onload = async (ev) => {
      let data = reader.result as ArrayBuffer;

      let encData = await key.encrypt(data, "arraybuffer");

      resolve(new File([encData], "file"));
    }

    reader.onerror = (ev) => {
      reject(reader.error);
    }
  });

  
}

export async function encryptFileAsStream(file: File, key: AesGcmKey) {
  let reader = new FileReader();

  reader.readAsArrayBuffer(file);

  return new Promise<File>((resolve, reject) => {
    reader.onload = async (ev) => {
      let data = reader.result as ArrayBuffer;

      let encData = await key.encrypt(data, "arraybuffer");

      resolve(new File([encData], "file"));
    }

    reader.onerror = (ev) => {
      reject(reader.error);
    }
  });

  
}