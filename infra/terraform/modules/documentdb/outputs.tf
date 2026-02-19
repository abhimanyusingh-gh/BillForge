output "cluster_endpoint" {
  value       = aws_docdb_cluster.documentdb.endpoint
  description = "DocumentDB cluster endpoint."
}

output "reader_endpoint" {
  value       = aws_docdb_cluster.documentdb.reader_endpoint
  description = "DocumentDB reader endpoint."
}

output "cluster_port" {
  value       = aws_docdb_cluster.documentdb.port
  description = "DocumentDB cluster port."
}

output "security_group_id" {
  value       = aws_security_group.documentdb.id
  description = "Security group attached to DocumentDB."
}

output "connection_uri" {
  value       = "mongodb://${var.master_username}:${urlencode(var.master_password)}@${aws_docdb_cluster.documentdb.endpoint}:${aws_docdb_cluster.documentdb.port}/${var.db_name}?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false&authSource=admin"
  description = "Mongo connection URI for application use with DocumentDB."
  sensitive   = true
}
