import { MessageResponse } from "millegrilles.reactdeps.typescript";

/**
 * Equivalent to Rust's type ApplicationLabels = HashMap<String, String>;
 */
export type ApplicationLabels = Record<string, string>;

export interface WebItem {
  /** Optional field from Rust Option<bool> */
  admin?: boolean;
  /** Optional field from Rust Option<u16> */
  port?: number;
  /** Optional field from Rust Option<String> */
  path?: string;
  /** Optional field from Rust Option<ApplicationLabels> */
  labels?: ApplicationLabels;
  /** Optional field from Rust Option<bool> */
  api?: boolean;
  /** Optional field from Rust Option<String> */
  url?: string;
}

export interface ApplicationInfo {
  name: string;
  version: string;
  securite?: string;
  labels: ApplicationLabels;
  path?: string;
  web?: WebItem[];
}

export interface ApplicationStatusV2 {
  instance_id: string;
  /** HashMap<String, ApplicationInfo> */
  applications: Record<string, ApplicationInfo>;
  securite: string;
  supprime: boolean;
  /** ISO 8601 string representation of DateTime<Utc> */
  timestamp: string;
}

export interface ReponseListeApplicationsDeployeesV2 {
  ok: boolean;
  err?: string;
  results: ApplicationStatusV2[];
  __original?: any;
}
