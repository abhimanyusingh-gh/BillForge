variable "project_name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "instance_type" {
  type = string
}

variable "ami_id" {
  type = string
}

variable "key_name" {
  type = string
}

variable "app_image" {
  type = string
}

variable "env_map" {
  type = map(string)
}

variable "google_credentials_json" {
  type      = string
  default   = ""
  sensitive = true
}

variable "api_ingress_cidrs" {
  type = list(string)
}

variable "schedule_scale_up_cron" {
  type = string
}

variable "schedule_scale_down_cron" {
  type = string
}
