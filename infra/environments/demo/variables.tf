variable "project_id" {
  description = "GCP project that will contain the Pulse EPIS demo."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Cloud SQL and Storage."
  type        = string
  default     = "southamerica-west1"
}

variable "environment" {
  type    = string
  default = "demo"
}

variable "app_image" {
  description = "Immutable backend API image stored in Artifact Registry."
  type        = string
}

variable "frontend_image" {
  description = "Immutable Next.js frontend image stored in Artifact Registry. It must be built with api_public_url as NEXT_PUBLIC_API_URL."
  type        = string
}

variable "etl_image" {
  description = "Immutable ETL image stored in Artifact Registry."
  type        = string
}

variable "api_public_url" {
  description = "Public HTTPS origin of the API, normally a mapped custom domain."
  type        = string
  validation {
    condition     = can(regex("^https://[^/]+$", var.api_public_url))
    error_message = "api_public_url must be an HTTPS origin without a trailing path."
  }
}

variable "frontend_origin" {
  description = "Public HTTPS origin of the web portal used for CORS and OIDC redirects."
  type        = string
  validation {
    condition     = can(regex("^https://[^/]+$", var.frontend_origin))
    error_message = "frontend_origin must be an HTTPS origin without a trailing slash."
  }
}

variable "google_client_id" {
  description = "Google OIDC client ID authorized for the API callback URL."
  type        = string
  validation {
    condition     = length(trimspace(var.google_client_id)) > 10
    error_message = "google_client_id must be configured for cloud authentication."
  }
}

variable "google_client_secret" {
  description = "Google OIDC client secret. Stored in Secret Manager by Terraform."
  type        = string
  sensitive   = true
  validation {
    condition     = length(trimspace(var.google_client_secret)) >= 16
    error_message = "google_client_secret must contain at least 16 characters."
  }
}

variable "scheduler_cron" {
  type    = string
  default = "0 5 * * *"
}

variable "scheduler_timezone" {
  type    = string
  default = "America/Lima"
}

variable "cloud_sql_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "monthly_budget_usd" {
  description = "Optional monthly budget. Leave at zero when billing account is not managed here."
  type        = number
  default     = 0
}

variable "billing_account" {
  description = "Billing account ID used only when monthly_budget_usd is greater than zero."
  type        = string
  default     = ""
}

variable "labels" {
  type = map(string)
  default = {
    application = "pulse-epis"
    managed_by  = "terraform"
  }
}
