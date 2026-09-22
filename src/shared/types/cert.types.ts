/**
 * Certificate Scanner shared types.
 * Windows Certificate Store enumeration.
 */

export interface CertEntry {
  thumbprint: string;
  subject: string;
  issuer: string;
  storeName: string;
  storeLocation: string;
  notBefore: number;
  notAfter: number;
  hasPrivateKey: boolean;
  isSelfSigned: boolean;
  isExpired: boolean;
  algorithm: string;
}

export interface CertSummary {
  totalCerts: number;
  expiredCerts: number;
  selfSignedCerts: number;
  personalCerts: number;
  certificates: CertEntry[];
}
