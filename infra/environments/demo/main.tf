locals {
  name   = "pulse-epis-${var.environment}"
  labels = merge(var.labels, { environment = var.environment })
  apis = toset([
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "storage.googleapis.com",
    "iamcredentials.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each           = local.apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = local.name
  description   = "Pulse EPIS application and ETL images"
  format        = "DOCKER"
  labels        = local.labels
  depends_on    = [google_project_service.required]
}

resource "google_storage_bucket" "lake" {
  name                        = "${var.project_id}-${local.name}-lake"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = var.environment == "demo"
  labels                      = local.labels

  versioning {
    enabled = true
  }
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

resource "google_storage_bucket" "evidence" {
  name                        = "${var.project_id}-${local.name}-evidence"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false
  labels                      = local.labels

  versioning {
    enabled = true
  }
  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}

resource "random_password" "database" {
  length  = 32
  special = false
}

resource "random_password" "session" {
  length  = 48
  special = false
}

resource "random_password" "roster" {
  length  = 48
  special = false
}

resource "random_password" "evidence" {
  length  = 48
  special = false
}

resource "google_sql_database_instance" "main" {
  name                = local.name
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = var.environment != "demo"

  settings {
    tier              = var.cloud_sql_tier
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10
    disk_autoresize   = true
    user_labels       = local.labels

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
      transaction_log_retention_days = 7
    }

    ip_configuration {
      ipv4_enabled = true
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_sql_database" "pulse" {
  name     = "pulse_epis"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "pulse" {
  name     = "pulse_epis"
  instance = google_sql_database_instance.main.name
  password = random_password.database.result
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.name}-database-url"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql+psycopg://pulse_epis:${random_password.database.result}@/pulse_epis?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
}

resource "google_secret_manager_secret" "session" {
  secret_id = "${local.name}-session-secret"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "session" {
  secret      = google_secret_manager_secret.session.id
  secret_data = random_password.session.result
}

resource "google_secret_manager_secret" "google_client" {
  secret_id = "${local.name}-google-client-secret"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "google_client" {
  secret      = google_secret_manager_secret.google_client.id
  secret_data = var.google_client_secret
}

resource "google_secret_manager_secret" "roster" {
  secret_id = "${local.name}-roster-secret"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "roster" {
  secret      = google_secret_manager_secret.roster.id
  secret_data = random_password.roster.result
}

resource "google_secret_manager_secret" "evidence" {
  secret_id = "${local.name}-evidence-secret"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "evidence" {
  secret      = google_secret_manager_secret.evidence.id
  secret_data = random_password.evidence.result
}

resource "google_service_account" "app" {
  account_id   = "pulse-${var.environment}-app"
  display_name = "Pulse EPIS ${var.environment} application"
}

resource "google_service_account" "etl" {
  account_id   = "pulse-${var.environment}-etl"
  display_name = "Pulse EPIS ${var.environment} ETL"
}

resource "google_service_account" "scheduler" {
  account_id   = "pulse-${var.environment}-scheduler"
  display_name = "Pulse EPIS ${var.environment} scheduler"
}

resource "google_project_iam_member" "app_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "etl_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.etl.email}"
}

resource "google_secret_manager_secret_iam_member" "app_database" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

resource "google_secret_manager_secret_iam_member" "app_session" {
  secret_id = google_secret_manager_secret.session.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

resource "google_secret_manager_secret_iam_member" "app_google_client" {
  secret_id = google_secret_manager_secret.google_client.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

resource "google_secret_manager_secret_iam_member" "app_roster" {
  secret_id = google_secret_manager_secret.roster.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

resource "google_secret_manager_secret_iam_member" "app_evidence" {
  secret_id = google_secret_manager_secret.evidence.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

resource "google_secret_manager_secret_iam_member" "etl_database" {
  secret_id = google_secret_manager_secret.database_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.etl.email}"
}

resource "google_storage_bucket_iam_member" "etl_lake" {
  bucket = google_storage_bucket.lake.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.etl.email}"
}

resource "google_storage_bucket_iam_member" "app_evidence" {
  bucket = google_storage_bucket.evidence.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

resource "google_cloud_run_v2_service" "app" {
  name                = local.name
  location            = var.region
  deletion_protection = var.environment != "demo"
  labels              = local.labels

  template {
    service_account = google_service_account.app.email
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }
    volumes {
      name = "evidence"
      gcs {
        bucket    = google_storage_bucket.evidence.name
        read_only = false
      }
    }
    containers {
      image = var.app_image
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
      ports {
        container_port = 8080
      }
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
      volume_mounts {
        name       = "evidence"
        mount_path = "/app/.data/evidence"
      }
      env {
        name  = "PULSE_ENVIRONMENT"
        value = "production"
      }
      env {
        name  = "PULSE_AUTH_PROVIDER"
        value = "google"
      }
      env {
        name  = "PULSE_GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
      env {
        name  = "PULSE_GOOGLE_REDIRECT_URI"
        value = "${var.api_public_url}/api/v1/auth/google/callback"
      }
      env {
        name  = "PULSE_AUTH_SUCCESS_REDIRECT"
        value = var.frontend_origin
      }
      env {
        name  = "PULSE_CORS_ALLOWED_ORIGINS"
        value = var.frontend_origin
      }
      env {
        name  = "PULSE_AUTH_COOKIE_SECURE"
        value = "true"
      }
      env {
        name  = "PULSE_RUN_MIGRATIONS"
        value = "true"
      }
      env {
        name = "PULSE_DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "PULSE_AUTH_SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "PULSE_GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_client.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "PULSE_ROSTER_PSEUDONYM_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.roster.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "PULSE_EVIDENCE_ACCESS_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.evidence.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "frontend" {
  name                = "${local.name}-frontend"
  location            = var.region
  deletion_protection = var.environment != "demo"
  labels              = local.labels

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
    containers {
      image = var.frontend_image
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
      ports {
        container_port = 8080
      }
      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "${var.api_public_url}/api/v1"
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_job" "etl" {
  name                = "${local.name}-etl"
  location            = var.region
  deletion_protection = var.environment != "demo"
  labels              = local.labels

  template {
    template {
      service_account = google_service_account.etl.email
      timeout         = "1800s"
      max_retries     = 1
      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }
      volumes {
        name = "data-lake"
        gcs {
          bucket    = google_storage_bucket.lake.name
          read_only = false
        }
      }
      containers {
        image   = var.etl_image
        command = ["python", "-m", "backend.scripts_etl.main"]
        args    = ["--scheduled"]
        resources {
          limits = { cpu = "1", memory = "512Mi" }
        }
        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
        volume_mounts {
          name       = "data-lake"
          mount_path = "/data-lake"
        }
        env {
          name  = "PULSE_DATA_LAKE_PATH"
          value = "/data-lake"
        }
        env {
          name = "PULSE_DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.etl.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_cloud_scheduler_job" "etl" {
  name        = "${local.name}-etl"
  description = "Run the idempotent Pulse EPIS ETL"
  schedule    = var.scheduler_cron
  time_zone   = var.scheduler_timezone
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.etl.name}:run"
    oauth_token {
      service_account_email = google_service_account.scheduler.email
    }
  }

  retry_config {
    retry_count        = 1
    max_retry_duration = "600s"
  }
  depends_on = [google_cloud_run_v2_job_iam_member.scheduler]
}

resource "google_monitoring_alert_policy" "etl_failure" {
  display_name = "${local.name} ETL failures"
  combiner     = "OR"
  conditions {
    display_name = "Cloud Run Job failed execution"
    condition_matched_log {
      filter = "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${google_cloud_run_v2_job.etl.name}\" AND severity>=ERROR"
    }
  }
  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
  }
  depends_on = [google_project_service.required]
}

resource "google_billing_budget" "monthly" {
  count           = var.monthly_budget_usd > 0 && var.billing_account != "" ? 1 : 0
  billing_account = var.billing_account
  display_name    = "${local.name} monthly budget"
  budget_filter {
    projects = ["projects/${var.project_id}"]
  }
  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.8
  }
  threshold_rules {
    threshold_percent = 1.0
  }
}
