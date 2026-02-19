output "worker_asg_name" {
  value       = module.spot_worker.worker_asg_name
  description = "Auto Scaling Group name for spot invoice workers."
}

output "worker_security_group_id" {
  value       = module.spot_worker.worker_security_group_id
  description = "Security group attached to worker instances."
}

output "effective_mongo_uri" {
  value       = local.resolved_mongo_uri
  description = "Effective Mongo URI injected into worker runtime."
  sensitive   = true
}

output "documentdb_cluster_endpoint" {
  value       = try(module.documentdb[0].cluster_endpoint, null)
  description = "Provisioned DocumentDB cluster endpoint, if enabled."
}

output "documentdb_reader_endpoint" {
  value       = try(module.documentdb[0].reader_endpoint, null)
  description = "Provisioned DocumentDB reader endpoint, if enabled."
}

output "documentdb_security_group_id" {
  value       = try(module.documentdb[0].security_group_id, null)
  description = "Provisioned DocumentDB security group ID, if enabled."
}
