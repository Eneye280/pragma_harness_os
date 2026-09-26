export type LicenseRisk = "ok" | "warn" | "block";

export interface LicenseEntry {
  name: string;
  version?: string;
  license: string;
  url?: string;
}

export interface LicenseAssessment {
  name: string;
  license: string;
  risk: LicenseRisk;
  reason: string;
}

const PERMISSIVE = ["mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "isc", "0bsd", "unlicense", "cc0-1.0"];
const WEAK_COPYLEFT = ["lgpl-2.1", "lgpl-3.0", "mpl-2.0", "epl-2.0", "cddl-1.0"];
const STRONG_COPYLEFT = ["gpl-2.0", "gpl-3.0", "agpl-3.0", "sspl-1.0", "bsl-1.1"];

function normalize(license: string): string {
  return license.trim().toLowerCase().replace(/\s+/g, "-");
}

function isPermissiveProject(projectLicense: string): boolean {
  return PERMISSIVE.includes(normalize(projectLicense));
}

export function assessLicense(name: string, license: string, projectLicense = "MIT"): LicenseAssessment {
  const normalized = normalize(license);
  if (!normalized || normalized === "unknown") {
    return { name, license, risk: "warn", reason: "licencia desconocida: verifica el repo antes de usarla" };
  }
  if (PERMISSIVE.includes(normalized)) {
    return { name, license, risk: "ok", reason: "permisiva: requiere atribución" };
  }
  if (WEAK_COPYLEFT.includes(normalized)) {
    return { name, license, risk: "warn", reason: "copyleft débil: documenta el uso y cumple obligaciones" };
  }
  if (STRONG_COPYLEFT.includes(normalized)) {
    return isPermissiveProject(projectLicense)
      ? { name, license, risk: "block", reason: `copyleft fuerte incompatible con proyecto ${projectLicense}` }
      : { name, license, risk: "warn", reason: "copyleft fuerte: revisa compatibilidad de todo el proyecto" };
  }
  return { name, license, risk: "warn", reason: "licencia no reconocida: revisa manualmente" };
}

export function assessAll(entries: LicenseEntry[], projectLicense = "MIT"): LicenseAssessment[] {
  return entries.map((entry) => assessLicense(entry.name, entry.license, projectLicense));
}

export function buildThirdPartyMarkdown(entries: LicenseEntry[]): string {
  const lines = ["# Third-party notices", "", "| Paquete | Versión | Licencia | Origen |", "| --- | --- | --- | --- |"];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    lines.push(`| ${entry.name} | ${entry.version ?? "-"} | ${entry.license} | ${entry.url ?? "-"} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function hasBlockingLicense(assessments: LicenseAssessment[]): boolean {
  return assessments.some((assessment) => assessment.risk === "block");
}
