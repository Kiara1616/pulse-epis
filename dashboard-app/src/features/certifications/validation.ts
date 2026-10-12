export const EVIDENCE_MAX_BYTES = 10_000_000;
export const EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export type CertificationFormValues = {
  credential_name: string;
  issuer_name: string;
  issued_on: string;
  expires_on: string;
  source_url: string;
  skills: string;
};

export type CertificationFormErrors = Partial<
  Record<keyof CertificationFormValues | "file", string>
>;

function isDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function validateUrl(value: string) {
  if (!value) return null;
  if (value.length > 2048) return "La URL no puede superar 2048 caracteres.";
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return "Usa una URL HTTP(S) válida sin usuario ni contraseña.";
    }
  } catch {
    return "Usa una URL HTTP(S) válida.";
  }
  return null;
}

function validateFile(file: File | null | undefined) {
  if (!file) return null;
  if (file.size === 0) return "El archivo no puede estar vacío.";
  if (file.size > EVIDENCE_MAX_BYTES) {
    return "El archivo no puede superar los 10 MB.";
  }
  if (!EVIDENCE_MIME_TYPES.includes(file.type as (typeof EVIDENCE_MIME_TYPES)[number])) {
    return "Formato no admitido. Usa un archivo PDF, PNG o JPEG.";
  }
  return null;
}

export function validateCertificationForm(
  values: CertificationFormValues,
  file?: File | null,
): CertificationFormErrors {
  const errors: CertificationFormErrors = {};
  const credentialName = values.credential_name.trim();
  const issuerName = values.issuer_name.trim();
  const issuedOn = values.issued_on.trim();
  const expiresOn = values.expires_on.trim();
  const skills = values.skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  if (!credentialName) errors.credential_name = "Indica el nombre de la certificación.";
  else if (credentialName.length > 200) {
    errors.credential_name = "El nombre no puede superar 200 caracteres.";
  }

  if (!issuerName) errors.issuer_name = "Indica la entidad emisora.";
  else if (issuerName.length > 150) {
    errors.issuer_name = "La entidad no puede superar 150 caracteres.";
  }

  if (!issuedOn) errors.issued_on = "Indica la fecha de emisión.";
  else if (!isDateInput(issuedOn)) errors.issued_on = "Indica una fecha de emisión válida.";

  if (expiresOn && !isDateInput(expiresOn)) {
    errors.expires_on = "Indica una fecha de vencimiento válida.";
  } else if (expiresOn && issuedOn && expiresOn < issuedOn) {
    errors.expires_on = "La fecha de vencimiento no puede ser anterior a la emisión.";
  }

  const urlError = validateUrl(values.source_url.trim());
  if (urlError) errors.source_url = urlError;

  if (!skills.length) {
    errors.skills = "Indica al menos una habilidad.";
  } else if (skills.length > 20) {
    errors.skills = "Puedes registrar hasta 20 habilidades.";
  } else if (skills.some((skill) => skill.length > 150)) {
    errors.skills = "Cada habilidad puede tener hasta 150 caracteres.";
  } else if (new Set(skills.map((skill) => skill.toLocaleLowerCase())).size !== skills.length) {
    errors.skills = "No repitas habilidades en el mismo registro.";
  }

  const fileError = validateFile(file);
  if (fileError) errors.file = fileError;

  return errors;
}

export function hasCertificationFormErrors(errors: CertificationFormErrors) {
  return Object.keys(errors).length > 0;
}
