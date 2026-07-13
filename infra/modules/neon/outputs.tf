output "project_id" {
  description = "Neon project identifier."
  value       = neon_project.rustume.id
}

output "branch_id" {
  description = "Primary branch identifier."
  value       = neon_project.rustume.branch.id
}

output "database_name" {
  description = "Application database name."
  value       = neon_database.app.name
}

output "role_name" {
  description = "Application role name."
  value       = neon_role.app.name
}

output "role_password" {
  description = "Application role password."
  value       = neon_role.app.password
  sensitive   = true
}

output "endpoint_host" {
  description = "Primary branch read-write endpoint host."
  value       = neon_project.rustume.branch.endpoint.host
}

output "database_url" {
  description = "PostgreSQL connection URL for the application role."
  value = format(
    "postgresql://%s:%s@%s/%s?sslmode=require",
    urlencode(neon_role.app.name),
    urlencode(neon_role.app.password),
    neon_project.rustume.branch.endpoint.host,
    urlencode(neon_database.app.name),
  )
  sensitive = true
}
