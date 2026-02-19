variable "project_name" {
  type        = string
  description = "Project name used for naming/tagging resources."
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where DocumentDB resources should be created."
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnets for the DocumentDB subnet group."
}

variable "allowed_cidr_blocks" {
  type        = list(string)
  description = "CIDR blocks allowed to connect to DocumentDB on port 27017."
  default     = []
}

variable "master_username" {
  type        = string
  description = "DocumentDB master username."
}

variable "master_password" {
  type        = string
  description = "DocumentDB master password."
  sensitive   = true
}

variable "db_name" {
  type        = string
  description = "Logical database name included in the generated connection URI."
  default     = "invoice_processor"
}

variable "engine_version" {
  type        = string
  description = "DocumentDB engine version."
  default     = "5.0.0"
}

variable "instance_class" {
  type        = string
  description = "Instance class for DocumentDB instances."
  default     = "db.t3.medium"
}

variable "instance_count" {
  type        = number
  description = "Number of DocumentDB instances."
  default     = 1
}

variable "backup_retention_period" {
  type        = number
  description = "DocumentDB backup retention period in days."
  default     = 7
}

variable "preferred_backup_window" {
  type        = string
  description = "Preferred backup window in UTC."
  default     = "07:00-09:00"
}

variable "storage_encrypted" {
  type        = bool
  description = "Whether DocumentDB storage is encrypted."
  default     = true
}

variable "deletion_protection" {
  type        = bool
  description = "Whether DocumentDB deletion protection is enabled."
  default     = true
}

variable "skip_final_snapshot" {
  type        = bool
  description = "Whether to skip final snapshot when destroying the cluster."
  default     = false
}

variable "apply_immediately" {
  type        = bool
  description = "Whether modifications should be applied immediately."
  default     = true
}
