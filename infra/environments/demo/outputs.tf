output "backend_service_url" {
  value = google_cloud_run_v2_service.app.uri
}

output "frontend_service_url" {
  value = google_cloud_run_v2_service.frontend.uri
}

output "etl_job_name" {
  value = google_cloud_run_v2_job.etl.name
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "data_lake_bucket" {
  value = google_storage_bucket.lake.name
}

output "evidence_bucket" {
  value = google_storage_bucket.evidence.name
}

output "artifact_registry_repository" {
  value = google_artifact_registry_repository.containers.name
}
